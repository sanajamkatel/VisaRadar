import { useEffect, useRef, useState } from 'react';
import logoAssetPath from '../assets/logo.png';

// Vite emits an origin-relative path like "/assets/logo-xxxx.png", which the
// browser would resolve against the HOST PAGE's origin (linkedin.com) since
// this runs inside a content script — not the extension's own origin. That
// 404s silently, which is why only the background color showed and not the
// logo. chrome.runtime.getURL() rewrites it to the correct chrome-extension:// URL.
const logoUrl =
  typeof chrome !== 'undefined' && chrome.runtime?.getURL
    ? chrome.runtime.getURL(logoAssetPath)
    : logoAssetPath;

const POSITION_KEY = 'visaradarWidgetPosition';
const DRAG_THRESHOLD_PX = 4;
const TRIGGER_SIZE = 48;
const CARD_WIDTH = 250;
const CARD_HEIGHT_ESTIMATE = 300;

function cleanEvidence(text) {
  return (text || '').replace(/^["'*\s]+|["'*\s]+$/g, '').trim();
}

// The card must never change the trigger's own position (that caused the bug
// where dragging near an edge and expanding could push the trigger off-screen
// entirely, making it unreachable to close). Instead the card floats as an
// absolutely-positioned overlay next to the trigger, flipping to whichever
// side of the trigger actually has room on the current screen.
function getCardPlacement(pos) {
  if (!pos) return { vertical: 'up', horizontal: 'left' };

  const spaceAbove = pos.top;
  const spaceBelow = window.innerHeight - pos.top - TRIGGER_SIZE;
  const vertical = spaceAbove < CARD_HEIGHT_ESTIMATE && spaceBelow > spaceAbove ? 'down' : 'up';

  const spaceLeft = pos.left;
  const spaceRight = window.innerWidth - pos.left - TRIGGER_SIZE;
  const horizontal = spaceLeft < CARD_WIDTH && spaceRight > spaceLeft ? 'right' : 'left';

  return { vertical, horizontal };
}

export default function Widget({ status, result, jobTitle }) {
  const [pos, setPos] = useState(null); // null = default bottom-right CSS position
  const [isExpanded, setIsExpanded] = useState(false); // always starts as a collapsed floating pill
  const dragRef = useRef(null); // { offsetX, offsetY, startX, startY, moved } while pointer is down

  useEffect(() => {
    try {
      chrome.storage?.local?.get(POSITION_KEY, (data) => {
        if (data && data[POSITION_KEY]) setPos(data[POSITION_KEY]);
      });
    } catch (e) {
      // storage unavailable — fall back to default position
    }
  }, []);

  function handlePointerDown(e) {
    const container = e.currentTarget.closest('.widget-container');
    const rect = container.getBoundingClientRect();
    dragRef.current = {
      offsetX: e.clientX - rect.left,
      offsetY: e.clientY - rect.top,
      startX: e.clientX,
      startY: e.clientY,
      moved: false
    };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function handlePointerMove(e) {
    if (!dragRef.current) return;
    const dx = e.clientX - dragRef.current.startX;
    const dy = e.clientY - dragRef.current.startY;
    if (Math.abs(dx) > DRAG_THRESHOLD_PX || Math.abs(dy) > DRAG_THRESHOLD_PX) {
      dragRef.current.moved = true;
    }
    if (dragRef.current.moved) {
      const left = Math.max(0, e.clientX - dragRef.current.offsetX);
      const top = Math.max(0, e.clientY - dragRef.current.offsetY);
      setPos({ left, top });
    }
  }

  function handlePointerUp() {
    if (!dragRef.current) return;
    const wasDrag = dragRef.current.moved;
    dragRef.current = null;

    if (wasDrag) {
      setPos((current) => {
        try {
          if (current) chrome.storage?.local?.set({ [POSITION_KEY]: current });
        } catch (e) {
          // ignore
        }
        return current;
      });
    } else {
      setIsExpanded((v) => !v);
    }
  }

  if (status === 'idle') return null;

  const isScanning = status === 'scanning';
  const isAvailable = result?.colorClass === 'sponsorship-available';
  const isRestricted = result?.colorClass === 'restricted' || result?.colorClass === 'no-sponsorship';
  const toneClass = isScanning ? 'scanning' : isAvailable ? 'available' : isRestricted ? 'restricted' : 'neutral';

  const containerStyle = pos ? { left: pos.left, top: pos.top, right: 'auto', bottom: 'auto' } : undefined;
  const placement = getCardPlacement(pos);

  return (
    <div className={`widget-container ${toneClass}`} style={containerStyle}>
      {isExpanded && (
        <div className={`card placement-${placement.vertical} placement-${placement.horizontal}`}>
          <div className="row">
            <span className="brand">
              <img src={logoUrl} alt="" className="logo-img" />
              VisaRadar
            </span>
            <button className="close-btn" onClick={() => setIsExpanded(false)} title="Collapse">
              ✕
            </button>
          </div>

          {/* Keying on the content forces a fresh mount (and re-triggers the
              fade-in animation) every time the job or status actually
              changes, instead of the text just snapping to new values. */}
          <div className="content-body" key={`${jobTitle}-${status}-${result?.status || ''}`}>
            {isScanning ? (
              <div className="pixel-loader" aria-label="Scanning job description">
                <span></span>
                <span></span>
                <span></span>
                <span></span>
              </div>
            ) : (
              <div className="title" title={jobTitle}>
                {jobTitle}
              </div>
            )}

            {isScanning ? (
              <div className="pill pill-scanning">
                <span className="spinner" aria-hidden="true" />
                Scanning…
              </div>
            ) : (
              <>
                <div className="pill">
                  <span>{result.emoji}</span>
                  <span>{result.label}</span>
                </div>
                <div className="quote">{cleanEvidence(result.evidence)}</div>
              </>
            )}
          </div>
        </div>
      )}

      <button
        className="trigger"
        style={{ backgroundImage: `url(${logoUrl})` }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        title="Drag to move · Click to toggle"
      >
        <span className="status-dot" aria-hidden="true" />
      </button>
    </div>
  );
}
