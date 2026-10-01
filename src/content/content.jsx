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
let toggleWidgetVisibility = () => {}; // set once Widget registers itself; called from the toolbar-click message
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

  const registerToggle = (fn) => {
    toggleWidgetVisibility = fn;
  };

  const root = createRoot(mountPoint);
  root.render(<Widget status="idle" registerToggle={registerToggle} />);
  renderWidget = (props) => root.render(<Widget {...props} registerToggle={registerToggle} />);
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
  /jobs based on your preferences/i,
  /^(are|is|was|were)\b.*\?$/i
];

function isLikelyTitle(text) {
  if (!text) return false;
  const trimmed = text.trim();
  if (trimmed.length < 3 || trimmed.length > 120) return false;
  return !TITLE_EXCLUDE_PATTERNS.some((re) => re.test(trimmed));
}

function getLinkedInJobTitle() {
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

  return null;
}

function getLinkedInJobDescription() {
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
  return container ? container.innerText : null;
}

// Handshake-specific selectors, verified against a live job page.
// Handshake uses styled-components (hashed "sc-xxxxx" classes that can shift
// between deploys), so matching plain <h1> works here because the title is
// the ONLY <h1> on the page — section headings elsewhere are h2/h3/h4.
function getHandshakeJobTitle() {
  const el = document.querySelector('h1');
  return el && isLikelyTitle(el.innerText) ? el.innerText.trim() : null;
}

// Handshake surfaces an explicit, stable data-hook for this ("US work
// authorization required") separate from the main description body — more
// reliable than hoping it's phrased the same way inside free-text, so pull
// it in directly rather than relying on it appearing in the description.
function getHandshakeWorkAuthNote() {
  const el = document.querySelector('[data-hook="work-auth-title"]');
  return el ? el.innerText.trim() : '';
}

function getHandshakeJobDescription() {
  // Same heading-text-search pattern as LinkedIn's "about the job" lookup —
  // Handshake has no stable class on the description container itself, but
  // the "Job description" heading text is reliable. Using .includes() rather
  // than exact equality: a strict match failing silently (whitespace, a
  // stray character) was falling through to returning ONLY the "At a
  // glance" work-auth note instead of the actual description body.
  const heading = Array.from(document.querySelectorAll('h1, h2, h3, h4, h5')).find((el) =>
    el.textContent?.trim().toLowerCase().includes('job description')
  );

  let description = null;
  if (heading) {
    let parent = heading.parentElement;
    for (let i = 0; i < 5; i++) {
      if (parent && parent.innerText && parent.innerText.length > 150) {
        description = parent.innerText;
        break;
      }
      if (parent) parent = parent.parentElement;
    }
  }

  const workAuthNote = getHandshakeWorkAuthNote();
  if (!description && !workAuthNote) return null;
  return [workAuthNote, description].filter(Boolean).join('. ');
}

