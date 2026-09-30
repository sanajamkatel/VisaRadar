import { useEffect, useState } from 'react';

const STATUS_CLASS = {
  RESTRICTED: 'status-restricted',
  NO_SPONSORSHIP: 'status-no-sponsorship',
  SPONSORSHIP_AVAILABLE: 'status-sponsorship-available',
  AMBIGUOUS: 'status-ambiguous',
  NOT_MENTIONED: 'status-none',
  UNREADABLE: 'status-none'
};

async function getActiveLinkedInTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (tab && tab.url && tab.url.includes('linkedin.com')) {
    return tab;
  }
  return null;
}

// Ask THIS tab's content script for its own in-memory result, rather than a
// shared storage key — that would get overwritten by whichever LinkedIn tab
// scanned last, showing the wrong job when multiple tabs are open.
function requestResultFromTab(tab, message) {
  return new Promise((resolve) => {
    chrome.tabs.sendMessage(tab.id, message, (response) => {
      if (chrome.runtime.lastError || !response) {
        resolve(null);
        return;
      }
      resolve(response.result || null);
    });
  });
}

function injectAndRetry(tab, message) {
  return new Promise((resolve) => {
    // Vite/CRXJS renames the built content script to a hashed filename that
    // changes every build, so we read the real path from the installed
    // extension's own manifest rather than hardcoding a source path.
    const files = chrome.runtime.getManifest().content_scripts?.[0]?.js || [];
    if (files.length === 0) {
      resolve(null);
      return;
    }
    chrome.scripting.executeScript({ target: { tabId: tab.id }, files }, () => {
      requestResultFromTab(tab, message).then(resolve);
    });
  });
}

export default function Popup() {
  const [result, setResult] = useState(null);
  const [noTab, setNoTab] = useState(false);
  const [rescanning, setRescanning] = useState(false);

  async function load() {
    const tab = await getActiveLinkedInTab();
    if (!tab) {
      setNoTab(true);
      return;
    }
    setNoTab(false);

    let data = await requestResultFromTab(tab, { type: 'VISARADAR_GET_RESULT' });
    if (!data) {
      data = await injectAndRetry(tab, { type: 'VISARADAR_GET_RESULT' });
    }
    setResult(data);
  }

  useEffect(() => {
    load();
  }, []);

  async function handleRescan() {
    setRescanning(true);
    const tab = await getActiveLinkedInTab();
    if (!tab) {
      setNoTab(true);
      setRescanning(false);
      return;
    }

    let data = await requestResultFromTab(tab, { type: 'VISARADAR_RESCAN' });
    if (!data) {
      data = await injectAndRetry(tab, { type: 'VISARADAR_RESCAN' });
    }
    setResult(data);
    setRescanning(false);
  }

  const statusClass = result ? STATUS_CLASS[result.status] || 'status-none' : 'status-none';

  return (
    <div className="app">
      <header className="header">
        <span className="header-icon">📡</span>
        <h1 className="header-title">VisaRadar</h1>
      </header>

      <main className="content">
        <div className={`status-badge ${statusClass}`}>
          <span>{result ? result.emoji : '⚪'}</span>
          <span>{result ? result.label : 'No Scan Yet'}</span>
        </div>

        <div className="job-title-row">
          <span className="job-title">
            {noTab
              ? 'Open a LinkedIn job posting to begin.'
              : result
              ? result.jobTitle
              : 'Waiting for scan…'}
          </span>
        </div>

        <section className="evidence-section">
          <h2 className="evidence-heading">Detected Evidence</h2>
          <p className="evidence-text">{result?.evidence || '—'}</p>
        </section>

        <p className="scanned-at">
          {result?.scannedAt ? `Scanned ${new Date(result.scannedAt).toLocaleTimeString()}` : ''}
          {typeof result?.elapsedMs === 'number' ? ` · took ${(result.elapsedMs / 1000).toFixed(1)}s` : ''}
        </p>
      </main>

      <footer className="footer">
        <button className="rescan-button" onClick={handleRescan} disabled={rescanning}>
          {rescanning ? 'Rescanning…' : 'Rescan Page'}
        </button>
      </footer>
    </div>
  );
}
