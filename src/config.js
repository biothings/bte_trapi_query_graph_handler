exports.API_BATCH_SIZE = [
  // pending APIs with template-based querying (POST / batch-query IDs)
  {
    id: '1d288b3a3caf75d541ffaae3aab386c8',
    name: 'BioThings SEMMEDDB API',
    max: 100,
  },
  {
    id: '978fe380a147a8641caf72320862697b',
    name: 'Text Mining Targeted Association API',
    max: 100,
  },
  {
    id: '02af7d098ab304e80d6f4806c3527027',
    name: 'Multiomics Wellness KP API',
    max: 100,
  },
  {
    id: 'adf20dd6ff23dfe18e8e012bde686e31',
    name: 'Multiomics BigGIM-DrugResponse KP API',
    max: 100,
  },
];

// max node IDs an edge with no other IDs can have
exports.ENTITY_MAX = 1000

exports.EDGE_ATTRIBUTES_USED_IN_RECORD_HASH = [
  "biolink:has_disease_context",
  "biolink:GeneToDrugAssociation",
  // for multiomics wellness: subject to change
  "NCIT:C61594",          // bonferroni p-value: should be enough but not sure
  "UMLS CUI:C5418925",    // age range between 35 and 55
  "MeSH:D008297",         // gender male
  "UMLS CUI:C0043157",    // population white
  "MeSH:D005260",         // gender female
  "UMLS CUI:C2229974",    // children?
];
