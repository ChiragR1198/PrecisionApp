/** AI Matchmaking option lists — keep in sync with backend MATCH_* constants */

export const MATCH_COMPANY_TYPES = [
  'Biopharma / Pharma sponsor',
  'Biotech',
  'Medical device company',
  'CRO / FSP',
  'CDMO / CMO',
  'Technology / Software vendor',
  'Lab / Diagnostics',
  'Logistics / 3PL / 4PL',
  'Consulting',
  'Site network / Investigator site',
  'Academic / Research institute',
  'Investor',
  'Other',
];

export const MATCH_SENIORITY = [
  'C-level / VP',
  'Director',
  'Manager / Lead',
  'Scientist / Specialist',
  'Consultant',
  'Other',
];

export const MATCH_VISIBILITY_MAP = {
  everyone: 'Everyone in this event',
  sponsors_only: 'Sponsors only',
  delegates_only: 'Delegates only',
  hidden: 'Hidden from matches',
};

export const MATCH_AVAILABILITY = [
  'Yes — open to meetings',
  'Limited slots',
  'Not available',
];

export const MATCH_DELEGATE_GOALS = [
  'Evaluate solutions / vendors',
  'Buy / shortlist providers',
  'Learn / education',
  'Peer benchmarking',
  'Find partners',
  'Recruit / hire',
  'Invest / fundraising',
  'Network generally',
];

export const MATCH_FUNCTIONS = [
  'Clinical Operations',
  'Trial Delivery',
  'Clinical Development',
  'Data Management',
  'Biostatistics',
  'Digital / Innovation',
  'Patient Engagement',
  'Site Management',
  'Quality',
  'Regulatory',
  'Safety / Pharmacovigilance',
  'Clinical Supply',
  'Supply Chain',
  'Logistics',
  'Procurement',
  'R&D',
  'Product Management',
  'Commercial Strategy',
  'Other',
];

export const MATCH_TOPICS = [
  'Trial design',
  'Clinical operations',
  'Site selection',
  'Site networks',
  'Patient recruitment / retention',
  'Diversity in trials',
  'Decentralized / hybrid trials',
  'eConsent',
  'eCOA / ePRO',
  'EDC',
  'CTMS',
  'eTMF',
  'Clinical data',
  'Interoperability',
  'RBQM / risk-based quality',
  'Monitoring',
  'Biostatistics',
  'Medical writing',
  'Regulatory',
  'Pharmacovigilance',
  'Trial supply',
  'Labs',
  'Imaging',
  'AI / analytics in trials',
  'Cold chain',
  'Clinical supply',
  'Packaging',
  'Warehousing',
  'Serialization / traceability',
  'Inventory visibility',
];

export const MATCH_SOLUTIONS = [
  'CRO / FSP',
  'Site network',
  'eClinical technology',
  'Patient recruitment',
  'Central lab',
  'Imaging',
  'Data / analytics',
  'Decentralized trial services',
  'Consulting',
  'Training',
  'Clinical supply / logistics',
  '3PL / 4PL',
  'Cold-chain packaging',
  'Data logger / IoT',
  'Warehouse automation',
  'Planning software',
  'Serialization',
  'Freight',
  'Customs',
  'Courier',
  'Packaging engineering',
];

export const MATCH_SPONSOR_TOPICS = [...new Set([...MATCH_TOPICS, ...MATCH_SOLUTIONS])];

export function normalizeTagList(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map((v) => String(v).trim()).filter(Boolean);
  }
  return String(value)
    .split(',')
    .map((v) => v.trim())
    .filter(Boolean);
}
