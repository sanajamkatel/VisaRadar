export const PATTERNS = {
  RESTRICTED: {
    label: 'U.S. Citizen / Clearance Required',
    emoji: '🔴',
    colorClass: 'restricted',
    regexes: [
      /\bmust\s+be\s+(a\s+)?(u\.?s\.?|united\s+states)\s+citizen\b/i,
      /\b(u\.?s\.?|united\s+states)\s+citizenship\s+(is\s+)?required\b/i,
      /\bcitizenship\s+required\b/i,
      /\bsecurity\s+clearance\b/i,
      /\b(active|current)\s+(secret|top\s*secret|ts\/sci|ts-sci)\s+clearance\b/i,
      /\bable\s+to\s+obtain\s+(a\s+)?security\s+clearance\b/i,
      /\bgreen\s*card\s+(holders?\s+)?(required|preferred|only)\b/i,
      /\b(u\.?s\.?\s+)?permanent\s+resident(s)?\s+(only|required|preferred)\b/i
    ]
  },
  NO_SPONSORSHIP: {
    label: 'No Sponsorship Offered',
    emoji: '🚫',
    colorClass: 'no-sponsorship',
    regexes: [
      /\b(will\s+not|won't|does\s+not|doesn't|cannot|can't|unable\s+to|not\s+able\s+to)\s+(provide|offer|sponsor)\s+(visa\s+)?sponsorship\b/i,
      /\bno\s+(visa\s+)?sponsorship\s+(is\s+)?(available|provided|offered)?\b/i,
      /\bsponsorship\s+(is\s+)?not\s+(available|offered|provided)\b/i,
      /\bwe\s+(will\s+not|do\s+not|don't)\s+sponsor\b/i,
      /\bnot\s+sponsoring\s+visas?\b/i,
      /\bmust\s+not\s+require\s+(visa\s+)?sponsorship\b/i,
      /\bnot\s+eligible\s+for\s+(visa\s+)?sponsorship\b/i,
      /\b(do(es)?\s+not|don't|won't)\s+offer\s+(h-?1b\s*)?(visa\s*)?transfers?\b/i
    ]
  },
  SPONSORSHIP_AVAILABLE: {
    label: 'Visa Sponsorship Available',
    emoji: '🟢',
    colorClass: 'sponsorship-available',
    regexes: [
      /\b(we\s+)?(will|can|do)\s+sponsor\b/i,
      /\bsponsor(ship)?\s+(is\s+)?available\b/i,
      /\bvisa\s+sponsorship\s+(is\s+)?(provided|offered|available)\b/i,
      /\bopen\s+to\s+sponsor(ing)?\b/i,
      /\bopt\s*friendly\b/i,
      /\bh-?1b\s*(visa\s*)?sponsor(ship)?\b/i
    ]
  },
  AMBIGUOUS: {
    label: 'Work Authorization Required',
    emoji: '🟡',
    colorClass: 'ambiguous',
    regexes: [
      /\bwork\s+authorization\b/i,
      /\bauthoriz(ed|ation)\s+to\s+work\s+in\s+the\s+(u\.?s\.?|united\s+states)\b/i,
      /\beligib(le|ility)\s+to\s+work\b/i,
      /\bmust\s+be\s+legally\s+authorized\s+to\s+work\b/i
    ]
  }
};

const PRIORITY_ORDER = ['RESTRICTED', 'NO_SPONSORSHIP', 'SPONSORSHIP_AVAILABLE', 'AMBIGUOUS'];

export function getSentenceContaining(text, matchIndex, matchLength) {
  const safeIndex = Math.max(0, Math.min(matchIndex, text.length));
  const safeLength = Math.max(1, matchLength || 1);

  const leftSlice = text.slice(0, safeIndex);
  const startMatch = leftSlice.search(/[^.\n\r•\-.:]+$/);
  const start = startMatch !== -1 ? startMatch : 0;

  const rightSlice = text.slice(safeIndex + safeLength);
  const endMatch = rightSlice.search(/[\n\r•\t.]/);
  const end = endMatch === -1 ? text.length : safeIndex + safeLength + endMatch;

  const sentence = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return sentence.length > 200 ? sentence.slice(0, 200) + '…' : sentence;
}

export function classify(text) {
  if (!text || !text.trim() || text.length < 50) {
    return {
      status: 'UNREADABLE',
      label: 'Unable to Parse Page',
      emoji: '⚠️',
      colorClass: 'none',
      evidence: 'Could not detect job description text on this view.'
    };
  }

  for (const key of PRIORITY_ORDER) {
    const category = PATTERNS[key];
    for (const regex of category.regexes) {
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (match) {
        return {
          status: key,
          label: category.label,
          emoji: category.emoji,
          colorClass: category.colorClass,
          evidence: getSentenceContaining(text, match.index, match[0].length)
        };
      }
    }
  }

  return {
    status: 'NOT_MENTIONED',
    label: 'Sponsorship Not Mentioned',
    emoji: 'ℹ️',
    colorClass: 'none',
    evidence: 'The job posting does not explicitly mention visa sponsorship or citizenship requirements.'
  };
}
