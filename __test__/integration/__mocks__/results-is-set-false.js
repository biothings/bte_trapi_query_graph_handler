// {
//     "message": {
//         "query_graph": {
//             "nodes": {
//                 "n0": {
//                     "categories": [
//                         "biolink:Disease"
//                     ],
//                     "ids": [
//                         "MONDO:0013433",
//                         "MONDO:0019340"
//                     ],
//                     "is_set": true
//                 },
//                 "n1": {
//                     "categories": [
//                         "biolink:SmallMolecule"
//                     ],
//                     "is_set": false
//                 }
//             },
//             "edges": {
//                 "e0": {
//                     "subject": "n0",
//                     "object": "n1"
//                 }
//             }
//         }
//     }
// }

// 4 results from (2 ids as set) to unique ids

const results = {
    'e00': {
        'connected_to': [],
        'records':[
            {
                "$edge_metadata":{
                   "input_id":"UMLS",
                   "input_type":"Disease",
                   "output_id":"UMLS",
                   "output_type":"SmallMolecule",
                   "predicate":"treated_by",
                   "source":"infores:semmeddb",
                   "api_name":"BioThings SEMMEDDB API",
                   "trapi_qEdge_obj":{
                      "qEdge":{
                         "id":"e00",
                         "subject":{
                            "id":"n0",
                            "category":[
                               "biolink:Disease"
                            ],
                            "curie":[
                               "MONDO:0013433",
                               "MONDO:0019340"
                            ],
                            "is_set":false,
                            "entity_count":2
                         },
                         "object":{
                            "id":"n1",
                            "category":[
                               "biolink:SmallMolecule"
                            ],
                            "is_set":false,
                            "entity_count":558
                         }
                      },
                      "reverse":false,
                      "object":{
                         "id":"n1",
                         "category":[
                            "biolink:SmallMolecule"
                         ],
                         "is_set":false
                      },
                      "subject":{
                         "id":"n0",
                         "category":[
                            "biolink:Disease"
                         ],
                         "curie":[
                            "MONDO:0013433",
                            "MONDO:0019340"
                         ],
                         "is_set":false
                      },
                      "executed":true,
                      "results":"$results"
                   }
                },
                "$input":{
                   "original":"MONDO:0013433",
                   "obj":[
                      {
                         "id":{
                            "identifier":"MONDO:0013433",
                            "label":"primary sclerosing cholangitis"
                         },
                         "type":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ],
                         "primaryID":"MONDO:0013433",
                         "label":"primary sclerosing cholangitis",
                         "semanticType":"Disease",
                         "_leafSemanticType":"Disease",
                         "semanticTypes":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ]
                      }
                   ]
                },
                "$output":{
                   "original":"UMLS:001",
                   "obj":[
                      {
                         "id":{
                            "identifier":"UMLS:001",
                            "label":"UMLS:001"
                         },
                         "primaryID":"UMLS:001",
                         "label":"UMLS:001",
                         "semanticType":"SmallMolecule",
                         "_leafSemanticType":"SmallMolecule",
                         "type":[
                            "SmallMolecule"
                         ],
                         "semanticTypes":[
                            "SmallMolecule"
                         ]
                      }
                    ]
                }
            },
            {
                "$edge_metadata":{
                   "input_id":"UMLS",
                   "input_type":"Disease",
                   "output_id":"UMLS",
                   "output_type":"SmallMolecule",
                   "predicate":"treated_by",
                   "source":"infores:semmeddb",
                   "api_name":"BioThings SEMMEDDB API",
                   "trapi_qEdge_obj":{
                      "qEdge":{
                         "id":"e00",
                         "subject":{
                            "id":"n0",
                            "category":[
                               "biolink:Disease"
                            ],
                            "curie":[
                               "MONDO:0013433",
                               "MONDO:0019340"
                            ],
                            "is_set":false,
                            "entity_count":2
                         },
                         "object":{
                            "id":"n1",
                            "category":[
                               "biolink:SmallMolecule"
                            ],
                            "is_set":false,
                            "entity_count":558
                         }
                      },
                      "reverse":false,
                      "object":{
                         "id":"n1",
                         "category":[
                            "biolink:SmallMolecule"
                         ],
                         "is_set":false
                      },
                      "subject":{
                         "id":"n0",
                         "category":[
                            "biolink:Disease"
                         ],
                         "curie":[
                            "MONDO:0013433",
                            "MONDO:0019340"
                         ],
                         "is_set":false
                      },
                      "executed":true,
                      "results":"$results"
                   }
                },
                "$input":{
                   "original":"MONDO:0019340",
                   "obj":[
                      {
                         "id":{
                            "identifier":"MONDO:0019340",
                            "label":"primary sclerosing cholangitis"
                         },
                         "type":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ],
                         "primaryID":"MONDO:0019340",
                         "label":"primary sclerosing cholangitis",
                         "semanticType":"Disease",
                         "_leafSemanticType":"Disease",
                         "semanticTypes":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ]
                      }
                   ]
                },
                "$output":{
                   "original":"UMLS:002",
                   "obj":[
                      {
                         "id":{
                            "identifier":"UMLS:002",
                            "label":"UMLS:002"
                         },
                         "primaryID":"UMLS:002",
                         "label":"UMLS:002",
                         "semanticType":"SmallMolecule",
                         "_leafSemanticType":"SmallMolecule",
                         "type":[
                            "SmallMolecule"
                         ],
                         "semanticTypes":[
                            "SmallMolecule"
                         ]
                      }
                    ]
                }
            },
            {
                "$edge_metadata":{
                   "input_id":"UMLS",
                   "input_type":"Disease",
                   "output_id":"UMLS",
                   "output_type":"SmallMolecule",
                   "predicate":"treated_by",
                   "source":"infores:semmeddb",
                   "api_name":"BioThings SEMMEDDB API",
                   "trapi_qEdge_obj":{
                      "qEdge":{
                         "id":"e00",
                         "subject":{
                            "id":"n0",
                            "category":[
                               "biolink:Disease"
                            ],
                            "curie":[
                               "MONDO:0013433",
                               "MONDO:0019340"
                            ],
                            "is_set":false,
                            "entity_count":2
                         },
                         "object":{
                            "id":"n1",
                            "category":[
                               "biolink:SmallMolecule"
                            ],
                            "is_set":false,
                            "entity_count":558
                         }
                      },
                      "reverse":false,
                      "object":{
                         "id":"n1",
                         "category":[
                            "biolink:SmallMolecule"
                         ],
                         "is_set":false
                      },
                      "subject":{
                         "id":"n0",
                         "category":[
                            "biolink:Disease"
                         ],
                         "curie":[
                            "MONDO:0013433",
                            "MONDO:0019340"
                         ],
                         "is_set":false
                      },
                      "executed":true,
                      "results":"$results"
                   }
                },
                "$input":{
                   "original":"MONDO:0013433",
                   "obj":[
                      {
                         "id":{
                            "identifier":"MONDO:0013433",
                            "label":"primary sclerosing cholangitis"
                         },
                         "type":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ],
                         "primaryID":"MONDO:0013433",
                         "label":"primary sclerosing cholangitis",
                         "semanticType":"Disease",
                         "_leafSemanticType":"Disease",
                         "semanticTypes":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ]
                      }
                   ]
                },
                "$output":{
                   "original":"UMLS:003",
                   "obj":[
                      {
                         "id":{
                            "identifier":"UMLS:003",
                            "label":"UMLS:003"
                         },
                         "primaryID":"UMLS:003",
                         "label":"UMLS:003",
                         "semanticType":"SmallMolecule",
                         "_leafSemanticType":"SmallMolecule",
                         "type":[
                            "SmallMolecule"
                         ],
                         "semanticTypes":[
                            "SmallMolecule"
                         ]
                      }
                    ]
                }
            },
            {
                "$edge_metadata":{
                   "input_id":"UMLS",
                   "input_type":"Disease",
                   "output_id":"UMLS",
                   "output_type":"SmallMolecule",
                   "predicate":"treated_by",
                   "source":"infores:semmeddb",
                   "api_name":"BioThings SEMMEDDB API",
                   "trapi_qEdge_obj":{
                      "qEdge":{
                         "id":"e00",
                         "subject":{
                            "id":"n0",
                            "category":[
                               "biolink:Disease"
                            ],
                            "curie":[
                               "MONDO:0013433",
                               "MONDO:0019340"
                            ],
                            "is_set":false,
                            "entity_count":2
                         },
                         "object":{
                            "id":"n1",
                            "category":[
                               "biolink:SmallMolecule"
                            ],
                            "is_set":false,
                            "entity_count":558
                         }
                      },
                      "reverse":false,
                      "object":{
                         "id":"n1",
                         "category":[
                            "biolink:SmallMolecule"
                         ],
                         "is_set":false
                      },
                      "subject":{
                         "id":"n0",
                         "category":[
                            "biolink:Disease"
                         ],
                         "curie":[
                            "MONDO:0013433",
                            "MONDO:0019340"
                         ],
                         "is_set":false
                      },
                      "executed":true,
                      "results":"$results"
                   }
                },
                "$input":{
                   "original":"MONDO:0013433",
                   "obj":[
                      {
                         "id":{
                            "identifier":"MONDO:0013433",
                            "label":"primary sclerosing cholangitis"
                         },
                         "type":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ],
                         "primaryID":"MONDO:0013433",
                         "label":"primary sclerosing cholangitis",
                         "semanticType":"Disease",
                         "_leafSemanticType":"Disease",
                         "semanticTypes":[
                            "biolink:Disease",
                            "biolink:DiseaseOrPhenotypicFeature",
                            "biolink:BiologicalEntity",
                            "biolink:NamedThing",
                            "biolink:Entity",
                            "biolink:ThingWithTaxon"
                         ]
                      }
                   ]
                },
                "$output":{
                   "original":"UMLS:004",
                   "obj":[
                      {
                         "id":{
                            "identifier":"UMLS:004",
                            "label":"UMLS:004"
                         },
                         "primaryID":"UMLS:004",
                         "label":"UMLS:004",
                         "semanticType":"SmallMolecule",
                         "_leafSemanticType":"SmallMolecule",
                         "type":[
                            "SmallMolecule"
                         ],
                         "semanticTypes":[
                            "SmallMolecule"
                         ]
                      }
                    ]
                }
            },
        ]
    }
}

module.exports = results;