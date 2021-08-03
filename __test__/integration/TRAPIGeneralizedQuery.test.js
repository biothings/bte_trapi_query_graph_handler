
const TRAPIQueryHandler = require("../../src/index");

describe("Testing TRAPI QueryHandler Generalized Query Handling", () => {

    const OneHopQuery = {
        nodes: {
            n0: {
                "ids":["PUBCHEM.COMPOUND:2662"],
                "categories":["biolink:ChemicalSubstance"]
            },
            n1: {
                "categories":["biolink:Gene"],
                   "ids":["HGNC:9604"]
           }
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            }
        }
    };

    describe("Testing query function", () => {
        test("test with one hop query edge from specific entities", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(OneHopQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes).length).toBe(2);
            expect(res.message.knowledge_graph.nodes).toHaveProperty("NCBIGene:5742");
            expect(res.message.knowledge_graph.nodes).toHaveProperty("CHEBI:41423");
        })
    })

})