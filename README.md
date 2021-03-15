# BioThings Explorer TRAPI Query Graph Handler

A on-the-fly query engine for BioThings Explorer based on TRAPI Query Graph.

[![Test Coveralls](https://github.com/kevinxin90/bte_trapi_query_graph_handler/actions/workflows/coverage.yml/badge.svg)](https://github.com/kevinxin90/bte_trapi_query_graph_handler/actions/workflows/coverage.yml)
[![Coverage Status](https://coveralls.io/repos/github/kevinxin90/bte_trapi_query_graph_handler/badge.svg?branch=main)](https://coveralls.io/github/kevinxin90/bte_trapi_query_graph_handler?branch=main)

## Install

```bash
npm i @biothings-explorer/query_graph_handler
```

## Usage

### Making a single hop query

```javascript
const handler = require("@biothings-explorer/query_graph_handler");
const queryHandler = new handler.TRAPIQueryHandler();
const oneHopQuery = {
    "message": {
        "query_graph": {
            "edges": {
                "e00": {
                    "object": "n01",
                    "subject": "n00",
                    "predicate": "biolink:functional_association"
                }
            },
            "nodes": {
                "n00": {
                    "category": "biolink:Gene",
                    "id": "ENSEMBL:ENSG00000123374"
                },
                "n01": {
                    "category": "biolink:BiologicalProcess"
                }
            }
        }
    }
}
await queryHandler.query();
console.log(queryHandler.getResponse())
```

<details>
 <summary> Example Result</summary>

```json
{
    "message": {
        "query_graph": {
            "edges": {
                "e00": {
                    "object": "n01",
                    "subject": "n00",
                    "predicate": "biolink:enables"
                }
            },
            "nodes": {
                "n00": {
                    "category": "biolink:Gene",
                    "id": "ENSEMBL:ENSG00000123374"
                },
                "n01": {
                    "category": "biolink:BiologicalProcess"
                }
            }
        },
        "knowledge_graph": {
            "nodes": {
                "NCBIGENE:1017": {
                    "category": "biolink:Gene",
                    "name": "CDK2",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "NCBIGENE:1017",
                                "name:cyclin dependent kinase 2",
                                "SYMBOL:CDK2",
                                "UMLS:C1332733",
                                "UMLS:C0108855",
                                "HGNC:1771",
                                "UniProtKB:P24941",
                                "ENSEMBL:ENSG00000123374",
                                "OMIM:116953"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0000082": {
                    "category": "biolink:BiologicalProcess",
                    "name": "G1/S transition of mitotic cell cycle",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0000082",
                                "name:G1/S transition of mitotic cell cycle"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0000086": {
                    "category": "biolink:BiologicalProcess",
                    "name": "G2/M transition of mitotic cell cycle",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0000086",
                                "name:G2/M transition of mitotic cell cycle"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0006260": {
                    "category": "biolink:BiologicalProcess",
                    "name": "DNA replication",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0006260",
                                "name:DNA replication"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0006281": {
                    "category": "biolink:BiologicalProcess",
                    "name": "DNA repair",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0006281",
                                "name:DNA repair"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0006468": {
                    "category": "biolink:BiologicalProcess",
                    "name": "protein phosphorylation",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0006468",
                                "name:protein phosphorylation"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0006977": {
                    "category": "biolink:BiologicalProcess",
                    "name": "DNA damage response, signal transduction by p53 class mediator resulting in cell cycle arrest",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0006977",
                                "name:DNA damage response, signal transduction by p53 class mediator resulting in cell cycle arrest"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0007099": {
                    "category": "biolink:BiologicalProcess",
                    "name": "centriole replication",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0007099",
                                "name:centriole replication"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0007165": {
                    "category": "biolink:BiologicalProcess",
                    "name": "signal transduction",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0007165",
                                "name:signal transduction"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0007265": {
                    "category": "biolink:BiologicalProcess",
                    "name": "Ras protein signal transduction",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0007265",
                                "name:Ras protein signal transduction"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0008284": {
                    "category": "biolink:BiologicalProcess",
                    "name": "positive regulation of cell population proliferation",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0008284",
                                "name:positive regulation of cell population proliferation"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0010389": {
                    "category": "biolink:BiologicalProcess",
                    "name": "regulation of G2/M transition of mitotic cell cycle",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0010389",
                                "name:regulation of G2/M transition of mitotic cell cycle"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0010468": {
                    "category": "biolink:BiologicalProcess",
                    "name": "regulation of gene expression",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0010468",
                                "name:regulation of gene expression"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0016572": {
                    "category": "biolink:BiologicalProcess",
                    "name": "histone phosphorylation",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0016572",
                                "name:histone phosphorylation"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0018105": {
                    "category": "biolink:BiologicalProcess",
                    "name": "peptidyl-serine phosphorylation",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0018105",
                                "name:peptidyl-serine phosphorylation"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0031145": {
                    "category": "biolink:BiologicalProcess",
                    "name": "anaphase-promoting complex-dependent catabolic process",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0031145",
                                "name:anaphase-promoting complex-dependent catabolic process"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0031571": {
                    "category": "biolink:BiologicalProcess",
                    "name": "mitotic G1 DNA damage checkpoint",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0031571",
                                "name:mitotic G1 DNA damage checkpoint"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0051298": {
                    "category": "biolink:BiologicalProcess",
                    "name": "centrosome duplication",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0051298",
                                "name:centrosome duplication"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0051301": {
                    "category": "biolink:BiologicalProcess",
                    "name": "cell division",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0051301",
                                "name:cell division"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0051321": {
                    "category": "biolink:BiologicalProcess",
                    "name": "meiotic cell cycle",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0051321",
                                "name:meiotic cell cycle"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0060968": {
                    "category": "biolink:BiologicalProcess",
                    "name": "regulation of gene silencing",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0060968",
                                "name:regulation of gene silencing"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:0071732": {
                    "category": "biolink:BiologicalProcess",
                    "name": "cellular response to nitric oxide",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:0071732",
                                "name:cellular response to nitric oxide"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                },
                "GO:1901796": {
                    "category": "biolink:BiologicalProcess",
                    "name": "regulation of signal transduction by p53 class mediator",
                    "attributes": [
                        {
                            "name": "equivalent_identifiers",
                            "value": [
                                "GO:1901796",
                                "name:regulation of signal transduction by p53 class mediator"
                            ],
                            "type": "biolink:id"
                        }
                    ]
                }
            },
            "edges": {
                "NCBIGENE:1017-GO:0000082-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0000082",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "G1/S transition of mitotic cell cycle",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0000086-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0000086",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "NAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "G2/M transition of mitotic cell cycle",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:1653904"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0006260-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0006260",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "DNA replication",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:19238148"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0006281-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0006281",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IEA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "DNA repair",
                            "type": "bts:term"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0006468-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0006468",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "protein phosphorylation",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0006977-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0006977",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "DNA damage response, signal transduction by p53 class mediator resulting in cell cycle arrest",
                            "type": "bts:term"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0007099-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0007099",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IMP",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "centriole replication",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:26297806"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0007165-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0007165",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "signal transduction",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0007265-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0007265",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IEP",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "Ras protein signal transduction",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:9054499"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0008284-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0008284",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "positive regulation of cell population proliferation",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0010389-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0010389",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "regulation of G2/M transition of mitotic cell cycle",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0010468-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0010468",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IBA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "regulation of gene expression",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21873635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0016572-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0016572",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IDA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "histone phosphorylation",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:11746698"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0018105-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0018105",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IDA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "peptidyl-serine phosphorylation",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:23184662"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0031145-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0031145",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "anaphase-promoting complex-dependent catabolic process",
                            "type": "bts:term"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0031571-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0031571",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "mitotic G1 DNA damage checkpoint",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:21319273"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0051298-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0051298",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "centrosome duplication",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:19238148"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0051301-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0051301",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IEA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "cell division",
                            "type": "bts:term"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0051321-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0051321",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "meiotic cell cycle",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:19238148"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0060968-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0060968",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "IDA",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "regulation of gene silencing",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:20935635"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:0071732-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:0071732",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "cellular response to nitric oxide",
                            "type": "bts:term"
                        },
                        {
                            "name": "publications",
                            "value": [
                                "PMID:20079829"
                            ],
                            "type": "biolink:publications"
                        }
                    ]
                },
                "NCBIGENE:1017-GO:1901796-MyGene.info API-entrez": {
                    "predicate": "biolink:enables",
                    "subject": "NCBIGENE:1017",
                    "object": "GO:1901796",
                    "attributes": [
                        {
                            "name": "provided_by",
                            "value": "entrez",
                            "type": "biolink:provided_by"
                        },
                        {
                            "name": "api",
                            "value": "MyGene.info API",
                            "type": "bts:api"
                        },
                        {
                            "name": "evidence",
                            "value": "TAS",
                            "type": "bts:evidence"
                        },
                        {
                            "name": "term",
                            "value": "regulation of signal transduction by p53 class mediator",
                            "type": "bts:term"
                        }
                    ]
                }
            }
        },
        "results": [
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0000082"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0000082-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0000082"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0000082-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0000086"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0000086-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0000086"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0000086-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006260"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006260-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006281"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006281-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006468"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006468-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006468"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006468-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006468"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006468-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0006977"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0006977-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0007099"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0007099-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0007165"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0007165-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0007265"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0007265-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0008284"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0008284-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0008284"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0008284-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0010389"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0010389-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0010468"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0010468-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0016572"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0016572-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0018105"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0018105-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0031145"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0031145-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0031571"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0031571-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0051298"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0051298-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0051301"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0051301-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0051321"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0051321-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0060968"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0060968-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:0071732"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:0071732-MyGene.info API-entrez"
                        }
                    ]
                }
            },
            {
                "node_bindings": {
                    "n00": [
                        {
                            "id": "NCBIGENE:1017"
                        }
                    ],
                    "n01": [
                        {
                            "id": "GO:1901796"
                        }
                    ]
                },
                "edge_bindings": {
                    "e00": [
                        {
                            "id": "NCBIGENE:1017-GO:1901796-MyGene.info API-entrez"
                        }
                    ]
                }
            }
        ]
    },
    "logs": [
        {
            "timestamp": "2021-03-15T22:48:10.757Z",
            "level": "DEBUG",
            "message": "BTE identified 2 QNodes from your query graph",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.757Z",
            "level": "DEBUG",
            "message": "BTE identified 1 QEdges from your query graph",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.757Z",
            "level": "DEBUG",
            "message": "BTE identified your query graph as a 1-depth query graph",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.757Z",
            "level": "DEBUG",
            "message": "REDIS cache is not enabled.",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.797Z",
            "level": "DEBUG",
            "message": "BTE found 1 smartapi edges corresponding to e00. These smartaip edges comes from 1 unique APIs. They are MyGene.info API",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.808Z",
            "level": "DEBUG",
            "message": "BTE found 1 bte edges for this batch.",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.808Z",
            "level": "DEBUG",
            "message": "call-apis: Resolving ID feature is turned on",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.808Z",
            "level": "DEBUG",
            "message": "call-apis: Number of BTE Edges received is 1",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.828Z",
            "level": "DEBUG",
            "message": "call-apis: Succesfully made the following query: {\"url\":\"https://mygene.info/v3/query\",\"params\":{\"fields\":\"go.BP\"},\"data\":\"q=1017&scopes=entrezgene\",\"method\":\"post\",\"timeout\":50000}",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.839Z",
            "level": "DEBUG",
            "message": "call-apis: After transformation, BTE is able to retrieve 27 hits!",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.839Z",
            "level": "DEBUG",
            "message": "call-apis: Total number of results returned for this query is 27",
            "code": null
        },
        {
            "timestamp": "2021-03-15T22:48:10.857Z",
            "level": "DEBUG",
            "message": "call-apis: Query completes",
            "code": null
        }
    ]
}
```
</details>