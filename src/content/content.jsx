import { createRoot } from 'react-dom/client';
import Widget from './Widget.jsx';
import { classify } from '../lib/classify.js';
import widgetCss from './widget.css?inline';
import pressStart2PPath from '@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2';
import vt323Path from '@fontsource/vt323/files/vt323-latin-400-normal.woff2';

const HOST_ID = 'visaradar-host';
const DEBOUNCE_MS = 100;

// Same origin-resolution issue as the logo: Vite emits a root-relative path
// for these font files, which would resolve against linkedin.com instead of
// the extension if used as-is. Resolve through chrome.runtime.getURL() so
// the @font-face below points at the extension's own chrome-extension:// origin.
function resolveAssetUrl(path) {
  return typeof chrome !== 'undefined' && chrome.runtime?.getURL ? chrome.runtime.getURL(path) : path;
}

const FONT_FACE_CSS = `
@font-face {
  font-family: 'Press Start 2P';
  src: url('${resolveAssetUrl(pressStart2PPath)}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
@font-face {
  font-family: 'VT323';
  src: url('${resolveAssetUrl(vt323Path)}') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
}
`;

let renderWidget = () => {};
let debounceTimer = null;
let lastScannedText = null;
let observer = null;
let currentResult = null; // last computed result for THIS tab — the popup reads this via messaging
let scanStartedAt = null;
let lastTitleSeen = null;
let titleSettleTimer = null;
const TITLE_SETTLE_MS = 250;
const FALLBACK_TITLE = 'Active Job Posting'; // returned when no real title element could be found at all

function mountWidget() {
  if (document.getElementById(HOST_ID)) return;

  const host = document.createElement('div');
  host.id = HOST_ID;
  document.body.appendChild(host);

  const shadow = host.attachShadow({ mode: 'open' });

  const fontStyle = document.createElement('style');
  fontStyle.textContent = FONT_FACE_CSS;
  shadow.appendChild(fontStyle);

  const style = document.createElement('style');
  style.textContent = widgetCss;
  shadow.appendChild(style);

  const mountPoint = document.createElement('div');
  shadow.appendChild(mountPoint);

  const root = createRoot(mountPoint);
  root.render(<Widget status="idle" />);
  renderWidget = (props) => root.render(<Widget {...props} />);
}

// LinkedIn scatters other h1/h2/h3 text around the page (feedback prompts,
// "meet the team", related-jobs headers) that can get mistaken for the job
// title if the primary selector misses. Filter those out explicitly.
const TITLE_EXCLUDE_PATTERNS = [
  /about the job/i,
  /based on linkedin data/i,
  /excludes subsidiaries/i,
  /determine your fit/i,
  /how to stand out/i,
  /how you compare/i,
  /clicked apply/i,
  /^see how\b/i,
  /^unlock\b/i,
  /^upgrade to\b/i,
  /premium/i,
  /people you can reach/i,
  /meet the team/i,
  /job match/i,
  /how you match/i,
  /helpful/i,
  /report this job/i,
  /people also viewed/i,
  /similar jobs/i,
  /^(are|is|was|were)\b.*\?$/i
];

function isLikelyTitle(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  return !TITLE_EXCLUDE_PATTERNS.some((re) => re.test(trimmed));
}

function getJobTitleText() {
  const primary = document.querySelector(
    '.jobs-unified-top-card__job-title, .job-details-jobs-unified-top-card__job-title, .jobs-search__job-details h1'
  );
  if (primary && isLikelyTitle(primary.innerText)) return primary.innerText.trim();

  const detailPane = document.querySelector('.jobs-search__job-details') || document.querySelector('main');
  if (detailPane) {
    // LinkedIn now ships hashed/obfuscated CSS classes for the title element
    // (e.g. "auygkk auymw8") that change across deploys, so class-name
    // selectors and heading tags are both unreliable here. What IS stable is
    // that the title is always an <a> linking to the canonical job URL
    // (/jobs/view/<id>/...) — anchor on that URL shape instead. Scoped to
    // detailPane so this doesn't grab a different job's link out of the
    // search-results list sitting alongside the detail pane.
    const titleLink = Array.from(detailPane.querySelectorAll('a[href*="/jobs/view/"]')).find((a) =>
      isLikelyTitle(a.innerText)
    );
    if (titleLink) return titleLink.innerText.trim();

    // Dropped h3 from this heading fallback — LinkedIn's small metadata
    // captions (tooltips, "Based on LinkedIn data" disclaimers) tend to land
    // in h3s more often than genuine headings do, so narrowing reduces false hits.
    const candidate = Array.from(detailPane.querySelectorAll('h1, h2')).find((h) =>
      isLikelyTitle(h.innerText)
    );
    if (candidate) return candidate.innerText.trim();
  }

  return FALLBACK_TITLE;
}

