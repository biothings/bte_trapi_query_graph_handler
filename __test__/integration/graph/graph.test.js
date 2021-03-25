const graph = require("../../../src/graph/graph");

describe("Test graph class", () => {
    const qgNode1 = {
        getID() { return "qg1" }
    }
    const qgNode2 = {
        getID() { return "qg2" }
    }
    const record1 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qgNode1 },
                getObject() { return qgNode2 }
            },
            api_name: "API1",
            source: "source1",
            predicate: "predicate1"
        },
        publications: ["PMID:1", "PMID:2"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryID"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryID"
                }
            ]
        },
        relation: "relation1"
    }

    const record2 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qgNode1 },
                getObject() { return qgNode2 }
            },
            api_name: "API2",
            source: "source2",
            predicate: "predicate1"
        },
        publications: ["PMC:1", "PMC:2"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryID"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryID"
                }
            ]
        },
        relation: "relation2"
    }

    const record3 = {
        $edge_metadata: {
            trapi_qEdge_obj: {
                isReversed() { return false },
                getSubject() { return qgNode1 },
                getObject() { return qgNode2 }
            },
            api_name: "API3",
            source: "source3",
            predicate: "predicate2"
        },
        publications: ["PMC:3", "PMC:4"],
        $output: {
            obj: [
                {
                    primaryID: "outputPrimaryID"
                }
            ]
        },
        $input: {
            obj: [
                {
                    primaryID: "inputPrimaryID"
                }
            ]
        },
        relation: "relation3"
    }
    test("A single query result is correctly updated.", () => {
        const g = new graph();
        g.update([record1]);
        expect(g.nodes).toHaveProperty("outputPrimaryID-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryID-qg1");
        expect(g.nodes["outputPrimaryID-qg2"]._primaryID).toEqual("outputPrimaryID");
        expect(g.nodes["outputPrimaryID-qg2"]._qgID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceNodes)).toEqual(['inputPrimaryID-qg1']);
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceQGNodes)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryID-qg1"]._primaryID).toEqual("inputPrimaryID");
        expect(g.nodes["inputPrimaryID-qg1"]._qgID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetNodes)).toEqual(['outputPrimaryID-qg2']);
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetQGNodes)).toEqual(['qg2']);
        expect(g.edges).toHaveProperty('inputPrimaryID-biolink:predicate1-outputPrimaryID');
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].attributes).toHaveProperty('relation', 'relation1')
    })

    test("Multiple query results for same edge are correctly updated", () => {
        const g = new graph();
        g.update([record1, record2]);
        expect(g.nodes).toHaveProperty("outputPrimaryID-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryID-qg1");
        expect(g.nodes["outputPrimaryID-qg2"]._primaryID).toEqual("outputPrimaryID");
        expect(g.nodes["outputPrimaryID-qg2"]._qgID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceNodes)).toEqual(['inputPrimaryID-qg1']);
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceQGNodes)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryID-qg1"]._primaryID).toEqual("inputPrimaryID");
        expect(g.nodes["inputPrimaryID-qg1"]._qgID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetNodes)).toEqual(['outputPrimaryID-qg2']);
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetQGNodes)).toEqual(['qg2']);
        expect(g.edges).toHaveProperty('inputPrimaryID-biolink:predicate1-outputPrimaryID');
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].apis)).toEqual(['API1', 'API2']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].sources)).toEqual(['source1', 'source2']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].publications)).toEqual(['PMID:1', 'PMID:2', 'PMC:1', 'PMC:2']);
        expect(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].attributes).toHaveProperty('relation', 'relation2')
    })

    test("Multiple query results for different edges are correctly updated", () => {
        const g = new graph();
        g.update([record1, record2, record3]);
        expect(g.nodes).toHaveProperty("outputPrimaryID-qg2");
        expect(g.nodes).toHaveProperty("inputPrimaryID-qg1");
        expect(g.nodes["outputPrimaryID-qg2"]._primaryID).toEqual("outputPrimaryID");
        expect(g.nodes["outputPrimaryID-qg2"]._qgID).toEqual("qg2");
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceNodes)).toEqual(['inputPrimaryID-qg1']);
        expect(Array.from(g.nodes["outputPrimaryID-qg2"]._sourceQGNodes)).toEqual(['qg1']);
        expect(g.nodes["inputPrimaryID-qg1"]._primaryID).toEqual("inputPrimaryID");
        expect(g.nodes["inputPrimaryID-qg1"]._qgID).toEqual("qg1");
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetNodes)).toEqual(['outputPrimaryID-qg2']);
        expect(Array.from(g.nodes["inputPrimaryID-qg1"]._targetQGNodes)).toEqual(['qg2']);
        expect(g.edges).toHaveProperty('inputPrimaryID-biolink:predicate1-outputPrimaryID');
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].apis)).toEqual(['API1', 'API2']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].sources)).toEqual(['source1', 'source2']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].publications)).toEqual(['PMID:1', 'PMID:2', 'PMC:1', 'PMC:2']);
        expect(g.edges['inputPrimaryID-biolink:predicate1-outputPrimaryID'].attributes).toHaveProperty('relation', 'relation2');
        expect(g.edges).toHaveProperty('inputPrimaryID-biolink:predicate2-outputPrimaryID');
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate2-outputPrimaryID'].apis)).toEqual(['API3']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate2-outputPrimaryID'].sources)).toEqual(['source3']);
        expect(Array.from(g.edges['inputPrimaryID-biolink:predicate2-outputPrimaryID'].publications)).toEqual(['PMC:3', 'PMC:4']);
        expect(g.edges['inputPrimaryID-biolink:predicate2-outputPrimaryID'].attributes).toHaveProperty('relation', 'relation3')
    })
})