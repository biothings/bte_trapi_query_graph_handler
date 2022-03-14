const graph = require("../../../src/graph/graph");

describe("Test graph class", () => {
    const qNode1 = {
        getID() { return "qg1" }
    }
    const qNode2 = {
        getID() { return "qg2" }
    }
    const record1 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qNode1 },
                getObject() { return qNode2 }
            },
            api_name: "API1",
            source: "source1",
            predicate: "predicate1"
        },
        publications: ["PMID:1", "PMID:2"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryCurie"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryCurie"
                }
            ]
        },
        relation: "relation1"
    }

    const record2 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qNode1 },
                getObject() { return qNode2 }
            },
            api_name: "API2",
            source: "source2",
            predicate: "predicate1"
        },
        publications: ["PMC:1", "PMC:2"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryCurie"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryCurie"
                }
            ]
        },
        relation: "relation2"
    }

    const record3 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qNode1 },
                getObject() { return qNode2 }
            },
            api_name: "API3",
            source: "source3",
            predicate: "predicate2"
        },
        publications: ["PMC:3", "PMC:4"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryCurie"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryCurie"
                }
            ]
        },
        relation: "relation3"
    }
    test("A single query result is correctly updated.", () => {
        const g = new graph();
        g.update([record1]);
        expect(g.nodes).toHaveProperty("outputPrimaryCurie-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryCurie-qg1");
        expect(g.nodes["outputPrimaryCurie-qg2"]._primaryCurie).toEqual("outputPrimaryCurie");
        expect(g.nodes["outputPrimaryCurie-qg2"]._qNodeID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceNodes)).toEqual(['inputPrimaryCurie-qg1']);
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceQNodeIDs)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryCurie-qg1"]._primaryCurie).toEqual("inputPrimaryCurie");
        expect(g.nodes["inputPrimaryCurie-qg1"]._qNodeID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetNodes)).toEqual(['outputPrimaryCurie-qg2']);
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetQNodeIDs)).toEqual(['qg2']);
        expect(g.edges).toHaveProperty('bbc3f6312167f869deadb1e092963ce3');
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['bbc3f6312167f869deadb1e092963ce3'].attributes).toHaveProperty('relation', 'relation1')
    })

    test("Multiple query results are correctly updated for two edges having same input, predicate and output", () => {
        const g = new graph();
        g.update([record1, record2]);
        expect(g.nodes).toHaveProperty("outputPrimaryCurie-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryCurie-qg1");
        expect(g.nodes["outputPrimaryCurie-qg2"]._primaryCurie).toEqual("outputPrimaryCurie");
        expect(g.nodes["outputPrimaryCurie-qg2"]._qNodeID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceNodes)).toEqual(['inputPrimaryCurie-qg1']);
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceQNodeIDs)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryCurie-qg1"]._primaryCurie).toEqual("inputPrimaryCurie");
        expect(g.nodes["inputPrimaryCurie-qg1"]._qNodeID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetNodes)).toEqual(['outputPrimaryCurie-qg2']);
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetQNodeIDs)).toEqual(['qg2']);

        expect(g.edges).toHaveProperty('bbc3f6312167f869deadb1e092963ce3');
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['bbc3f6312167f869deadb1e092963ce3'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('eb2323486762cf2292c689b13e330fed');
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['eb2323486762cf2292c689b13e330fed'].attributes).toHaveProperty('relation', 'relation2')
    })

    test("Multiple query results for different edges are correctly updated", () => {
        const g = new graph();
        g.update([record1, record2, record3]);
        expect(g.nodes).toHaveProperty("outputPrimaryCurie-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryCurie-qg1");
        expect(g.nodes["outputPrimaryCurie-qg2"]._primaryCurie).toEqual("outputPrimaryCurie");
        expect(g.nodes["outputPrimaryCurie-qg2"]._qNodeID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceNodes)).toEqual(['inputPrimaryCurie-qg1']);
        expect(Array.from(g.nodes["outputPrimaryCurie-qg2"]._sourceQNodeIDs)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryCurie-qg1"]._primaryCurie).toEqual("inputPrimaryCurie");
        expect(g.nodes["inputPrimaryCurie-qg1"]._qNodeID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetNodes)).toEqual(['outputPrimaryCurie-qg2']);
        expect(Array.from(g.nodes["inputPrimaryCurie-qg1"]._targetQNodeIDs)).toEqual(['qg2']);

        expect(g.edges).toHaveProperty('bbc3f6312167f869deadb1e092963ce3');
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['bbc3f6312167f869deadb1e092963ce3'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['bbc3f6312167f869deadb1e092963ce3'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('eb2323486762cf2292c689b13e330fed');
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['eb2323486762cf2292c689b13e330fed'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['eb2323486762cf2292c689b13e330fed'].attributes).toHaveProperty('relation', 'relation2')

        expect(g.edges).toHaveProperty('ffca0bf654c9ff5811e4c22a5b21c9b8');
        expect(Array.from(g.edges['ffca0bf654c9ff5811e4c22a5b21c9b8'].apis)).toEqual(['API3']);
        expect(Array.from(g.edges['ffca0bf654c9ff5811e4c22a5b21c9b8'].sources)).toEqual(['source3']);
        expect(Array.from(g.edges['ffca0bf654c9ff5811e4c22a5b21c9b8'].publications)).toEqual(['PMC:3', 'PMC:4']);
        expect(g.edges['ffca0bf654c9ff5811e4c22a5b21c9b8'].attributes).toHaveProperty('relation', 'relation3')
    })
})
