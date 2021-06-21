const QNode = require("../../src/query_node");
const QEdge = require("../../src/query_edge");
const QueryResult = require("../../src/query_results");

describe("Testing QueryResults Module", () => {
    describe("Single Record", () => {
        const gene_node1 = new QNode("n1", { categories: "Gene", ids: "NCBIGene:1017" });
        const chemical_node1 = new QNode("n3", { categories: "ChemicalSubstance" });
        const edge1 = new QEdge("e01", { subject: gene_node1, object: chemical_node1 });
        const record = {
            "$edge_metadata": {
                trapi_qEdge_obj: edge1,
                source: "DGIdb",
                api_name: "BioThings DGIDB API"
            },
            "publications": ['PMID:123', 'PMID:1234'],
            "interactionType": "inhibitor",
            "$input": {
                original: "SYMBOL:CDK2",
                obj: [{
                    primaryID: 'NCBIGene:1017',
                    label: "CDK2",
                    dbIDs: {
                        SYMBOL: "CDK2",
                        NCBIGene: "1017"
                    },
                    curies: ['SYMBOL:CDK2', 'NCBIGene:1017']
                }]
            },
            "$output": {
                original: "CHEMBL.COMPOUND:CHEMBL744",
                obj: [{
                    primaryID: 'CHEMBL.COMPOUND:CHEMBL744',
                    label: "RILUZOLE",
                    dbIDs: {
                        "CHEMBL.COMPOUND": "CHEMBL744",
                        "PUBCHEM": "1234",
                        "name": "RILUZOLE"
                    },
                    curies: ['CHEMBL.COMPOUND:CHEMBL744', 'PUBCHEM:1234', "name:RILUZOLE"]
                }]
            },
        }
        describe("Testing _createNodeBindings function", () => {
            test("test when input with string, should output a hash of 40 characters", () => {
                const queryResult = new QueryResult();
                const res = queryResult._createNodeBindings(record);
                expect(res).toHaveProperty("n1");
                expect(res).toHaveProperty("n3");
                expect(res.n1[0].id).toEqual("NCBIGene:1017");
                expect(res.n3[0].id).toEqual("CHEMBL.COMPOUND:CHEMBL744");
    
            })
        })
    
        describe("Testing _createEdgeBindings function", () => {
            test("test when input with string, should output a hash of 40 characters", () => {
                const queryResult = new QueryResult();
                const res = queryResult._createEdgeBindings(record);
                expect(res).toHaveProperty("e01");
                expect(res.e01.length).toEqual(1);
            })
        })
    
        describe("Testing update function", () => {
            test("test when input with string, should output a hash of 40 characters", () => {
                const queryResult = new QueryResult();
                queryResult.update([record]);
                expect(queryResult.results.length).toEqual(1);
                expect(queryResult.results[0].node_bindings).toHaveProperty("n1");
                expect(queryResult.results[0].edge_bindings).toHaveProperty("e01");
            })
        })
    })
    
    describe("Two Records", () => {
        const gene_node_start = new QNode("n1", { categories: "Gene", ids: "NCBIGene:3778" });
        const disease_node = new QNode("n2", { categories: "Disease" });
        const gene_node_end = new QNode("n3", { categories: "Gene", ids: "NCBIGene:7289" });
    
        const edge1 = new QEdge("e01", { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge("e02", { subject: disease_node, object: gene_node_end });
    
        const record1 = {
            "$edge_metadata": {
                trapi_qEdge_obj: edge1,
                source: "DGIdb",
                api_name: "BioThings DGIDB API"
            },
            "publications": ['PMID:123', 'PMID:1234'],
            "interactionType": "inhibitor",
            "$input": {
                original: "SYMBOL:CDK2",
                obj: [{
                    primaryID: 'NCBIGene:1017',
                    label: "CDK2",
                    dbIDs: {
                        SYMBOL: "CDK2",
                        NCBIGene: "1017"
                    },
                    curies: ['SYMBOL:CDK2', 'NCBIGene:1017']
                }]
            },
            "$output": {
                original: "CHEMBL.COMPOUND:CHEMBL744",
                obj: [{
                    primaryID: 'CHEMBL.COMPOUND:CHEMBL744',
                    label: "RILUZOLE",
                    dbIDs: {
                        "CHEMBL.COMPOUND": "CHEMBL744",
                        "PUBCHEM": "1234",
                        "name": "RILUZOLE"
                    },
                    curies: ['CHEMBL.COMPOUND:CHEMBL744', 'PUBCHEM:1234', "name:RILUZOLE"]
                }]
            },
        }
    
        const record2 = {
            "$edge_metadata": {
                trapi_qEdge_obj: edge2,
                source: "DGIdb",
                api_name: "BioThings DGIDB API"
            },
            "publications": ['PMID:123', 'PMID:1234'],
            "interactionType": "inhibitor",
            "$input": {
                original: "SYMBOL:CDK2",
                obj: [{
                    primaryID: 'NCBIGene:1017',
                    label: "CDK2",
                    dbIDs: {
                        SYMBOL: "CDK2",
                        NCBIGene: "1017"
                    },
                    curies: ['SYMBOL:CDK2', 'NCBIGene:1017']
                }]
            },
            "$output": {
                original: "CHEMBL.COMPOUND:CHEMBL744",
                obj: [{
                    primaryID: 'CHEMBL.COMPOUND:CHEMBL744',
                    label: "RILUZOLE",
                    dbIDs: {
                        "CHEMBL.COMPOUND": "CHEMBL744",
                        "PUBCHEM": "1234",
                        "name": "RILUZOLE"
                    },
                    curies: ['CHEMBL.COMPOUND:CHEMBL744', 'PUBCHEM:1234', "name:RILUZOLE"]
                }]
            },
        }
    
        describe("Testing update function", () => {
            test("test when input with string, should output a hash of 40 characters", () => {
                const queryResult = new QueryResult();
    
                queryResult.update([record1]);
                queryResult.update([record2]);
    
                expect(queryResult.results.length).toEqual(1);
    
                expect(Object.keys(queryResult.results[0].node_bindings).length).toEqual(3);
                expect(queryResult.results[0].node_bindings).toHaveProperty("n1");
                expect(queryResult.results[0].node_bindings).toHaveProperty("n2");
                expect(queryResult.results[0].node_bindings).toHaveProperty("n3");
    
                expect(Object.keys(queryResult.results[0].edge_bindings).length).toEqual(2);
                expect(queryResult.results[0].edge_bindings).toHaveProperty("e01");
                expect(queryResult.results[0].edge_bindings).toHaveProperty("e02");
            })
        })
    })
})
