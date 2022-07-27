const QueryGraphHandler = require("../../src/query_graph");
const QNode2 = require("../../src/query_node");
const QEdge = require("../../src/query_edge");
const InvalidQueryGraphError = require("../../src/exceptions/invalid_query_graph_error");

describe("Testing QueryGraphHandler Module", () => {
    const disease_entity_node = {
        categories: ["biolink:Disease"],
        ids: ["MONDO:0005737"]
    };
    const gene_entity_node = {
        categories: ["biolink:Gene"],
        ids: ["NCBIGene:1017"]
    };
    const gene_class_node = {
        categories: ["biolink:Gene"]
    };
    const chemical_class_node = {
        categories: ["biolink:SmallMolecule"]
    };
    const pathway_class_node = {
        categories: ["biolink:Pathways"]
    };
    const phenotype_class_node = {
        categories: ["biolink:Phenotype"]
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

    const ThreeHopExplainQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: gene_entity_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                subject: "n1",
                object: "n2"
            },
            e03: {
                subject: "n2",
                object: "n3"
            }
        }
    };

    const FourHopQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
            n4: pathway_class_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                subject: "n1",
                object: "n2"
            },
            e03: {
                subject: "n2",
                object: "n3"
            },
            e04: {
                subject: "n3",
                object: "n4"
            },
        }
    };

    const QueryWithCycle1 = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
            n4: pathway_class_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                subject: "n1",
                object: "n2"
            },
            e03: {
                subject: "n2",
                object: "n3"
            },
            e04: {
                subject: "n3",
                object: "n4"
            },
            e05: {
              subject: "n4",
              object: "n1"
            },
        }
    };

    const QueryWithCycle2 = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
            n4: pathway_class_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                subject: "n1",
                object: "n2"
            },
            e03: {
                subject: "n2",
                object: "n3"
            },
            e04: {
                subject: "n3",
                object: "n4"
            },
            e05: {
              subject: "n4",
              object: "n1"
            },
        }
    };

    const QueryWithDuplicateEdge1 = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                subject: "n1",
                object: "n0"
            }
        }
    };

    describe("test _storeNodes function", () => {

        test("test if storeNodes with one hop query", async () => {
            let handler = new QueryGraphHandler(OneHopQuery);
            let nodes = await handler._storeNodes();
            expect(nodes).toHaveProperty("n0");
            expect(nodes).not.toHaveProperty("n2");
            expect(nodes.n0).toBeInstanceOf(QNode2);
        });

        test("test if storeNodes with multi hop query", async () => {
            let handler = new QueryGraphHandler(FourHopQuery);
            let nodes = await handler._storeNodes();
            expect(nodes).toHaveProperty("n0");
            expect(nodes).toHaveProperty("n3");
            expect(nodes.n0).toBeInstanceOf(QNode2);
            expect(nodes.n3).toBeInstanceOf(QNode2);
        });
    });

    describe("test _storeEdges function", () => {

        test("test storeEdges with one hop query", async () => {
            let handler = new QueryGraphHandler(OneHopQuery);
            let edges = await handler._storeEdges();
            expect(edges).toHaveProperty("e01");
            expect(edges).not.toHaveProperty("e02");
            expect(edges.e01).toBeInstanceOf(QEdge);
            expect(edges.e01.getSubject()).toBeInstanceOf(QNode2);
        });

        test("test storeEdges with multi hop query", async () => {
            let handler = new QueryGraphHandler(FourHopQuery);
            let edges = await handler._storeEdges();
            expect(edges).toHaveProperty("e01");
            expect(edges).toHaveProperty("e02");
            expect(edges.e01).toBeInstanceOf(QEdge);
        });
    });

    describe("test _createQueryPaths function", () => {

        test("test createQueryPaths with three hop explain query", async () => {
            let handler = new QueryGraphHandler(ThreeHopExplainQuery);
            let edges = await handler.calculateEdges();
            expect(Object.keys(edges)).toHaveLength(3);
            expect(edges[0]).toHaveLength(1);
            expect(edges[1]).toHaveLength(1);
            expect(edges[2]).toHaveLength(1);
        });
    });
    describe("test cycle/duplicate edge detection for query graphs", () => {
      test("Duplicate Edge Graph #1", async () => {
        const handler = new QueryGraphHandler(QueryWithDuplicateEdge1)
        expect(handler.calculateEdges()).rejects.toThrow(InvalidQueryGraphError)
      })
      test("Query Graph Cycle #1", async () => {
        const handler = new QueryGraphHandler(QueryWithCycle1)
        expect(handler.calculateEdges()).rejects.toThrow(InvalidQueryGraphError)
      })
      test("Query Graph Cycle #2", async () => {
        const handler = new QueryGraphHandler(QueryWithCycle2)
        expect(handler.calculateEdges()).rejects.toThrow(InvalidQueryGraphError)
      })
    })
});