function getJobDescriptionText() {
  const aboutHeading = Array.from(document.querySelectorAll('*')).find(
    (el) => el.children.length === 0 && el.innerText?.trim().toLowerCase() === 'about the job'
  );

  if (aboutHeading) {
    let parent = aboutHeading.parentElement;
    for (let i = 0; i < 6; i++) {
      if (parent && parent.innerText && parent.innerText.length > 150) {
        return parent.innerText;
      }
      if (parent) parent = parent.parentElement;
    }
  }

  const container = document.querySelector('.jobs-search__job-details') || document.querySelector('main');
  return container ? container.innerText : document.body.innerText;
}

function scan() {
  const jobTitle = getJobTitleText();

  // LinkedIn's title element updates in stages while switching jobs (old
  // title -> blank/fallback -> final title), and the description text can
  // shift independently in between. Only comparing "did the title change"
  // let a transient/wrong title slip through as a finished result if the
  // description also happened to change on that same tick. Require the
  // title to match what we saw on the PREVIOUS scan before treating it as
  // stable enough to show as a result — any change always shows the loader
  // and defers classification to a later, confirming pass.
  if (jobTitle !== lastTitleSeen) {
    lastTitleSeen = jobTitle;
    scanStartedAt = Date.now();
    renderWidget({ status: 'scanning', jobTitle });
    // Guarantee a follow-up check even if LinkedIn's DOM goes quiet right
    // after the title updates (the MutationObserver might not fire again).
    clearTimeout(titleSettleTimer);
    titleSettleTimer = setTimeout(scan, TITLE_SETTLE_MS);
    return;
  }

  // The fallback string itself can "stabilize" (stay constant call after
  // call) when no real title element exists at all — e.g. browsing a search
  // results list without an active job pane open. A constant fallback still
  // passes the check above, so it needs its own guard: never show this as a
  // finished result, just keep the loader up and keep re-checking.
  if (jobTitle === FALLBACK_TITLE) {
    renderWidget({ status: 'scanning', jobTitle });
    clearTimeout(titleSettleTimer);
    titleSettleTimer = setTimeout(scan, TITLE_SETTLE_MS);
    return;
  }

  const text = getJobDescriptionText();
  if (!text || text === lastScannedText) return;
  lastScannedText = text;

  const result = classify(text);
  const elapsedMs = scanStartedAt ? Date.now() - scanStartedAt : null;

  currentResult = { ...result, jobTitle, scannedAt: Date.now(), elapsedMs };
  renderWidget({ status: 'result', result, jobTitle, elapsedMs });
}

function scheduleScan() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(scan, DEBOUNCE_MS);
}

function startObserver() {
  if (!observer) {
    observer = new MutationObserver(() => scheduleScan());
  }
  observer.observe(document.body, { childList: true, subtree: true });
}

mountWidget();
startObserver();
scheduleScan();

// Answers popup.jsx — it has no other way to read this tab's scan result.
try {
  if (typeof chrome !== 'undefined' && chrome.runtime?.id && chrome.runtime.onMessage) {
    chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
      if (message && message.type === 'VISARADAR_GET_RESULT') {
        sendResponse({ ok: true, result: currentResult });
      } else if (message && message.type === 'VISARADAR_RESCAN') {
        // Only clear the description dedupe, NOT lastTitleSeen — resetting
        // that would make scan() think the title just changed and defer to
        // the loader/settle-timer path, returning a stale cached result here
        // instead of a freshly classified one.
        lastScannedText = null;
        scan();
        sendResponse({ ok: true, result: currentResult });
      }
      return true;
    });
  }
} catch (e) {
  // Context invalidated (extension reloaded while this tab was open) — ignore.
}
