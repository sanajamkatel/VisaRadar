# VisaRadar Privacy Policy

_Last updated: October 1, 2026_

VisaRadar is a Chrome extension that scans job postings you view in your browser and flags mentions of U.S. citizenship requirements, security clearance requirements, and visa sponsorship information.

## What VisaRadar does

- When you are viewing a job posting (on LinkedIn, Handshake, or a company careers site), VisaRadar reads the visible job title and job description text on that page.
- This text is analyzed entirely on your device, inside your browser, using a local pattern-matching engine bundled with the extension.
- The result (a status label such as "Sponsorship Available," "No Sponsorship," etc.) is displayed to you in an on-page widget.

## What VisaRadar does not do

- VisaRadar does not send any page content, job posting text, or analysis results to any server. There are no network requests, analytics calls, or third-party integrations of any kind.
- VisaRadar does not collect, store, or transmit personally identifiable information, health information, financial information, authentication credentials, personal communications, location data, web browsing history, or user activity (clicks, keystrokes, etc.).
- VisaRadar does not use cookies or any cross-site tracking mechanism.

## Local storage

The only data VisaRadar stores is the on-screen position of its floating widget (so it stays where you last dragged it). This is saved using Chrome's local extension storage (`chrome.storage.local`), stays entirely on your device, and is never transmitted anywhere.

## Permissions

- **activeTab / host permissions**: used to read the job posting content of the page you are currently viewing, so VisaRadar can analyze it.
- **storage**: used only to remember the widget's on-screen position between sessions.
- **scripting**: used to run VisaRadar's analysis script on the current page when needed.

## Changes to this policy

If VisaRadar's data practices change in the future, this policy will be updated accordingly.

## Contact

Questions about this policy can be directed to the developer via the GitHub repository: https://github.com/sanajamkatel/VisaRadar
