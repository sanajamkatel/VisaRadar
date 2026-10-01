export const PATTERNS = {
  RESTRICTED: {
    label: 'U.S. Citizen / Clearance Required',
    colorClass: 'restricted',
    regexes: [
      /\bmust\s+be\s+(a\s+)?(u\.?s\.?|united\s+states)\s+citizen\b/i,
      /\b(u\.?s\.?|united\s+states)\s+citizenship\s+(is\s+)?required\b/i,
      /\bcitizenship\s+required\b/i,
      /\bsecurity\s+clearance\b/i,
      // Broadened from requiring "active/current" as a prefix — postings often
      // phrase this as "obtain and maintain a DoD Secret Clearance" with no
      // active/current qualifier at all.
      /\b(secret|top\s*secret|ts\/sci|ts-sci)\s+clearance\b/i,
      /\bable\s+to\s+obtain\s+(a\s+)?security\s+clearance\b/i,
      // ITAR/export-control jargon — standard in aerospace & defense postings,
      // functionally excludes non-citizens/non-LPRs even without ever saying
      // "citizen." ITAR is unambiguous; "export control(led)" is specific
      // enough phrasing to avoid collateral matches on unrelated text.
      /\bITAR\b/i,
      /\bexport\s+control(led)?\s+regulations?\b/i,
      /\bexport\s+administration\s+regulations?\b/i,
      /\bgreen\s*card\s+(holders?\s+)?(required|preferred|only)\b/i,
      /\b(u\.?s\.?\s+)?permanent\s+resident(s)?\s+(only|required|preferred)\b/i,

      // "Proof of ..." framing — e.g. "Proof of U.S. Citizenship or U.S. Legal
      // Permanent Resident (LPR) is a requirement for this position."
      /\bproof\s+of\s+(u\.?s\.?\s+)?(citizenship|legal\s+permanent\s+resident(s)?|lpr)\b/i,

      // Explicit LPR / "U.S. Person" terms — LPR is the standard immigration
      // abbreviation for green-card holders; "U.S. Person" is the ITAR/export-
      // control term common in aerospace & defense postings (this JETS/NASA
      // posting is a case in point) and functionally excludes non-citizens/LPRs.
      /\bu\.?s\.?\s+legal\s+permanent\s+resident(s)?\b/i,
      /\(\s*lpr\s*\)/i,
      /\bu\.?s\.?\s+persons?\b/i,

      // Flexible same-sentence proximity match: citizenship/LPR term appearing
      // near a requirement-type word, in either order. Guarded with a
      // negative lookahead for "not/no/without" in between so a sentence like
      // "citizenship is NOT required" (the opposite signal) doesn't misfire.
      /(u\.?s\.?\s+citizenship|legal\s+permanent\s+resident(s)?|permanent\s+residency|\blpr\b|u\.?s\.?\s+persons?)\b(?![^.]{0,150}\b(not|no|without|n't)\b)[^.]{0,150}\b(is\s+a\s+requirement|required|must\s+possess|mandatory)\b/i,
      // "requires?" added as a trigger word to catch verb-first phrasing like
      // "This position requires US Citizenship or Permanent Resident status"
      // (the original set only covered "citizenship required"/noun phrasing,
      // not "requires citizenship"). Needs its own negation guard on BOTH
      // sides -- "requires" is commonly negated as "does not require X"
      // (negation BEFORE the trigger), unlike "required"/"mandatory" which
      // are typically negated as "X is not required" (negation AFTER).
      /(?<!\b(not|no|never|won't|doesn't|don't)\s{0,20})\b(requirement\s+for\s+this\s+position|must\s+possess|mandatory|requires?)\b(?![^.]{0,150}\b(not|no|without|n't)\b)[^.]{0,150}(u\.?s\.?\s+citizenship|legal\s+permanent\s+resident(s)?|permanent\s+residency|\blpr\b|u\.?s\.?\s+persons?)/i
    ]
  },
  NO_SPONSORSHIP: {
    label: 'No Sponsorship Offered',
    colorClass: 'no-sponsorship',
    regexes: [
      /\b(will\s+not|won't|does\s+not|doesn't|cannot|can't|unable\s+to|not\s+able\s+to)\s+(provide|offer|sponsor)\s+(visa\s+)?sponsorship\b/i,
      // "no H-1B sponsorship will be provided" — the original pattern only
      // allowed an optional "visa" between "no" and "sponsorship", not a visa
      // type like "H-1B".
      /\bno\s+(h-?1b\s+)?(visa\s+)?sponsorship\b/i,
      /\bsponsorship\s+(is\s+)?not\s+(available|offered|provided)\b/i,
      // Generalized from requiring the literal subject "we" -- postings just
      // as often name the company directly ("TestEquity does not sponsor
      // applicants for work visas"), and this already matches regardless of
      // what follows "sponsor" since there's no further constraint on the object.
      /\b(will\s+not|won't|does\s+not|doesn't|do\s+not|don't|cannot|can't)\s+sponsor\b/i,
      /\bnot\s+sponsoring\s+visas?\b/i,
      // Bare "without sponsorship" -- e.g. "authorized to work in the US
      // without sponsorship" -- wasn't covered by any existing pattern; the
      // others all required a specific negated verb immediately before it.
      /\bwithout\s+(visa\s+)?sponsorship\b/i,
      /\bmust\s+not\s+require\s+(visa\s+)?sponsorship\b/i,
      /\bnot\s+eligible\s+for\s+(visa\s+)?sponsorship\b/i,
      /\b(do(es)?\s+not|don't|won't)\s+offer\s+(h-?1b\s*)?(visa\s*)?transfers?\b/i
    ]
  },
  SPONSORSHIP_AVAILABLE: {
    label: 'Visa Sponsorship Available',
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

// Boilerplate EEO/anti-discrimination footer ("...without regard to race,
// color, ..., citizenship status...") almost every posting includes. It's
// never a genuine visa-sponsorship signal, but it does contain trigger words
// like "citizenship" -- strip it out before matching so it can't false-positive.
const EEO_DISCLAIMER_PATTERN =
  /\b(without regard to|regardless of|irrespective of)\b[^.]{0,150}\b(race|color|religion|sex|national origin|disability|veteran)\b[^.]*\./gi;

// Soft hyphens (U+00AD) and zero-width characters (U+200B, U+FEFF) can split
// a word invisibly (e.g. a soft hyphen pasted into the middle of
// "sponsorship") so it silently fails to match \bsponsorship\b. Regular
// non-breaking spaces (U+00A0) don't need handling here -- JS's \s already
// matches them -- but these characters aren't whitespace, so they need to be
// stripped outright rather than normalized to a space. Built via RegExp with
// string escapes (not a literal regex with embedded invisible characters) so
// the source file itself only ever contains plain, reviewable ASCII.
const INVISIBLE_CHARS_PATTERN = new RegExp('[\\u00AD\\u200B\\uFEFF]', 'g');

function normalizeText(text) {
  return text.replace(INVISIBLE_CHARS_PATTERN, '').replace(EEO_DISCLAIMER_PATTERN, ' ');
}

const NON_PERIOD_DELIMITERS = ['\n', '\r', '•', '\t'];

// A period immediately preceded by a single capital letter is almost always
// part of an abbreviation ("U.S.", "U.K.") rather than a real sentence break.
// Without this check, evidence text gets cut off mid-abbreviation (e.g.
// "...complete a U" instead of "...complete a U.S. government background
// investigation").
function isAbbreviationPeriod(str, periodIndex) {
  const prev = str[periodIndex - 1];
  return !!prev && /[A-Z]/.test(prev);
}

// The nearest REAL (non-abbreviation) period at or before `fromIndex`,
// searching backward.
function lastRealPeriod(str, fromIndex) {
  let idx = fromIndex;
  while (idx >= 0) {
    idx = str.lastIndexOf('.', idx);
    if (idx === -1) return -1;
    if (!isAbbreviationPeriod(str, idx)) return idx;
    idx -= 1;
  }
  return -1;
}

// The nearest REAL (non-abbreviation) period at or after `fromIndex`,
// searching forward.
function firstRealPeriod(str, fromIndex) {
  let idx = fromIndex;
  while (idx < str.length) {
    idx = str.indexOf('.', idx);
    if (idx === -1) return -1;
    if (!isAbbreviationPeriod(str, idx)) return idx;
    idx += 1;
  }
  return -1;
}

// Find the delimiter closest to (but before) the match, so the sentence
// starts right after it. Bulleted requirement lists ("Essential Requirements
// \n Must be a U.S. Citizen...") put a line break IMMEDIATELY before the
// match, which a $-anchored regex search treats as "no match found" (since
// there's no run of non-delimiter characters ending at the very end of the
// slice) and silently falls back to index 0 -- showing the start of the
// entire scraped page as "evidence" instead of the actual matched sentence.
// Scanning each delimiter with lastIndexOf and taking the closest one avoids
// that edge case entirely.
function findSentenceStart(leftSlice) {
  const candidates = [lastRealPeriod(leftSlice, leftSlice.length - 1), ...NON_PERIOD_DELIMITERS.map((d) => leftSlice.lastIndexOf(d))];
  const closest = Math.max(...candidates);
  return closest === -1 ? 0 : closest + 1;
}

function findSentenceEnd(rightSlice) {
  const candidates = [firstRealPeriod(rightSlice, 0), ...NON_PERIOD_DELIMITERS.map((d) => rightSlice.indexOf(d))].filter(
    (i) => i !== -1
  );
  return candidates.length ? Math.min(...candidates) : -1;
}

export function getSentenceContaining(text, matchIndex, matchLength) {
  const safeIndex = Math.max(0, Math.min(matchIndex, text.length));
  const safeLength = Math.max(1, matchLength || 1);

  const start = findSentenceStart(text.slice(0, safeIndex));

  const rightSlice = text.slice(safeIndex + safeLength);
  const endOffset = findSentenceEnd(rightSlice);
  const end = endOffset === -1 ? text.length : safeIndex + safeLength + endOffset;

  const sentence = text.slice(start, end).replace(/\s+/g, ' ').trim();
  return sentence.length > 200 ? sentence.slice(0, 200) + '…' : sentence;
}

export function classify(rawText) {
  if (!rawText || !rawText.trim() || rawText.length < 50) {
    return {
      status: 'UNREADABLE',
      label: 'Unable to Parse Page',
      colorClass: 'none',
      evidence: 'Could not detect job description text on this view.'
    };
  }

  const text = normalizeText(rawText);

  for (const key of PRIORITY_ORDER) {
    const category = PATTERNS[key];
    for (const regex of category.regexes) {
      regex.lastIndex = 0;
      const match = regex.exec(text);
      if (match) {
        return {
          status: key,
          label: category.label,
          colorClass: category.colorClass,
          evidence: getSentenceContaining(text, match.index, match[0].length)
        };
      }
    }
  }

  return {
    status: 'NOT_MENTIONED',
    label: 'Sponsorship Not Mentioned',
    colorClass: 'none',
    evidence: 'The job posting does not explicitly mention visa sponsorship or citizenship requirements.'
  };
}
