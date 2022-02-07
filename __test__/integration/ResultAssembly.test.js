const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');

class ResultMaker{
    constructor(query) {
        this.query = query;
        this.results = {};
        this.createResults();
    }

    createResults(){

        for (const E_ID in this.query.message.query_graph.edges) {
            // get node IDS
            const I_ID = this.query.message.query_graph.edges[E_ID].subject;
            const O_ID = this.query.message.query_graph.edges[E_ID].object;
            // get nodes info
            const inputNodeInfo = this.query.message.query_graph.nodes[I_ID];
            const outputNodeInfo = this.query.message.query_graph.nodes[O_ID];

            this.results[E_ID] = {
                "connected_to": [],
                "records": []
            }

            //other edges connected to current edge, provided in query for ease
            this.results[E_ID]['connected_to'] = this.query.message.query_graph.edges[E_ID]['$connected_to'];
            this.results[E_ID]['records'] = [];

            //create results per edge equal to output IDs given
            for (let i = 0; i < outputNodeInfo.ids.length; i++) {
                //result template
                let res = {
                    '$edge_metadata': {
                        'trapi_qEdge_obj': null,
                        'predicate': null,
                        'api_name': null,
                    },
                    '$input': {
                        'original': null,
                        'obj': [{'primaryID': null}]
                    },
                    '$output': {
                        'original': null,
                        'obj': [{'primaryID': null}]
                    },
                };
                const input = new QNode(I_ID, inputNodeInfo);
                const output = new QNode(O_ID, outputNodeInfo);
                const trapi_edge = new QEdge(E_ID, { 'subject': input, 'object': output });

                //populate result template
                res.$edge_metadata.trapi_qEdge_obj = trapi_edge;
                res.$edge_metadata.api_name = this.generateAPIName();
                res.$edge_metadata.predicate= this.generatePredicate();
                
                if (inputNodeInfo?.ids) {
                    let randomID = inputNodeInfo?.ids[Math.floor(Math.random() * inputNodeInfo?.ids.length)];
                    // input
                    res['$input'].original = randomID;
                    res['$input'].obj[0].primaryID = randomID;
                }else{
                    res['$input'].original = this.generateID();
                    res['$input'].obj[0].primaryID = this.generateID();
                }

                if (outputNodeInfo?.ids?.[i]) {
                    // output
                    res['$output'].original = outputNodeInfo?.ids[i];
                    res['$output'].obj[0].primaryID = outputNodeInfo?.ids[i];
                }else{
                    res['$output'].original = this.generateID();
                    res['$output'].obj[0].primaryID = this.generateID();
                }

                // if (inputNodeInfo?.ids) {
                //     let randomID = inputNodeInfo?.ids[Math.floor(Math.random() * inputNodeInfo?.ids.length)];
                //     // input
                //     res['$input'].original = randomID;
                //     res['$input'].obj[0].primaryID = randomID;
                // }else{
                //     res['$input'].original = this.generateID();
                //     res['$input'].obj[0].primaryID = this.generateID();
                // }

                // if (outputNodeInfo?.ids) {
                //     let randomID = outputNodeInfo?.ids[Math.floor(Math.random() * outputNodeInfo?.ids.length)];
                //     // output
                //     res['$output'].original = randomID;
                //     res['$output'].obj[0].primaryID = randomID;
                // }else{
                //     res['$output'].original = this.generateID();
                //     res['$output'].obj[0].primaryID = this.generateID();
                // }
                //generated result for current edge
                this.results[E_ID]['records'].push(res);
            }

        }
    }

    generateAPIName(){
        return "MyAPI-" + Math.floor(Math.random() * 20) + 1;
    }

    generateID(){
        return "ID-" + Math.floor(Math.random() * 40) + 1;
    }

    generatePredicate(){
        return "predicate-" + Math.floor(Math.random() * 20) + 1;
    }

    get getOrganizedResults() {
        return this.results;
    }
}