function stripHtml(html) {
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

// Many ATS platforms (Greenhouse, Lever) and company career pages embed
// schema.org/JobPosting structured data for Google's "Jobs" rich-results
// feature. This is a semantic signal, not a DOM class name, so it works
// across sites we've never specifically targeted and doesn't break when a
// site redesigns. LinkedIn and Handshake gate this behind login and
// generally don't expose it, hence the separate platform-specific paths above.
function getJobPostingFromSchema() {
  const scripts = document.querySelectorAll('script[type="application/ld+json"]');
  for (const script of scripts) {
    let data;
    try {
      data = JSON.parse(script.textContent);
    } catch (e) {
      continue;
    }
    const roots = Array.isArray(data) ? data : [data];
    for (const root of roots) {
      const candidates = root['@graph'] ? root['@graph'] : [root];
      for (const item of candidates) {
        const types = Array.isArray(item['@type']) ? item['@type'] : [item['@type']];
        if (types.includes('JobPosting') && item.title && item.description) {
          return { title: String(item.title).trim(), description: stripHtml(String(item.description)) };
        }
      }
    }
  }
  return null;
}

// Unifies all three detection tiers. Returns null when this page doesn't
// look like a job posting at all, so the widget stays fully hidden instead
// of showing up (and misfiring) on arbitrary non-job pages.
function detectJobPosting() {
  const schemaJob = getJobPostingFromSchema();
  if (schemaJob) return schemaJob;

  const host = location.hostname;

  if (host.includes('linkedin.com')) {
    const description = getLinkedInJobDescription();
    if (description) {
      return { title: getLinkedInJobTitle() || FALLBACK_TITLE, description };
    }
    // No description container found yet (e.g. mid-navigation) — still
    // report a title-only detection so the scanning loader can show while
    // we wait, rather than looking like nothing is happening at all.
    if (getLinkedInJobTitle()) return { title: getLinkedInJobTitle(), description: null };
    return null;
  }

  if (host.includes('joinhandshake.com')) {
    const description = getHandshakeJobDescription();
    if (description) {
      return { title: getHandshakeJobTitle() || FALLBACK_TITLE, description };
    }
    if (getHandshakeJobTitle()) return { title: getHandshakeJobTitle(), description: null };
    return null;
  }

  return null;
}

function scan() {
  const detected = detectJobPosting();

  // Nothing job-related on this page at all (not LinkedIn/Handshake, and no
  // schema.org/JobPosting data) — stay fully idle. This is what keeps the
  // icon from showing up on every random website now that the manifest
  // matches <all_urls>.
  if (!detected) {
    if (lastTitleSeen !== null) {
      lastTitleSeen = null;
      lastScannedText = null;
      renderWidget({ status: 'idle' });
    }
    return;
  }

  const jobTitle = detected.title;

  // LinkedIn/Handshake's title element updates in stages while switching
  // jobs (old title -> blank/fallback -> final title), and the description
  // text can shift independently in between. Only comparing "did the title
  // change" let a transient/wrong title slip through as a finished result if
  // the description also happened to change on that same tick. Require the
  // title to match what we saw on the PREVIOUS scan before treating it as
  // stable enough to show as a result — any change always shows the loader
  // and defers classification to a later, confirming pass.
  if (jobTitle !== lastTitleSeen) {
    lastTitleSeen = jobTitle;
    scanStartedAt = Date.now();
    renderWidget({ status: 'scanning', jobTitle });
    // Guarantee a follow-up check even if the DOM goes quiet right after the
    // title updates (the MutationObserver might not fire again).
    clearTimeout(titleSettleTimer);
    titleSettleTimer = setTimeout(scan, TITLE_SETTLE_MS);
    return;
  }

  // The fallback string itself can "stabilize" (stay constant call after
  // call) when no real title element exists at all — e.g. browsing a search
  // results list without an active job pane open. A constant fallback still
  // passes the check above, so it needs its own guard: never show this as a
  // finished result, just keep the loader up and keep re-checking.
  if (jobTitle === FALLBACK_TITLE || !detected.description) {
    renderWidget({ status: 'scanning', jobTitle });
    clearTimeout(titleSettleTimer);
    titleSettleTimer = setTimeout(scan, TITLE_SETTLE_MS);
    return;
  }

  const text = detected.description;
  if (text === lastScannedText) return;
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

// The popup falls back to re-injecting this whole script (via
// chrome.scripting.executeScript) whenever messaging fails, e.g. because the
// tab was open before the extension loaded. If this script has ALREADY
// initialized in this page (from the automatic injection, or an earlier
// retry), re-running init would spin up a second MutationObserver, a second
// scan loop, and a second message listener living alongside the first —
// both trying to own the same on-page widget. Symptoms of that were exactly
// what showed up: the widget appearing as a permanently-expanded card
// instead of the collapsed icon (two Widget instances with independent
// isExpanded state stepping on each other's renders) and disappearing
// entirely on unrelated clicks (one instance's re-render replacing what the
// other had just drawn). Guard with a window-level flag — unlike a
// module-scoped variable, this correctly persists across repeated
// executeScript re-injections within the SAME page, while still resetting
// naturally on any real navigation/reload (a new page gets a new `window`).
if (!window.__visaradarInitialized) {
  window.__visaradarInitialized = true;

  mountWidget();
  startObserver();
  scheduleScan();

  // Messages from background.js (toolbar icon click) and, previously,
  // popup.jsx — now unused since the popup was removed in favor of the
  // toolbar icon toggling this on-page widget directly.
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
        } else if (message && message.type === 'VISARADAR_TOGGLE_WIDGET') {
          toggleWidgetVisibility();
          sendResponse({ ok: true });
        }
        return true;
      });
    }
  } catch (e) {
    // Context invalidated (extension reloaded while this tab was open) — ignore.
  }
}
