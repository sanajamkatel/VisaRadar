import restricted from '../assets/us_citizen_clearance_required.png';
import noSponsorship from '../assets/no_sponsership_offered.png';
import sponsorshipAvailable from '../assets/visa_sponsership_available.png';
import ambiguous from '../assets/work_authorized_required.png';
import notMentioned from '../assets/sponsership_not_mentioned.png';

// No custom icon for UNREADABLE (rare fallback when the page text can't be
// read at all) — consumers should handle that key being absent.
export const STATUS_ICON_PATHS = {
  RESTRICTED: restricted,
  NO_SPONSORSHIP: noSponsorship,
  SPONSORSHIP_AVAILABLE: sponsorshipAvailable,
  AMBIGUOUS: ambiguous,
  NOT_MENTIONED: notMentioned
};
