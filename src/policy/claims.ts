// Claim policy — enforced mechanically by tools/scan-vocab.mjs and
// reviewed by humans for implied claims (word lists can't catch tone).
//
// RULE: user-visible strings must stay descriptive. Nothing here may
// weaken without editing docs/CLAIMS.md and bumping methodVersion.

export const BANNED_PATTERNS: RegExp[] = [
  /\binsider\b/i,
  /\bsybil\b|anti[- ]sybil/i,
  /\bcabal\b/i,
  /\bcoordinated\b|\bcoordination\b/i,
  /\borganic\b/i, // as a label for activity
  /\bfull[- ]coverage\b/i,
  /\bhoneypot\b/i,
  /\bcan'?t sell\b|cannot sell|exit[- ](viability|constrained|blocked)|exit liquidity risk/i,
  /\bguaranteed?\b/i,
  /\bproves?\b|\bproof of (coordination|ownership|intent)/i,
  /\bsafe\b|\brisky\b|\belevated\b|\bdanger\b|\bwarning level\b/i,
  /\brisk (score|level|rating|band)/i,
  /\bmanipulat/i,
  /\bwash trad/i,
  /\bscam\b/i,
];

// Allowed context: the policy files themselves and docs that *describe*
// the ban. scan-vocab skips these paths.
export const POLICY_OWN_PATHS = [
  "src/policy/claims.ts",
  "docs/CLAIMS.md",
  "docs/METHOD.md",
  "IMPLEMENTATION-PLAN.md",
  "README.md",
  "tools/scan-vocab.mjs",
  "fixtures-synthetic/",
];

// Phrases that ARE the product voice — kept here so copy stays uniform.
export const APPROVED_WORDING = {
  noBuy: "no buy observed in this sample",
  sellability: "sellability not tested",
  attributed: "attributed",
  observed: "observed",
  integrity: "integrity receipt — proves bytes unchanged since capture, not provider truth",
  unavailable: "unavailable",
  notReported: "not reported",
} as const;