describe('Testing QueryResults', () => {
    describe('0 hop Q', () => {

        test('1 result A-B', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["PREDICATE-X"],
                                //to make this easier include this new property
                                "$connected_to": []
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(1);
            expect(results[0].node_bindings).toHaveProperty('n0');
            expect(results[0].node_bindings).toHaveProperty('n1');
            expect(results[0].edge_bindings).toHaveProperty('e0');
            expect(results[0]).toHaveProperty('score');
        });

        test('4 results [A-B, A-C, A-D, A-E]', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B", "C", "D", "E"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["PREDICATE-X"],
                                //to make this easier include this new property
                                "$connected_to": []
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(4);

            expect(Object.keys(results[0].node_bindings).sort()).toEqual([
            'n0', 'n1'
            ]);
            expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
            'e0'
            ]);
            expect(results[0]).toHaveProperty('score');

            expect(Object.keys(results[1].node_bindings).sort()).toEqual([
            'n0', 'n1'
            ]);
            expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
            'e0'
            ]);
            expect(results[1]).toHaveProperty('score');

            expect(Object.keys(results[2].node_bindings).sort()).toEqual([
            'n0', 'n1'
            ]);
            expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
            'e0'
            ]);
            expect(results[2]).toHaveProperty('score');

            expect(Object.keys(results[3].node_bindings).sort()).toEqual([
            'n0', 'n1'
            ]);
            expect(Object.keys(results[3].edge_bindings).sort()).toEqual([
            'e0'
            ]);
            expect(results[3]).toHaveProperty('score');
        });

        test('1 result (A-B * 4)', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B", "B", "B", "B"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["PREDICATE-X"],
                                //to make this easier include this new property
                                "$connected_to": []
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(1);

            expect(Object.keys(results[0].node_bindings).sort()).toEqual([
            'n0', 'n1'
            ]);
            expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
            'e0'
            ]);
            expect(results[0]).toHaveProperty('score');

           
        });

        test('1 result 2 edge bindings A-(X,Y)-B', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B", "B"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["PREDICATE-X"],
                                //to make this easier include this new property
                                "$connected_to": []
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(1);

            expect(Object.keys(results[0].node_bindings).sort()).toEqual(['n0', 'n1']);
            expect(Object.keys(results[0].edge_bindings).sort()).toEqual(['e0']);
            expect(results[0].edge_bindings['e0'].length).toEqual(2);
            expect(results[0]).toHaveProperty('score');

           
        });

        test('1 result is_set A-(B,C,D)', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B", "C", "D"],
                                "is_set": true
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                //to make this easier include this new property
                                "$connected_to": []
                            },
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();

            expect(results.length).toEqual(1);
    
            expect(Object.keys(results[0].node_bindings).length).toEqual(2);
            expect(results[0].node_bindings).toHaveProperty('n0');
            expect(results[0].node_bindings).toHaveProperty('n1');

            expect(Object.keys(results[0].edge_bindings['e0']).length).toEqual(3);
            expect(results[0].edge_bindings).toHaveProperty('e0');

            expect(results[0]).toHaveProperty('score');
        });

    });

    describe('1 hop Q', () => {

        test('1 result A-B-C', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B"],
                                "is_set": false
                            },
                            "n2": {
                                "categories": ["CATEGORY-3"],
                                "ids": [ "C"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                //to make this easier include this new property
                                "$connected_to": ['e1']
                            },
                            "e1": {
                                "subject": "n1",
                                "object": "n2",
                                //to make this easier include this new property
                                "$connected_to": ['e0']
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(1);

            expect(Object.keys(results[0].node_bindings).length).toEqual(3);
            expect(results[0].node_bindings).toHaveProperty('n0');
            expect(results[0].node_bindings).toHaveProperty('n1');
            expect(results[0].node_bindings).toHaveProperty('n2');

            expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
            expect(results[0].edge_bindings).toHaveProperty('e0');
            expect(results[0].edge_bindings).toHaveProperty('e1');

            expect(results[0]).toHaveProperty('score');
        });

    });

    describe('1 hop branched Q', () => {

        test('2 result [A-B-C, A-B-D]', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["CATEGORY-1"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["CATEGORY-2"],
                                "ids": [ "B"],
                                "is_set": false
                            },
                            "n2": {
                                "categories": ["CATEGORY-3"],
                                "ids": [ "C", "D"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                //to make this easier include this new property
                                "$connected_to": ['e1']
                            },
                            "e1": {
                                "subject": "n1",
                                "object": "n2",
                                //to make this easier include this new property
                                "$connected_to": ['e0']
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query);
            const organized_results = rm.getOrganizedResults;
            const queryResult = new QueryResult();

            queryResult.update(organized_results);
            const results = queryResult.getResults();

            expect(results.length).toEqual(2);
    
            expect(Object.keys(results[0].node_bindings).length).toEqual(3);
            expect(results[0].node_bindings).toHaveProperty('n0');
            expect(results[0].node_bindings).toHaveProperty('n1');
            expect(results[0].node_bindings).toHaveProperty('n2');

            expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
            expect(results[0].edge_bindings).toHaveProperty('e0');
            expect(results[0].edge_bindings).toHaveProperty('e1');

            expect(results[0]).toHaveProperty('score');

            expect(Object.keys(results[1].node_bindings).length).toEqual(3);
            expect(results[1].node_bindings).toHaveProperty('n0');
            expect(results[1].node_bindings).toHaveProperty('n2');
            expect(results[1].node_bindings).toHaveProperty('n2');

            expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
            expect(results[1].edge_bindings).toHaveProperty('e0');
            expect(results[1].edge_bindings).toHaveProperty('e1');

            expect(results[1]).toHaveProperty('score');
        });

    });

});
