# VisaRadar

VisaRadar is a Chrome extension that scans job postings as you browse and flags whether a role is likely to require U.S. citizenship, security clearance, or offer visa sponsorship — before you spend time applying.

## What it does

It reads the job description in real time on LinkedIn, Handshake, and company career sites (via schema.org `JobPosting` structured data), and shows a small floating widget with one of three signals:

- 🔴 **Restricted** — citizenship, security clearance, or "no sponsorship" language detected
- 🟢 **Sponsorship available** — the posting explicitly offers visa sponsorship
- 🟡 **Unclear** — no sponsorship or citizenship language found either way

Click the widget to see the exact sentence that triggered the result, so you're never guessing why it was flagged. Everything runs locally in the browser — no job posting text or personal data is ever sent anywhere. See [PRIVACY.md](./PRIVACY.md) for details.

## Status

In review for the Chrome Web Store.
