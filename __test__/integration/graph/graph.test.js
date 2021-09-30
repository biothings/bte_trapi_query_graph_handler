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
        expect(g.edges).toHaveProperty('0719696e40f7ef74a5899eaf308f5067');
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['0719696e40f7ef74a5899eaf308f5067'].attributes).toHaveProperty('relation', 'relation1')
    })

    test("Multiple query results are correctly updated for two edges having same input, predicate and output", () => {
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

        expect(g.edges).toHaveProperty('0719696e40f7ef74a5899eaf308f5067');
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['0719696e40f7ef74a5899eaf308f5067'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('00cc8c4fe1a391c243c3c3e762d1ea73');
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].attributes).toHaveProperty('relation', 'relation2')
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

        expect(g.edges).toHaveProperty('0719696e40f7ef74a5899eaf308f5067');
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['0719696e40f7ef74a5899eaf308f5067'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['0719696e40f7ef74a5899eaf308f5067'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('00cc8c4fe1a391c243c3c3e762d1ea73');
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['00cc8c4fe1a391c243c3c3e762d1ea73'].attributes).toHaveProperty('relation', 'relation2')

        expect(g.edges).toHaveProperty('13219cef22cc15f78b115b3e5859f7e9');
        expect(Array.from(g.edges['13219cef22cc15f78b115b3e5859f7e9'].apis)).toEqual(['API3']);
        expect(Array.from(g.edges['13219cef22cc15f78b115b3e5859f7e9'].sources)).toEqual(['source3']);
        expect(Array.from(g.edges['13219cef22cc15f78b115b3e5859f7e9'].publications)).toEqual(['PMC:3', 'PMC:4']);
        expect(g.edges['13219cef22cc15f78b115b3e5859f7e9'].attributes).toHaveProperty('relation', 'relation3')
    })
})
