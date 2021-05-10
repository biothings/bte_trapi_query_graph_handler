const QNode = require("../../src/query_node");
const QEdge = require("../../src/query_edge");
const QExeEdge = require("../../src/query_execution_edge")
const BatchEdgeQueryHandler = require("../../src/batch_edge_query");
const meta_kg = require("@biothings-explorer/smartapi-kg");

describe("Testing BatchEdgeQueryHandler Module", () => {
    const kg = new meta_kg.default();
    kg.constructMetaKGSync();

    describe("Testing query function", () => {
        // test("test with one query edge", async () => {
        //     let gene_node1 = new QNode("n1", { category: "Gene", id: "NCBIGene:1017" });
        //     let chemical_node1 = new QNode("n3", { category: "ChemicalSubstance" });
        //     const edge1 = new QEdge("e01", { subject: gene_node1, object: chemical_node1 });
        //     const exeEdge1 = new QExeEdge(edge1, false, undefined);
        //     const batchHandler = new BatchEdgeQueryHandler(kg);
        //     batchHandler.setEdges([edge1]);
        //     expect(chemical_node1.hasEquivalentIDs()).toEqual(false);
        //     const res = await batchHandler.query([edge1]);
        //     expect(res.length).toBeGreaterThan(1);
        //     expect(chemical_node1.hasEquivalentIDs()).toEqual(true);
        // })

        test("test subscribe and unsubscribe function", () => {
            const batchHandler = new BatchEdgeQueryHandler(kg);
            batchHandler.subscribe(1);
            batchHandler.subscribe(2);
            batchHandler.subscribe(3);
            expect(batchHandler.subscribers).toContain(2);
            batchHandler.unsubscribe(2);
            expect(batchHandler.subscribers).not.toContain(2);
        })


    })


})