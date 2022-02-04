const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');
const { ListFormat } = require('typescript');

class ResultMaker{
    constructor(query, number_of_results) {
        this.query = query;
        this.number_of_results = number_of_results || 1;
        this.result_template = {
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

            //create results equal to number_of_results
            for (let i = 0; i < this.number_of_results.length; i++) {
                let res = {...this.result_template};
                const input = new QNode(inputNodeID, inputNodeInfo);
                const output = new QNode(outputNodeID, outputNodeInfo);
                const trapi_edge = new QEdge(edgeID, { 'subject': input, 'object': output });

                //populate result template
                res.$edge_metadata.trapi_qEdge_obj = trapi_edge;
                res.$edge_metadata.api_name = this.generateAPIName();
                res.$edge_metadata.predicate= this.generatePredicate();
                // input
                res.$edge_metadata.$input.original = inputNodeInfo?.ids?.[0] || this.generateID();
                res.$edge_metadata.$input.obj[0].primaryID = inputNodeInfo?.ids?.[0] || this.generateID();
                // output
                res.$edge_metadata.$output.original = outputNodeInfo?.ids?.[0] || this.generateID();
                res.$edge_metadata.$output.obj[0].primaryID = outputNodeInfo?.ids?.[0] || this.generateID();
                //generated result for current edge
                this.results[edgeID]['records'].push(res);
            }

        }
    }

    generateAPIName(){
        return "MyAPI-" + Math.floor(Math.random() * 20) + 1;
    }

    generateID(){
        return "⚽️-" + Math.floor(Math.random() * 40) + 1;
    }

    generateID(){
        return "predicate-" + Math.floor(Math.random() * 20) + 1;
    }

    get generatedResults() {
        return this.results;
    }
}

describe('Testing QueryResults', () => {
    describe('query graph: 🍊-💧->🌸', () => {

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

        const manager =  new ResultMaker(query, 4);
        const organized_results = manager.generatedResults;

        const queryResult = new QueryResult();

        queryResult.update(organized_results);

        const results = queryResult.getResults();

        expect(results.length).toEqual(4);

        expect(Object.keys(results[0].node_bindings).length).toEqual(3);
        expect(results[0].node_bindings).toHaveProperty('n0');
        expect(results[0].node_bindings).toHaveProperty('n1');

        expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
        expect(results[0].edge_bindings).toHaveProperty('e0');

        expect(results[0]).toHaveProperty('score');
    });
});
