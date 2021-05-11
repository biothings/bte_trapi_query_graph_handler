const QueryGraphHandler = require("../../src/query_graph");
const QNode = require("../../src/query_node");
const QEdge = require("../../src/query_edge");
const InvalidQueryGraphError = require("../../src/exceptions/invalid_query_graph_error");

describe("Testing QueryGraphHandler Module", () => {
    const disease_entity_node = {
        categories: "biolink:Disease",
        ids: "MONDO:0005737"
    };
    const gene_entity_node = {
        categories: "biolink:Gene",
        ids: "NCBIGene:1017"
    };
    const gene_class_node = {
        categories: "biolink:Gene"
    };
    const chemical_class_node = {
        categories: "biolink:ChemicalSubstance"
    };
    const pathway_class_node = {
        categories: "biolink:Pathways"
    };
    const phenotype_class_node = {
        categories: "biolink:Phenotype"
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

    const OneHopQueryReverse = {
        nodes: {
            n1: disease_entity_node,
            n0: gene_class_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            }
        }
    };

    const TwoHopQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
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
        }
    };

    const TwoHopQueryReversed = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
        },
        edges: {
            e01: {
                object: "n0",
                subject: "n1"
            },
            e02: {
                object: "n1",
                subject: "n2"
            },
        }
    };

    const OneHopExplainQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: chemical_class_node,
            n2: gene_entity_node,
        },
        edges: {
            e01: {
                subject: "n0",
                object: "n1"
            },
            e02: {
                object: "n1",
                subject: "n2"
            },
        }
    };

    const TwoHopExplainQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: chemical_class_node,
            n2: gene_class_node,
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
            },
        }
    };

    const TwoHopBranchedQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
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
                subject: "n1",
                object: "n3"
            }
        }
    };

    const ThreeHopQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
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

    const ThreeHopMixedQuery = {
        nodes: {
            n0: disease_entity_node,
            n1: gene_class_node,
            n2: chemical_class_node,
            n3: phenotype_class_node,
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
                subject: "n0",
                object: "n2"
            },
            e04: {
                subject: "n2",
                object: "n3"
            },
        }
    };

    describe("test _storeNodes function", () => {

        test("test if storeNodes with one hop query", async () => {
            let handler = new QueryGraphHandler(OneHopQuery);
            let nodes = handler._storeNodes();
            expect(nodes).toHaveProperty("n0");
            expect(nodes).not.toHaveProperty("n2");
            expect(nodes.n0).toBeInstanceOf(QNode);
        });

        test("test if storeNodes with multi hop query", async () => {
            let handler = new QueryGraphHandler(FourHopQuery);
            let nodes = handler._storeNodes();
            expect(nodes).toHaveProperty("n0");
            expect(nodes).toHaveProperty("n3");
            expect(nodes.n0).toBeInstanceOf(QNode);
            expect(nodes.n3).toBeInstanceOf(QNode);
        });
    });

    describe("test _storeEdges function", () => {

        test("test storeEdges with one hop query", async () => {
            let handler = new QueryGraphHandler(OneHopQuery);
            let edges = handler._storeEdges();
            expect(edges).toHaveProperty("e01");
            expect(edges).not.toHaveProperty("e02");
            expect(edges.e01).toBeInstanceOf(QEdge);
            expect(edges.e01.getSubject()).toBeInstanceOf(QNode);
        });

        test("test storeEdges with multi hop query", async () => {
            let handler = new QueryGraphHandler(FourHopQuery);
            let edges = handler._storeEdges();
            expect(edges).toHaveProperty("e01");
            expect(edges).toHaveProperty("e02");
            expect(edges.e01).toBeInstanceOf(QEdge);
        });
    });

    // describe("test _findFirstLevelEdges function", () => {

    //     test("test findFirstLevelEdges with one hop query", async () => {
    //         let handler = new QueryGraphHandler(OneHopQuery);
    //         let edges = handler._findFirstLevelEdges();
    //         expect(edges).toHaveProperty("paths");
    //         expect(edges.paths).toHaveLength(1);
    //         expect(edges).toHaveProperty("edge_mapping");
    //         expect(edges.edge_mapping.n0.nodes).toHaveLength(1);
    //         expect(edges.edge_mapping.n0.nodes[0].getID()).toEqual("n1");
    //     });

    //     test("test findFirstLevelEdges with multi hop query", async () => {
    //         let handler = new QueryGraphHandler(FourHopQuery);
    //         let edges = handler._findFirstLevelEdges();
    //         expect(edges).toHaveProperty("paths");
    //         expect(edges.paths).toHaveLength(1);
    //         expect(edges).toHaveProperty("edge_mapping");
    //         expect(edges.edge_mapping.n0.nodes).toHaveLength(1);
    //     });

    //     test("test findFirstLevelEdges with reversed one hop query", async () => {
    //         let handler = new QueryGraphHandler(OneHopQueryReverse);
    //         let edges = handler._findFirstLevelEdges();
    //         expect(edges).toHaveProperty("paths");
    //         expect(edges.paths).toHaveLength(1);
    //         expect(edges).toHaveProperty("edge_mapping");
    //         expect(edges.edge_mapping.n1.nodes).toHaveLength(1);
    //         expect(edges.edge_mapping.n1.nodes[0].getID()).toEqual("n0")
    //     });

    //     test("test findFirstLevelEdges with one hop explain query", async () => {
    //         let handler = new QueryGraphHandler(OneHopExplainQuery);
    //         let edges = handler._findFirstLevelEdges();
    //         expect(edges).toHaveProperty("paths");
    //         expect(edges.paths).toHaveLength(2);
    //         expect(edges).toHaveProperty("edge_mapping");
    //         expect(edges.edge_mapping.n0.nodes).toHaveLength(1);
    //         expect(edges.edge_mapping.n0.nodes[0].getID()).toEqual("n1");
    //         expect(edges.edge_mapping.n2.nodes).toHaveLength(1);
    //         expect(edges.edge_mapping.n2.nodes[0].getID()).toEqual("n1");
    //     });
    // });

    describe("test _createQueryPaths function", () => {

        // test("test createQueryPaths with one hop query", async () => {
        //     let handler = new QueryGraphHandler(OneHopQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(1);
        // });

        // test("test createQueryPaths with two hop query", async () => {
        //     let handler = new QueryGraphHandler(TwoHopQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(2);
        // });

        // test("test createQueryPaths with two hop query reversed", async () => {
        //     let handler = new QueryGraphHandler(TwoHopQueryReversed);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(2);
        // });

        // test("test createQueryPaths with three hop query", async () => {
        //     let handler = new QueryGraphHandler(ThreeHopQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(3);
        // });

        // test("test createQueryPaths with four hop query", async () => {
        //     const handler = new QueryGraphHandler(FourHopQuery);
        //     console.log("query graph", handler.queryGraph);
        //     expect(() => {
        //         handler.createQueryPaths();
        //     }).toThrowError(new InvalidQueryGraphError("Your Query Graph exceeds the maximum query depth set in bte, which is 3"));
        // });

        // test("test createQueryPaths with one hop explain query", async () => {
        //     let handler = new QueryGraphHandler(OneHopExplainQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(2);
        //     expect(edges[0]).toHaveLength(2);
        //     expect(edges[1]).toHaveLength(2);
        // });

        // test("test createQueryPaths with two hop explain query", async () => {
        //     let handler = new QueryGraphHandler(TwoHopExplainQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(3);
        //     expect(edges[0]).toHaveLength(2);
        //     expect(edges[1]).toHaveLength(2);
        //     expect(edges[2]).toHaveLength(2);
        // });

        // test("test createQueryPaths with two hop branched query", async () => {
        //     let handler = new QueryGraphHandler(TwoHopBranchedQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(2);
        //     expect(edges[0]).toHaveLength(1);
        //     expect(edges[1]).toHaveLength(2);
        // });

        // test("test createQueryPaths with three hop mixed query", async () => {
        //     let handler = new QueryGraphHandler(ThreeHopMixedQuery);
        //     let edges = handler.createQueryPaths();
        //     expect(Object.keys(edges)).toHaveLength(3);
        //     expect(edges[0]).toHaveLength(2);
        //     expect(edges[1]).toHaveLength(2);
        //     expect(edges[2]).toHaveLength(1);
        // });

        test("test createQueryPaths with three hop explain query", async () => {
            let handler = new QueryGraphHandler(ThreeHopExplainQuery);
            let edges = handler.createQueryPaths();
            expect(Object.keys(edges)).toHaveLength(3);
            expect(edges[0]).toHaveLength(2);
            expect(edges[1]).toHaveLength(2);
            expect(edges[2]).toHaveLength(2);
        });
    });
});