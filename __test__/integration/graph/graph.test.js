const graph = require("../../../src/graph/graph");
const { Record } = require("@biothings-explorer/api-response-transform");

describe("Test graph class", () => {
    const qNode1 = {
        getID() { return "qg1" }
    }
    const qNode2 = {
        getID() { return "qg2" }
    }
    const record1 = new Record({
        api: "API1",
        metaEdgeSource: "source1",
        predicate: "predicate1",
        object: {
            qNodeID: 'qg2',
            curie: "outputPrimaryCurie"
        },
        subject: {
            qNodeID: 'qg1',
            curie: "inputPrimaryCurie"

        },
        publications: ["PMID:1", "PMID:2"],
        mappedResponse: {
            relation: "relation1"
        }
    })

    const record2 = new Record({
        api: "API2",
        metaEdgeSource: "source2",
        predicate: "predicate1",
        object: {
            qNodeID: 'qg2',
            curie: "outputPrimaryCurie"
        },
        subject: {
            qNodeID: 'qg1',
            curie: "inputPrimaryCurie"
        },
        publications: ["PMC:1", "PMC:2"],
        mappedResponse: {
            relation: "relation2"
        }
    })

    const record3 = new Record({
        api: "API3",
        metaEdgeSource: "source3",
        predicate: "predicate2",
        object: {
            qNodeID: 'qg2',
            curie: "outputPrimaryCurie"
        },
        subject: {
            qNodeID: 'qg1',
            curie: "inputPrimaryCurie"
        },
        publications: ["PMC:3", "PMC:4"],
        mappedResponse: {
            relation: "relation3"
        }
    })

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
        expect(g.edges).toHaveProperty('ead33fce1d19dc004679aa389eca7ff4');
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['ead33fce1d19dc004679aa389eca7ff4'].attributes).toHaveProperty('relation', 'relation1')
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

        expect(g.edges).toHaveProperty('ead33fce1d19dc004679aa389eca7ff4');
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['ead33fce1d19dc004679aa389eca7ff4'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('37a029a060de5df47516d73e7d2a0d19');
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['37a029a060de5df47516d73e7d2a0d19'].attributes).toHaveProperty('relation', 'relation2')
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

        expect(g.edges).toHaveProperty('ead33fce1d19dc004679aa389eca7ff4');
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].apis)).toEqual(['API1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].sources)).toEqual(['source1']);
        expect(Array.from(g.edges['ead33fce1d19dc004679aa389eca7ff4'].publications)).toEqual(['PMID:1', 'PMID:2']);
        expect(g.edges['ead33fce1d19dc004679aa389eca7ff4'].attributes).toHaveProperty('relation', 'relation1')

        expect(g.edges).toHaveProperty('37a029a060de5df47516d73e7d2a0d19');
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].apis)).toEqual(['API2']);
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].sources)).toEqual(['source2']);
        expect(Array.from(g.edges['37a029a060de5df47516d73e7d2a0d19'].publications)).toEqual(['PMC:1', 'PMC:2']);
        expect(g.edges['37a029a060de5df47516d73e7d2a0d19'].attributes).toHaveProperty('relation', 'relation2')

        expect(g.edges).toHaveProperty('30b7230795a102faeac8fe417b477524');
        expect(Array.from(g.edges['30b7230795a102faeac8fe417b477524'].apis)).toEqual(['API3']);
        expect(Array.from(g.edges['30b7230795a102faeac8fe417b477524'].sources)).toEqual(['source3']);
        expect(Array.from(g.edges['30b7230795a102faeac8fe417b477524'].publications)).toEqual(['PMC:3', 'PMC:4']);
        expect(g.edges['30b7230795a102faeac8fe417b477524'].attributes).toHaveProperty('relation', 'relation3')
    })
})
