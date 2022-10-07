const TRAPIQueryHandler = require("../../src/index");

describe("Testing TRAPIQueryHandler Module", () => {
    const disease_entity_node = {
        categories: ["Disease"],
        ids: ["MONDO:0005737"]
    };
    const gene_class_node = {
        categories: ["Gene"]
    };
    const OneHopQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            }
        }
    };
    describe("Testing query function", () => {
        test("test with one query edge", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler({});
            queryHandler.setQueryGraph(OneHopQuery);
            await queryHandler.query();
            expect(queryHandler.knowledgeGraph.kg).toHaveProperty('nodes');
        })
    })


})