const BatchEdgeQueryHandler = require("../../src/batch_edge_query");
const meta_kg = require("@biothings-explorer/smartapi-kg");

describe("Testing BatchEdgeQueryHandler Module", () => {
    const kg = new meta_kg.default();
    kg.constructMetaKGSync();

    describe("Testing query function", () => {

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