# VisaRadar

VisaRadar is a Chrome extension that scans job postings as you browse and flags whether a role is likely to require U.S. citizenship, security clearance, or offer visa sponsorship — before you spend time applying.

## What it does

It reads the job description in real time on LinkedIn, Handshake, and company career sites (via schema.org `JobPosting` structured data), and shows a small floating widget with one of three signals:

- 🔴 **Restricted** — citizenship, security clearance, or "no sponsorship" language detected
- 🟢 **Sponsorship available** — the posting explicitly offers visa sponsorship
- 🟡 **Unclear** — no sponsorship or citizenship language found either way

Click the widget to see the exact sentence that triggered the result, so you're never guessing why it was flagged. Everything runs locally in the browser — no job posting text or personal data is ever sent anywhere. See [PRIVACY.md](./PRIVACY.md) for details.

## How it works

- **Detection** is tiered: schema.org `JobPosting` JSON-LD (works on most company career sites) → LinkedIn-specific DOM selectors → Handshake-specific DOM selectors, unified into a single `detectJobPosting()` pipeline with a `MutationObserver` to catch SPA navigation.
- **Classification** (`src/lib/classify.js`) is a regex-based engine with priority ordering: `RESTRICTED` > `NO_SPONSORSHIP` > `SPONSORSHIP_AVAILABLE` > `AMBIGUOUS` > `NOT_MENTIONED`. It includes negation-guard patterns (so "does not require sponsorship" isn't misread as requiring it), EEO-boilerplate stripping, and abbreviation-aware sentence boundary detection (so "U.S." doesn't get treated as a sentence end).
- **UI**: React widget rendered into a Shadow DOM root for CSS isolation from the host page, with Pointer Events-based dragging and position persisted via `chrome.storage.local`.
- **Build**: React + Vite + [@crxjs/vite-plugin](https://crxjs.dev/vite-plugin), which compiles the Manifest V3 source into a loadable `dist/` bundle.

## Development

```bash
npm install
npx vite build
```

Then load the `dist/` folder as an unpacked extension in `chrome://extensions`.

## Status

In review for the Chrome Web Store.
