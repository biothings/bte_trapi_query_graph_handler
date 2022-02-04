const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');
const { ListFormat } = require('typescript');

class ResultMaker{
    constructor(query, number_of_results) {
        this.query = query;
        this.number_of_results = number_of_results || 1;
        this.results = {};
        this.createResults();
    }

    createResults(){

        for (const edgeID in this.query.message.query_graph.edges) {
            // get node IDS
            const inputNodeID = this.query.message.query_graph.edges[edgeID].subject;
            const outputNodeID = this.query.message.query_graph.edges[edgeID].object;
            // get nodes info
            const inputNodeInfo = this.query.message.query_graph.nodes[inputNodeID];
            const outputNodeInfo = this.query.message.query_graph.nodes[outputNodeID];

            this.results[edgeID] = {
                "connected_to": [],
                "records": []
            }

            //other edges connected to current edge, provided in query for ease
            this.results[edgeID]['connected_to'] = this.query.message.query_graph.edges[edgeID]['$connected_to'];
            this.results[edgeID]['records'] = [];

            //create results per edge equal to number_of_results
            for (let i = 0; i < this.number_of_results; i++) {
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
                const input = new QNode(inputNodeID, inputNodeInfo);
                const output = new QNode(outputNodeID, outputNodeInfo);
                const trapi_edge = new QEdge(edgeID, { 'subject': input, 'object': output });

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

                if (outputNodeInfo?.ids) {
                    let randomID = outputNodeInfo?.ids[Math.floor(Math.random() * outputNodeInfo?.ids.length)];
                    // output
                    res['$output'].original = randomID;
                    res['$output'].obj[0].primaryID = randomID;
                }else{
                    res['$output'].original = this.generateID();
                    res['$output'].obj[0].primaryID = this.generateID();
                }
                //generated result for current edge
                this.results[edgeID]['records'].push(res);
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
    describe('One hop', () => {

        test('2 result 4 edge bindings', () => {
            let query = {
                "message": {
                    "query_graph": {
                        "nodes": {
                            "n0": {
                                "categories": ["🍊"],
                                "ids": [ "A"],
                                "is_set": false
                            },
                            "n1": {
                                "categories": ["🌸"],
                                "ids": ["B", "C"],
                                "is_set": false
                            }
                        },
                        "edges": {
                            "e0": {
                                "subject": "n0",
                                "object": "n1",
                                "predicates": ["💧"],
                                //to make this easier include this new property
                                "$connected_to": []
                            }
                        }
                    }
                }
            }
    
            const rm =  new ResultMaker(query, 4);
            const organized_results = rm.getOrganizedResults;
    
            const queryResult = new QueryResult();
    
            queryResult.update(organized_results);
    
            const results = queryResult.getResults();
    
            expect(results.length).toEqual(2);
    
            expect(Object.keys(results[0].node_bindings).length).toEqual(2);
            expect(results[0].node_bindings).toHaveProperty('n0');
            expect(results[0].node_bindings).toHaveProperty('n1');
    
            expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
            expect(results[0].edge_bindings).toHaveProperty('e0');
    
            expect(results[0]).toHaveProperty('score');
        });

    });
});
