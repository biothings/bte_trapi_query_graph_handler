
const TRAPIQueryHandler = require("../../src/index");

describe("New Handler", () => {

    const OneHopQuery = {
        nodes: {
            n0: {
                "ids":["PUBCHEM.COMPOUND:2662"],
                "categories":["biolink:SmallMolecule"]
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

    

    describe("Query", () => {
        test("One Hop", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(OneHopQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes).length).toBe(2);
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("NCBIGene:5742");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("PUBCHEM.COMPOUND:2662");
        })
    })

    const TwoHopQuery = {
        "nodes": {
            "n0": {
                "ids":["PUBCHEM.COMPOUND:2662"],
                "categories":["biolink:SmallMolecule"]
            },
            "n1": {
                "categories":["biolink:Disease"]
            },
                "n2": {
                    "categories":["biolink:Gene"],
                    "ids":["HGNC:9604"]
            }
        },
        "edges": {
            "e0": {
                "subject": "n0",
                "object": "n1"
            },
            "e1": {
                "subject": "n2",
                "object": "n1"
            }
        }
    };

    describe("Query", () => {
        test("Two Hop", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(TwoHopQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes).length).toBeGreaterThan(2);
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("NCBIGene:5742");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("PUBCHEM.COMPOUND:2662");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("MONDO:0021668");
        })
    })


    const ThreeHopQuery = {
        "nodes": {
            "n0": {
                "ids":["PUBCHEM.COMPOUND:2662"],
                "categories":["biolink:SmallMolecule"]
            },
            "n1": {
                "categories":["biolink:Disease"]
           },
           "n2": {
                "categories":["biolink:Pathway"]
           },
            "n3": {
                "categories":["biolink:Gene"],
                   "ids":["HGNC:17947"]
           }
        },
        "edges": {
            "e0": {
                "subject": "n0",
                "object": "n1"
            },
            "e1": {
                "subject": "n1",
                "object": "n2"
            },
            "e2": {
                "subject": "n2",
                "object": "n3"
            }
        }
    }

    describe("Query", () => {
        test("Three Hop", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(ThreeHopQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes).length).toBeGreaterThan(4);
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("NCBIGene:117145");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("REACT:R-HSA-109704");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("MONDO:0018874");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("PUBCHEM.COMPOUND:2662");
        })
    })

    const BroadCategoryQuery = {
        "nodes": {
            "n0": {
                "categories": ["biolink:DiseaseOrPhenotypicFeature"]
            },
            "n1": {
                "ids": ["HGNC:6284"],
                "categories":["biolink:Gene"]
            }
        },
        "edges": {
            "e0": {
                "subject": "n0",
                "object": "n1"
            }
        }
    }

    describe("Query", () => {
        test("Branched Superset", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(BroadCategoryQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("NCBIGene:3778");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("MONDO:0005247");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("HP:0002465");
        })
    })

    const PredictQuery = {
        "nodes": {
            "n0": {
                "ids": ["NCBIGene:3778"],
                "categories": ["biolink:Gene"]
            },
            "n1": {
                "categories": [
                    "biolink:Disease",
                    "biolink:BiologicalProcess",
                    "biolink:Pathway"
                ]
            }
        },
        "edges": {
            "e01": {
                "subject": "n0",
                "object": "n1"
            }
        }
    }

    describe("Query", () => {
        test("Predict", async () => {
            const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler();
            queryHandler.setQueryGraph(PredictQuery);
            await queryHandler.query_2();
            let res = queryHandler.getResponse();
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("MONDO:0005030");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("NCBIGene:3778");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("GO:0001666");
            expect(Object.keys(res.message.knowledge_graph.nodes)).toContain("HP:0002465");
        })
    })

})