const { cloneDeep, range } = require('lodash');
const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');

describe('Testing QueryResults Module', () => {
  describe('"Real" Records', () => {
    describe('Single Record', () => {
      const gene_node1 = new QNode('n1', { categories: ['Gene'], ids: ['NCBIGene:632'] });
      const chemical_node1 = new QNode('n2', { categories: ['ChemicalSubstance'] });
      const edge1 = new QEdge('e01', { subject: gene_node1, object: chemical_node1 });
      const record = {
        $edge_metadata: {
          trapi_qEdge_obj: edge1,
          predicate: 'biolink:physically_interacts_with',
          source: 'DGIdb',
          api_name: 'BioThings DGIDB API',
        },
        publications: ['PMID:8366144', 'PMID:8381250'],
        relation: 'antagonist',
        source: 'DrugBank',
        score: '0.9',
        $input: {
          original: 'SYMBOL:BGLAP',
          obj: [
            {
              primaryID: 'NCBIGene:632',
              label: 'BGLAP',
              dbIDs: {
                SYMBOL: 'BGLAP',
                NCBIGene: '632',
              },
              curies: ['SYMBOL:BGLAP', 'NCBIGene:632'],
            },
          ],
        },
        $output: {
          original: 'CHEMBL.COMPOUND:CHEMBL1200983',
          obj: [
            {
              primaryID: 'CHEMBL.COMPOUND:CHEMBL1200983',
              label: 'GALLIUM NITRATE',
              dbIDs: {
                'CHEMBL.COMPOUND': 'CHEMBL1200983',
                'PUBCHEM.COMPOUND': '5282394',
                name: 'GALLIUM NITRATE',
              },
              curies: ['CHEMBL.COMPOUND:CHEMBL1200983', 'PUBCHEM.COMPOUND:5282394', 'name:GALLIUM NITRATE'],
            },
          ],
        },
      };

      test('should get n1, n2 and e01', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e01": {
            "connected_to": [],
            "records": [record]
          }
        });
        expect(queryResult.getResults().length).toEqual(1);
        expect(queryResult.getResults()[0].node_bindings).toHaveProperty('n1');
        expect(queryResult.getResults()[0].node_bindings).toHaveProperty('n2');
        expect(queryResult.getResults()[0].edge_bindings).toHaveProperty('e01');
        expect(queryResult.getResults()[0]).toHaveProperty('score');
      });
    });

    describe('Two Records', () => {
      describe('query graph: gene1-disease1-gene1', () => {
        const gene_node_start = new QNode('n1', { categories: ['Gene'] });
        const disease_node = new QNode('n2', { categories: ['Disease'] });
        const gene_node_end = new QNode('n3', { categories: ['Gene'] });

        const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

        const record1 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge1,
            predicate: 'biolink:gene_associated_with_condition',
            api_name: 'Automat Pharos',
          },
          publications: ['PMID:123', 'PMID:1234'],
          $input: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        const record2 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge2,
            predicate: 'biolink:condition_associated_with_gene',
            api_name: 'Automat Hetio',
          },
          publications: ['PMID:345', 'PMID:456'],
          $input: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
          $output: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
        };

        test('should get n1, n2, n3 and e01, e02', () => {
          const queryResult = new QueryResult();

          queryResult.update({
            "e01": {
              "connected_to": ["e02"],
              "records": [record1]
            },
            "e02": {
              "connected_to": ["e01"],
              "records": [record2]
            }
          });

          const results = queryResult.getResults();

          expect(results.length).toEqual(1);

          expect(Object.keys(results[0].node_bindings).length).toEqual(3);
          expect(results[0].node_bindings).toHaveProperty('n1');
          expect(results[0].node_bindings).toHaveProperty('n2');
          expect(results[0].node_bindings).toHaveProperty('n3');

          expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
          expect(results[0].edge_bindings).toHaveProperty('e01');
          expect(results[0].edge_bindings).toHaveProperty('e02');

          expect(results[0]).toHaveProperty('score');
        });
      });

      describe('query graph: gene1-disease1-gene2 (no ids params)', () => {
        const gene_node_start = new QNode('n1', { categories: ['Gene'] });
        const disease_node = new QNode('n2', { categories: ['Disease'] });
        const gene_node_end = new QNode('n3', { categories: ['Gene'] });

        const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

        const record1 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge1,
            predicate: 'biolink:gene_associated_with_condition',
            api_name: 'Automat Pharos',
          },
          publications: ['PMID:123', 'PMID:1234'],
          $input: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        const record2 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge2,
            predicate: 'biolink:condition_associated_with_gene',
            api_name: 'Automat Hetio',
          },
          publications: ['PMID:345', 'PMID:456'],
          $input: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
          $output: {
            original: 'SYMBOL:TULP3',
            obj: [
              {
                primaryID: 'NCBIGene:7289',
                label: 'TULP3',
                dbIDs: {
                  SYMBOL: 'TULP3',
                  NCBIGene: '7289',
                },
                curies: ['SYMBOL:TULP3', 'NCBIGene:7289'],
              },
            ],
          },
        };

        test('should get n1, n2, n3 and e01, e02', () => {
          const queryResult = new QueryResult();
          queryResult.update({
            "e01": {
              "connected_to": ["e02"],
              "records": [record1]
            },
            "e02": {
              "connected_to": ["e01"],
              "records": [record2]
            }
          });

          const results = queryResult.getResults();

          expect(results.length).toEqual(1);

          expect(Object.keys(results[0].node_bindings).length).toEqual(3);
          expect(results[0].node_bindings).toHaveProperty('n1');
          expect(results[0].node_bindings).toHaveProperty('n2');
          expect(results[0].node_bindings).toHaveProperty('n3');

          expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
          expect(results[0].edge_bindings).toHaveProperty('e01');
          expect(results[0].edge_bindings).toHaveProperty('e02');

          expect(results[0]).toHaveProperty('score');
        });
      });

      describe('query graph: gene1-disease1-gene2 (gene1 has ids param)', () => {
        const gene_node_start = new QNode('n1', { categories: ['Gene'], ids: ['NCBIGene:3778'] });
        const disease_node = new QNode('n2', { categories: ['Disease'] });
        const gene_node_end = new QNode('n3', { categories: ['Gene'] });

        const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

        const record1 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge1,
            predicate: 'biolink:gene_associated_with_condition',
            api_name: 'Automat Pharos',
          },
          publications: ['PMID:123', 'PMID:1234'],
          $input: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        const record2 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge2,
            predicate: 'biolink:condition_associated_with_gene',
            api_name: 'Automat Hetio',
          },
          publications: ['PMID:345', 'PMID:456'],
          $input: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
          $output: {
            original: 'SYMBOL:TULP3',
            obj: [
              {
                primaryID: 'NCBIGene:7289',
                label: 'TULP3',
                dbIDs: {
                  SYMBOL: 'TULP3',
                  NCBIGene: '7289',
                },
                curies: ['SYMBOL:TULP3', 'NCBIGene:7289'],
              },
            ],
          },
        };

        test('should get n1, n2, n3 and e01, e02', () => {
          const queryResult = new QueryResult();
          queryResult.update({
            "e01": {
              "connected_to": ["e02"],
              "records": [record1]
            },
            "e02": {
              "connected_to": ["e01"],
              "records": [record2]
            }
          });

          const results = queryResult.getResults();

          expect(results.length).toEqual(1);

          expect(Object.keys(results[0].node_bindings).length).toEqual(3);
          expect(results[0].node_bindings).toHaveProperty('n1');
          expect(results[0].node_bindings).toHaveProperty('n2');
          expect(results[0].node_bindings).toHaveProperty('n3');

          expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
          expect(results[0].edge_bindings).toHaveProperty('e01');
          expect(results[0].edge_bindings).toHaveProperty('e02');

          expect(results[0]).toHaveProperty('score');
        });
      });

      describe('query graph: gene1-disease1-gene2 (gene1 & gene2 have ids params)', () => {
        const gene_node_start = new QNode('n1', { categories: ['Gene'], ids: ['NCBIGene:3778'] });
        const disease_node = new QNode('n2', { categories: ['Disease'] });
        const gene_node_end = new QNode('n3', { categories: ['Gene'], ids: ['NCBIGene:7289'] });

        const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

        const record1 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge1,
            predicate: 'biolink:gene_associated_with_condition',
            api_name: 'Automat Pharos',
          },
          publications: ['PMID:123', 'PMID:1234'],
          $input: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        // NOTE: I had to switch $input and $output.
        // Compare with first test of this type.
        const record2 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge2,
            predicate: 'biolink:condition_associated_with_gene',
            api_name: 'Automat Hetio',
          },
          publications: ['PMID:345', 'PMID:456'],
          $input: {
            original: 'SYMBOL:TULP3',
            obj: [
              {
                primaryID: 'NCBIGene:7289',
                label: 'TULP3',
                dbIDs: {
                  SYMBOL: 'TULP3',
                  NCBIGene: '7289',
                },
                curies: ['SYMBOL:TULP3', 'NCBIGene:7289'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        test('should get n1, n2, n3 and e01, e02', () => {
          const queryResult = new QueryResult();
          queryResult.update({
            "e01": {
              "connected_to": ["e02"],
              "records": [record1]
            },
            "e02": {
              "connected_to": ["e01"],
              "records": [record2]
            }
          });

          const results = queryResult.getResults();

          expect(results.length).toEqual(1);

          expect(Object.keys(results[0].node_bindings).length).toEqual(3);
          expect(results[0].node_bindings).toHaveProperty('n1');
          expect(results[0].node_bindings).toHaveProperty('n2');
          expect(results[0].node_bindings).toHaveProperty('n3');

          expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
          expect(results[0].edge_bindings).toHaveProperty('e01');
          expect(results[0].edge_bindings).toHaveProperty('e02');

          expect(results[0]).toHaveProperty('score');
        });
      });

      describe('query graph: gene1-disease1-gene2 (gene2 has ids param)', () => {
        const gene_node_start = new QNode('n1', { categories: ['Gene'] });
        const disease_node = new QNode('n2', { categories: ['Disease'] });
        const gene_node_end = new QNode('n3', { categories: ['Gene'], ids: ['NCBIGene:7289'] });

        const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
        const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

        const record1 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge1,
            predicate: 'biolink:gene_associated_with_condition',
            api_name: 'Automat Pharos',
          },
          publications: ['PMID:123', 'PMID:1234'],
          $input: {
            original: 'SYMBOL:KCNMA1',
            obj: [
              {
                primaryID: 'NCBIGene:3778',
                label: 'KCNMA1',
                dbIDs: {
                  SYMBOL: 'KCNMA1',
                  NCBIGene: '3778',
                },
                curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        // NOTE: I had to switch $input and $output.
        // Compare with first test of this type.
        const record2 = {
          $edge_metadata: {
            trapi_qEdge_obj: edge2,
            predicate: 'biolink:condition_associated_with_gene',
            api_name: 'Automat Hetio',
          },
          publications: ['PMID:345', 'PMID:456'],
          $input: {
            original: 'SYMBOL:TULP3',
            obj: [
              {
                primaryID: 'NCBIGene:7289',
                label: 'TULP3',
                dbIDs: {
                  SYMBOL: 'TULP3',
                  NCBIGene: '7289',
                },
                curies: ['SYMBOL:TULP3', 'NCBIGene:7289'],
              },
            ],
          },
          $output: {
            original: 'MONDO:0011122',
            obj: [
              {
                primaryID: 'MONDO:0011122',
                label: 'obesity disorder',
                dbIDs: {
                  MONDO: '0011122',
                  MESH: 'D009765',
                  name: 'obesity disorder',
                },
                curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
              },
            ],
          },
        };

        test('should get n1, n2, n3 and e01, e02', () => {
          const queryResult = new QueryResult();
          queryResult.update({
            "e01": {
              "connected_to": ["e02"],
              "records": [record1]
            },
            "e02": {
              "connected_to": ["e01"],
              "records": [record2]
            }
          });

          const results = queryResult.getResults();

          expect(results.length).toEqual(1);

          expect(Object.keys(results[0].node_bindings).length).toEqual(3);
          expect(results[0].node_bindings).toHaveProperty('n1');
          expect(results[0].node_bindings).toHaveProperty('n2');
          expect(results[0].node_bindings).toHaveProperty('n3');

          expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
          expect(results[0].edge_bindings).toHaveProperty('e01');
          expect(results[0].edge_bindings).toHaveProperty('e02');

          expect(results[0]).toHaveProperty('score');
        });
      });

    });

    describe('Three Records', () => {
      const gene_node_start = new QNode('n1', { categories: ['Gene'], ids: ['NCBIGene:3778'] });
      const disease_node = new QNode('n2', { categories: ['Disease'] });
      const gene_node_end = new QNode('n3', { categories: ['Gene'] });

      const edge1 = new QEdge('e01', { subject: gene_node_start, object: disease_node });
      const edge2 = new QEdge('e02', { subject: disease_node, object: gene_node_end });

      const record1 = {
        $edge_metadata: {
          trapi_qEdge_obj: edge1,
          predicate: 'biolink:gene_associated_with_condition',
          api_name: 'Automat Pharos',
        },
        publications: ['PMID:123', 'PMID:1234'],
        $input: {
          original: 'SYMBOL:KCNMA1',
          obj: [
            {
              primaryID: 'NCBIGene:3778',
              label: 'KCNMA1',
              dbIDs: {
                SYMBOL: 'KCNMA1',
                NCBIGene: '3778',
              },
              curies: ['SYMBOL:KCNMA1', 'NCBIGene:3778'],
            },
          ],
        },
        $output: {
          original: 'MONDO:0011122',
          obj: [
            {
              primaryID: 'MONDO:0011122',
              label: 'obesity disorder',
              dbIDs: {
                MONDO: '0011122',
                MESH: 'D009765',
                name: 'obesity disorder',
              },
              curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
            },
          ],
        },
      };

      const record2 = {
        $edge_metadata: {
          trapi_qEdge_obj: edge2,
          predicate: 'biolink:condition_associated_with_gene',
          api_name: 'Automat Hetio',
        },
        publications: ['PMID:345', 'PMID:456'],
        $input: {
          original: 'MONDO:0011122',
          obj: [
            {
              primaryID: 'MONDO:0011122',
              label: 'obesity disorder',
              dbIDs: {
                MONDO: '0011122',
                MESH: 'D009765',
                name: 'obesity disorder',
              },
              curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
            },
          ],
        },
        $output: {
          original: 'SYMBOL:TULP3',
          obj: [
            {
              primaryID: 'NCBIGene:7289',
              label: 'TULP3',
              dbIDs: {
                SYMBOL: 'TULP3',
                NCBIGene: '7289',
              },
              curies: ['SYMBOL:TULP3', 'NCBIGene:7289'],
            },
          ],
        },
      };

      const record3 = {
        $edge_metadata: {
          trapi_qEdge_obj: edge2,
          predicate: 'biolink:condition_associated_with_gene',
          api_name: 'Automat Hetio',
        },
        publications: ['PMID:987', 'PMID:876'],
        $input: {
          original: 'MONDO:0011122',
          obj: [
            {
              primaryID: 'MONDO:0011122',
              label: 'obesity disorder',
              dbIDs: {
                MONDO: '0011122',
                MESH: 'D009765',
                name: 'obesity disorder',
              },
              curies: ['MONDO:0011122', 'MESH:D009765', 'name:obesity disorder'],
            },
          ],
        },
        $output: {
          original: 'SYMBOL:TECR',
          obj: [
            {
              primaryID: 'NCBIGene:9524',
              label: 'TECR',
              dbIDs: {
                SYMBOL: 'TECR',
                NCBIGene: '9524',
              },
              curies: ['SYMBOL:TECR', 'NCBIGene:9524'],
            },
          ],
        },
      };

      test('should get 2 results when query graph is -- and records are -<', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e01": {
            "connected_to": ["e02"],
            "records": [record1]
          },
          "e02": {
            "connected_to": ["e01"],
            "records": [record2, record3]
          }
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(2);

        expect(Object.keys(results[0].node_bindings).length).toEqual(3);
        expect(results[0].node_bindings).toHaveProperty('n1');
        expect(results[0].node_bindings).toHaveProperty('n2');
        expect(results[0].node_bindings).toHaveProperty('n3');

        expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
        expect(results[0].edge_bindings).toHaveProperty('e01');
        expect(results[0].edge_bindings).toHaveProperty('e02');

        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).length).toEqual(3);
        expect(results[1].node_bindings).toHaveProperty('n1');
        expect(results[1].node_bindings).toHaveProperty('n2');
        expect(results[1].node_bindings).toHaveProperty('n3');

        expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
        expect(results[1].edge_bindings).toHaveProperty('e01');
        expect(results[1].edge_bindings).toHaveProperty('e02');

        expect(results[1]).toHaveProperty('score');
      });
    });
  });

  describe('"Synthetic" Records', () => {
    const n0 = new QNode('n0', { categories: ['category_n0_n2'], ids: ['n0a'] });
    const n0_with_is_set = new QNode('n0', { categories: ['category_n0_n2'], ids: ['n0a', 'n0b'], is_set: true });
    const n1 = new QNode('n1', { categories: ['category_n1'] });
    const n2 = new QNode('n2', { categories: ['category_n0_n2'] });
    const n2_with_is_set = new QNode('n2', { categories: ['category_n0_n2'], ids: ['n2a', 'n2b'], is_set: true });
    const n3 = new QNode('n3', { categories: ['biolink:category_n3'] });
    const n4 = new QNode('n4', { categories: ['category_n4'] });
    const n5 = new QNode('n5', { categories: ['category_n5'] });

    const e0 = new QEdge('e0', { subject: n0, object: n1 });
    const e0_with_is_set = new QEdge('e0_with_is_set', { subject: n0_with_is_set, object: n1 });

    const e1 = new QEdge('e1', { subject: n1, object: n2 });
    const e1_with_is_set = new QEdge('e1_with_is_set', { subject: n1, object: n2_with_is_set });

    const e2 = new QEdge('e2', { subject: n1, object: n3 });
    const e3 = new QEdge('e3', { subject: n1, object: n4 });

    const e4 = new QEdge('e4', { subject: n2, object: n5 });
    const e5 = new QEdge('e5', { subject: n3, object: n5 });
    const e6 = new QEdge('e6', { subject: n4, object: n5 });

    // AKA record0_n0a_n1a_pred0_api0
    const record0_n0a_n1a = {
      $edge_metadata: {
        trapi_qEdge_obj: e0,
        predicate: 'biolink:record0_pred0',
        source: 'source0',
        api_name: 'api0',
      },
      // n0
      $input: {
        obj: [
          {
            primaryID: 'n0a',
          },
        ],
      },
      // n1
      $output: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
    };

    const e0Reversed = new QEdge('e0Reversed', { subject: n1, object: n0 });
    const record0_n1a_n0a = cloneDeep(record0_n0a_n1a);
    record0_n1a_n0a.$edge_metadata.trapi_qEdge_obj = e0Reversed;
    record0_n1a_n0a.$input = cloneDeep(record0_n0a_n1a.$output)
    record0_n1a_n0a.$output = cloneDeep(record0_n0a_n1a.$input)

    const record0_n0a_n1a_pred0_api1 = cloneDeep(record0_n0a_n1a);
    record0_n0a_n1a_pred0_api1.$edge_metadata.source = 'source1';
    record0_n0a_n1a_pred0_api1.$edge_metadata.api_name = 'api1';

    const record0_n0a_n1a_pred1_api0 = cloneDeep(record0_n0a_n1a);
    record0_n0a_n1a_pred1_api0.$edge_metadata.predicate = 'biolink:record0_pred1';

    const record0_n0a_n1a_pred1_api1 = cloneDeep(record0_n0a_n1a);
    record0_n0a_n1a_pred1_api1.$edge_metadata.predicate = 'biolink:record0_pred1';
    record0_n0a_n1a_pred0_api1.$edge_metadata.source = 'source1';
    record0_n0a_n1a_pred1_api1.$edge_metadata.api_name = 'api1';

    const record0_n0a_n1b = {
      $edge_metadata: {
        trapi_qEdge_obj: e0,
        predicate: 'biolink:record0_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n0
      $input: {
        obj: [
          {
            primaryID: 'n0a',
          },
        ],
      },
      // n1
      $output: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
    };

    const record0_n0b_n1a = {
      $edge_metadata: {
        trapi_qEdge_obj: e0,
        predicate: 'biolink:record0_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n0
      $input: {
        obj: [
          {
            primaryID: 'n0b',
          },
        ],
      },
      // n1
      $output: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
    };

    const record0_n0b_n1b = {
      $edge_metadata: {
        trapi_qEdge_obj: e0,
        predicate: 'biolink:record0_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n0
      $input: {
        obj: [
          {
            primaryID: 'n0b',
          },
        ],
      },
      // n1
      $output: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
    };

    const record1_n1a_n2a = {
      $edge_metadata: {
        trapi_qEdge_obj: e1,
        predicate: 'biolink:record1_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
      // n2
      $output: {
        obj: [
          {
            primaryID: 'n2a',
          },
        ],
      },
    };

    const e1Reversed = new QEdge('e1Reversed', { subject: n2, object: n1 });
    const record1_n2a_n1a = cloneDeep(record1_n1a_n2a);
    record1_n2a_n1a.$edge_metadata.trapi_qEdge_obj = e1Reversed;
    record1_n2a_n1a.$input = cloneDeep(record1_n1a_n2a.$output)
    record1_n2a_n1a.$output = cloneDeep(record1_n1a_n2a.$input)

    const record1_n1a_n2b = {
      $edge_metadata: {
        trapi_qEdge_obj: e1,
        predicate: 'biolink:record1_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
      // n2
      $output: {
        obj: [
          {
            primaryID: 'n2b',
          },
        ],
      },
    };

    const record1_n2b_n1a = cloneDeep(record1_n1a_n2b);
    record1_n2b_n1a.$edge_metadata.trapi_qEdge_obj = e1Reversed;
    record1_n2b_n1a.$input = cloneDeep(record1_n1a_n2b.$output)
    record1_n2b_n1a.$output = cloneDeep(record1_n1a_n2b.$input)

    const record1_n1b_n2a = {
      $edge_metadata: {
        trapi_qEdge_obj: e1,
        predicate: 'biolink:record1_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
      // n2
      $output: {
        obj: [
          {
            primaryID: 'n2a',
          },
        ],
      },
    };

    const record1_n1b_n2b = {
      $edge_metadata: {
        trapi_qEdge_obj: e1,
        predicate: 'biolink:record1_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
      // n2
      $output: {
        obj: [
          {
            primaryID: 'n2b',
          },
        ],
      },
    };

    const record2_n1a_n3a = {
      $edge_metadata: {
        trapi_qEdge_obj: e2,
        predicate: 'biolink:record2_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
      // n3
      $output: {
        obj: [
          {
            primaryID: 'n3a',
          },
        ],
      },
    };

    const e2Reversed = new QEdge('e2Reversed', { subject: n3, object: n1 });
    const record2_n3a_n1a = cloneDeep(record2_n1a_n3a);
    record2_n3a_n1a.$edge_metadata.trapi_qEdge_obj = e2Reversed;
    record2_n3a_n1a.$input = cloneDeep(record2_n1a_n3a.$output)
    record2_n3a_n1a.$output = cloneDeep(record2_n1a_n3a.$input)

    const record2_n1b_n3a = {
      $edge_metadata: {
        trapi_qEdge_obj: e2,
        predicate: 'biolink:record2_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
      // n3
      $output: {
        obj: [
          {
            primaryID: 'n3a',
          },
        ],
      },
    };

    const record3_n1a_n4a = {
      $edge_metadata: {
        trapi_qEdge_obj: e3,
        predicate: 'biolink:record3_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1a',
          },
        ],
      },
      // n4
      $output: {
        obj: [
          {
            primaryID: 'n4a',
          },
        ],
      },
    };

    const record3_n1b_n4a = {
      $edge_metadata: {
        trapi_qEdge_obj: e3,
        predicate: 'biolink:record3_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n1b',
          },
        ],
      },
      // n4
      $output: {
        obj: [
          {
            primaryID: 'n4a',
          },
        ],
      },
    };

    const record4_n2a_n5a = {
      $edge_metadata: {
        trapi_qEdge_obj: e4,
        predicate: 'biolink:record4_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n1
      $input: {
        obj: [
          {
            primaryID: 'n2a',
          },
        ],
      },
      // n5
      $output: {
        obj: [
          {
            primaryID: 'n5a',
          },
        ],
      },
    };

    const record5_n3a_n5a = {
      $edge_metadata: {
        trapi_qEdge_obj: e5,
        predicate: 'biolink:record5_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n3
      $input: {
        obj: [
          {
            primaryID: 'n3a',
          },
        ],
      },
      // n5
      $output: {
        obj: [
          {
            primaryID: 'n5a',
          },
        ],
      },
    };

    const record6_n4a_n5a = {
      $edge_metadata: {
        trapi_qEdge_obj: e6,
        predicate: 'biolink:record6_pred',
        source: 'source0',
        api_name: 'api0',
      },
      // n4
      $input: {
        obj: [
          {
            primaryID: 'n4a',
          },
        ],
      },
      // n5
      $output: {
        obj: [
          {
            primaryID: 'n5a',
          },
        ],
      },
    };

    const record0_n0a_n1a_with_is_set = cloneDeep(record0_n0a_n1a);
    record0_n0a_n1a_with_is_set.$edge_metadata.trapi_qEdge_obj = e0_with_is_set;
    const record0_n0b_n1a_with_is_set = cloneDeep(record0_n0b_n1a);
    record0_n0b_n1a_with_is_set.$edge_metadata.trapi_qEdge_obj = e0_with_is_set;

    const record1_n2a_n1a_with_is_set = cloneDeep(record1_n2a_n1a);
    record1_n2a_n1a_with_is_set.$edge_metadata.trapi_qEdge_obj = e0_with_is_set;
    const record1_n2b_n1a_with_is_set = cloneDeep(record1_n2b_n1a);
    record1_n2b_n1a_with_is_set.$edge_metadata.trapi_qEdge_obj = e0_with_is_set;

    // start of synthetic record tests

    describe('repeat calls', () => {
      test('should get 0 results for update (0) & getResults (1)', () => {
        const queryResultInner = new QueryResult();
        const resultsInner = queryResultInner.getResults();
        expect(JSON.stringify(resultsInner)).toEqual(JSON.stringify([]));
      });

      // inputs all the same below here

      const queryResultOuter = new QueryResult();
      queryResultOuter.update({
        "e0": {
          "connected_to": ["e1"],
          "records": [record0_n0a_n1a]
        },
        "e1": {
          "connected_to": ["e0"],
          "records": [record1_n1a_n2a]
        }
      });
      const resultsOuter = queryResultOuter.getResults();

      test('should get same results: update (1) & getResults (1) vs. update (2) & getResults (1)', () => {
        const queryResultInner = new QueryResult();
        queryResultInner.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        queryResultInner.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const resultsInner = queryResultInner.getResults();
        expect(JSON.stringify(resultsOuter)).toEqual(JSON.stringify(resultsInner));
      });

      test('should get same results: update (1) & getResults (1) vs. update (2) & getResults (2)', () => {
        const queryResultInner = new QueryResult();
        queryResultInner.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        queryResultInner.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        queryResultInner.getResults();
        const resultsInner = queryResultInner.getResults();
        expect(JSON.stringify(resultsOuter)).toEqual(JSON.stringify(resultsInner));
      });

      test('should get same results: update (1) & getResults (1) vs. update (1) & getResults (2)', () => {
        const queryResultInner = new QueryResult();
        queryResultInner.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        queryResultInner.getResults();
        const resultsInner = queryResultInner.getResults();
        expect(JSON.stringify(resultsOuter)).toEqual(JSON.stringify(resultsInner));
      });
    });
      
    describe('query graph: →', () => {
      test('should get 1 result with record: →', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": [],
            "records": [record0_n0a_n1a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      test('should get 4 results for 4 different records per edge: 𝍬', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": [],
            "records": [record0_n0a_n1a, record0_n0a_n1b, record0_n0b_n1a, record0_n0b_n1b]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(4);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[1]).toHaveProperty('score');

        expect(Object.keys(results[2].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[2]).toHaveProperty('score');

        expect(Object.keys(results[3].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[3].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[3]).toHaveProperty('score');
      });

      test('should get 1 result for the same record repeated 4 times: 𝍬', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": [],
            "records": [record0_n0a_n1a, record0_n0a_n1a, record0_n0a_n1a, record0_n0a_n1a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      test('should get 1 result for the same record repeated twice and reversed twice: 𝍬', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e1": {
            "connected_to": [],
            "records": [record1_n1a_n2a, record1_n1a_n2a, record1_n2a_n1a, record1_n2a_n1a]
          },
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e1'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

//      // TODO: this one fails. Do we need to worry about this case?
//      test('should get 2 results for the same record repeated twice and reversed twice: ⇉⇇', () => {
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e1": {
//            "connected_to": ["e1Reversed"],
//            "records": [record1_n1a_n2a, record1_n1a_n2a]
//          },
//          "e1Reversed": {
//            "connected_to": ["e1"],
//            "records": [record1_n2a_n1a, record1_n2a_n1a]
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(2);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n1', 'n2'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e1'
//        ]);
//        expect(results[0]).toHaveProperty('score');
//
//        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
//          'n2', 'n1'
//        ]);
//        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
//          'e1Reversed'
//        ]);
//        expect(results[1]).toHaveProperty('score');
//      });

      test('should get 1 result with 2 edge mappings when predicates differ: ⇉', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": [],
            "records": [record0_n0a_n1a_pred0_api1, record0_n0a_n1a_pred1_api1]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);

        expect(results[0].edge_bindings['e0'].length).toEqual(2);

        expect(results[0]).toHaveProperty('score');
      });

//      // These two tests won't work until the KG edge ID assignment system is updated,
//      // b/c we need it to take into account the API source.
//      /*
//      test('should get 1 result with 2 edge mappings when API sources differ: ⇉', () => {
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0": {
//            "connected_to": [],
//            "records": [record0_n0a_n1a_pred1_api0, record0_n0a_n1a_pred1_api1]
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(1);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0'
//        ]);
//
//        expect(results[0].edge_bindings['e0'].length).toEqual(2);
//
//        expect(results[0]).toHaveProperty('score');
//      });
//
//      test('should get 1 result with 4 edge mappings when predicates & API sources differ: 𝍬', () => {
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0": {
//            "connected_to": [],
//            "records": [
//              record0_n0a_n1a,
//              record0_n0a_n1a_pred0_api1,
//              record0_n0a_n1a_pred1_api0,
//              record0_n0a_n1a_pred1_api1
//            ]
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(1);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0'
//        ]);
//
//        expect(results[0].edge_bindings['e0'].length).toEqual(4);
//
//        expect(results[0]).toHaveProperty('score');
//      });
//      //*/

    });

    describe('query graph: →→', () => {
      test('should get 1 result with records: →→', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');
      });
      
      test('should get 2 results with records: >-', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a, record0_n0b_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(2);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[1]).toHaveProperty('score');
      });
      
      test('should get 4 results with records: ><', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a, record0_n0b_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a, record1_n1a_n2b]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(4);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[1]).toHaveProperty('score');

        expect(Object.keys(results[2].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[2]).toHaveProperty('score');

        expect(Object.keys(results[3].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[3].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[3]).toHaveProperty('score');
      });
      
//      // TODO: get this working. Issue #341.
//      test('should get 1 result with records: >< (with is_set on both ends)', () => {
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0_with_is_set": {
//            "connected_to": ["e1_with_is_set"],
//            "records": [record0_n0a_n1a_with_is_set, record0_n0b_n1a_with_is_set]
//          },
//          "e1_with_is_set": {
//            "connected_to": ["e0_with_is_set"],
//            "records": [record1_n2a_n1a_with_is_set, record1_n2b_n1a_with_is_set]
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(1);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0_with_is_set', 'e1_with_is_set'
//        ]);
//        expect(results[0]).toHaveProperty('score');
//      });

      test('should get 2 results with records: ⇉⇉', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a, record0_n0a_n1b]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a, record1_n1b_n2a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(2);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[1]).toHaveProperty('score');
      });
      
      test('should get 5k results when e0 has 100 records (50 connected, 50 not), and e1 has 10k (5k connected, 5k not)', () => {
        /**
         * This test is intended to assess performance when handling a larger number of records.
         *
         * n0 -e0-> n1 -e1-> n2
         *
         * e0: 50 connected records + 50 unconnected records = 100 records
         * e1: 5k connected records + 5k unconnected records = 10k records
         *
         * common primaryIDs for records
         * @ n0: 1
         * @ n1: 50
         * @ n2: 100
         */
        const e0Records = [];
        const e1Records = [];

        const n0Count = 1;
        const n1Count = 50;
        const n2Count = 100;

        // just to ensure this matches the test name
        expect(n0Count * n1Count * n2Count).toEqual(5000);

        // generate connected records
        range(0, n1Count).forEach(n1Index => {
          e0Records.push({
            $edge_metadata: {
              trapi_qEdge_obj: e0,
              predicate: 'biolink:record0_pred0',
              source: 'source0',
              api_name: 'api0',
            },
            // n0
            $input: {
              obj: [
                {
                  primaryID: 'n0a',
                },
              ],
            },
            // n1
            $output: {
              obj: [
                {
                  primaryID: 'n1_' + n1Index,
                },
              ],
            },
          });

          range(0, n2Count).forEach(n2Index => {
            e1Records.push({
              $edge_metadata: {
                trapi_qEdge_obj: e1,
                predicate: 'biolink:record1_pred0',
                source: 'source1',
                api_name: 'api1',
              },
              // n1
              $input: {
                obj: [
                  {
                    primaryID: 'n1_' + n1Index,
                  },
                ],
              },
              // n2
              $output: {
                obj: [
                  {
                    primaryID: 'n2_' + n2Index,
                  },
                ],
              },
            });
          });
        });

        // generate unconnected records
        range(0, n1Count).forEach(n1Index => {
          e0Records.push({
            $edge_metadata: {
              trapi_qEdge_obj: e0,
              predicate: 'biolink:record0_pred0',
              source: 'source0',
              api_name: 'api0',
            },
            // n0
            $input: {
              obj: [
                {
                  primaryID: 'n0a',
                },
              ],
            },
            // n1
            $output: {
              obj: [
                {
                  primaryID: 'n1_unconnected_e0record_' + n1Index,
                },
              ],
            },
          });

          range(0, n2Count).forEach(n2Index => {
            e1Records.push({
              $edge_metadata: {
                trapi_qEdge_obj: e1,
                predicate: 'biolink:record1_pred0',
                source: 'source1',
                api_name: 'api1',
              },
              // n1
              $input: {
                obj: [
                  {
                    primaryID: 'n1_unconnected_e1record_' + n1Index,
                  },
                ],
              },
              // n2
              $output: {
                obj: [
                  {
                    primaryID: 'n2_' + n2Index,
                  },
                ],
              },
            });
          });
        });

        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": e0Records
          },
          "e1": {
            "connected_to": ["e0"],
            "records": e1Records
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(5000);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[1]).toHaveProperty('score');
      });
      
//      The following tests are disabled, b/c they're too slow for regular testing.
//      They are intended as a demo of handling a much larger number of records.
//      Enable them only as needed.
//      test('should get 50k results when e0 has 500 records, and e1 has 50k', () => {
//        /**
//         * n0 -e0-> n1 -e1-> n2
//         *
//         * e0: 500 records
//         * e1: 500 * 100 = 50k records
//         *
//         * common primaryIDs for records
//         * @ n0: 1
//         * @ n1: 500
//         * @ n2: 100
//         */
//
//        const e0Records = [];
//        const e1Records = [];
//
//        const n0Count = 1;
//        const n1Count = 500;
//        const n2Count = 100;
//
//        // just to ensure this matches the test name
//        expect(n0Count * n1Count * n2Count).toEqual(50000);
//
//        range(0, n1Count).forEach(n1Index => {
//          e0Records.push({
//            $edge_metadata: {
//              trapi_qEdge_obj: e0,
//              predicate: 'biolink:record0_pred0',
//              source: 'source0',
//              api_name: 'api0',
//            },
//            // n0
//            $input: {
//              obj: [
//                {
//                  primaryID: 'n0a',
//                },
//              ],
//            },
//            // n1
//            $output: {
//              obj: [
//                {
//                  primaryID: 'n1_' + n1Index,
//                },
//              ],
//            },
//          });
//
//          range(0, n2Count).forEach(n2Index => {
//            e1Records.push({
//              $edge_metadata: {
//                trapi_qEdge_obj: e1,
//                predicate: 'biolink:record1_pred0',
//                source: 'source1',
//                api_name: 'api1',
//              },
//              // n1
//              $input: {
//                obj: [
//                  {
//                    primaryID: 'n1_' + n1Index,
//                  },
//                ],
//              },
//              // n2
//              $output: {
//                obj: [
//                  {
//                    primaryID: 'n2_' + n2Index,
//                  },
//                ],
//              },
//            });
//          });
//        });
//
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0": {
//            "connected_to": ["e1"],
//            "records": e0Records
//          },
//          "e1": {
//            "connected_to": ["e0"],
//            "records": e1Records
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(50000);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[0]).toHaveProperty('score');
//
//        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[1]).toHaveProperty('score');
//      });
//      
//      test('should get 50k results when e0 has 1k records (500 connected, 500 not), and e1 has 100k (50k connected, 50k not)', () => {
//        /**
//         * n0 -e0-> n1 -e1-> n2
//         *
//         * e0: 500 connected records + 500 unconnected records = 1k records
//         * e1: 50k connected records + 50k unconnected records = 100k records
//         *
//         * common primaryIDs for records
//         * @ n0: 1
//         * @ n1: 500
//         * @ n2: 100
//         */
//        const e0Records = [];
//        const e1Records = [];
//
//        const n0Count = 1;
//        const n1Count = 500;
//        const n2Count = 100;
//
//        // just to ensure this matches the test name
//        expect(n0Count * n1Count * n2Count).toEqual(50000);
//
//        // generate connected records
//        range(0, n1Count).forEach(n1Index => {
//          e0Records.push({
//            $edge_metadata: {
//              trapi_qEdge_obj: e0,
//              predicate: 'biolink:record0_pred0',
//              source: 'source0',
//              api_name: 'api0',
//            },
//            // n0
//            $input: {
//              obj: [
//                {
//                  primaryID: 'n0a',
//                },
//              ],
//            },
//            // n1
//            $output: {
//              obj: [
//                {
//                  primaryID: 'n1_' + n1Index,
//                },
//              ],
//            },
//          });
//
//          range(0, n2Count).forEach(n2Index => {
//            e1Records.push({
//              $edge_metadata: {
//                trapi_qEdge_obj: e1,
//                predicate: 'biolink:record1_pred0',
//                source: 'source1',
//                api_name: 'api1',
//              },
//              // n1
//              $input: {
//                obj: [
//                  {
//                    primaryID: 'n1_' + n1Index,
//                  },
//                ],
//              },
//              // n2
//              $output: {
//                obj: [
//                  {
//                    primaryID: 'n2_' + n2Index,
//                  },
//                ],
//              },
//            });
//          });
//        });
//
//        // generate unconnected records
//        range(0, n1Count).forEach(n1Index => {
//          e0Records.push({
//            $edge_metadata: {
//              trapi_qEdge_obj: e0,
//              predicate: 'biolink:record0_pred0',
//              source: 'source0',
//              api_name: 'api0',
//            },
//            // n0
//            $input: {
//              obj: [
//                {
//                  primaryID: 'n0a',
//                },
//              ],
//            },
//            // n1
//            $output: {
//              obj: [
//                {
//                  primaryID: 'n1_unconnected_e0record_' + n1Index,
//                },
//              ],
//            },
//          });
//
//          range(0, n2Count).forEach(n2Index => {
//            e1Records.push({
//              $edge_metadata: {
//                trapi_qEdge_obj: e1,
//                predicate: 'biolink:record1_pred0',
//                source: 'source1',
//                api_name: 'api1',
//              },
//              // n1
//              $input: {
//                obj: [
//                  {
//                    primaryID: 'n1_unconnected_e1record_' + n1Index,
//                  },
//                ],
//              },
//              // n2
//              $output: {
//                obj: [
//                  {
//                    primaryID: 'n2_' + n2Index,
//                  },
//                ],
//              },
//            });
//          });
//        });
//
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0": {
//            "connected_to": ["e1"],
//            "records": e0Records
//          },
//          "e1": {
//            "connected_to": ["e0"],
//            "records": e1Records
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(50000);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[0]).toHaveProperty('score');
//
//        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[1]).toHaveProperty('score');
//      });
//
//      test('should get 100k results when e0 has 1k connected records, and e1 has 100k', () => {
//        /**
//         * n0 -e0-> n1 -e1-> n2
//         *
//         * e0: 1k connected records
//         * e1: 100k connected records
//         *
//         * common primaryIDs for records
//         * @ n0: 1
//         * @ n1: 1000
//         * @ n2: 100
//         */
//        const e0Records = [];
//        const e1Records = [];
//
//        const n0Count = 1;
//        const n1Count = 1000;
//        const n2Count = 100;
//
//        // just to ensure this matches the test name
//        expect(n0Count * n1Count * n2Count).toEqual(100000);
//
//        range(0, n1Count).forEach(n1Index => {
//          e0Records.push({
//            $edge_metadata: {
//              trapi_qEdge_obj: e0,
//              predicate: 'biolink:record0_pred0',
//              source: 'source0',
//              api_name: 'api0',
//            },
//            // n0
//            $input: {
//              obj: [
//                {
//                  primaryID: 'n0a',
//                },
//              ],
//            },
//            // n1
//            $output: {
//              obj: [
//                {
//                  primaryID: 'n1_' + n1Index,
//                },
//              ],
//            },
//          });
//
//          range(0, n2Count).forEach(n2Index => {
//            e1Records.push({
//              $edge_metadata: {
//                trapi_qEdge_obj: e1,
//                predicate: 'biolink:record1_pred0',
//                source: 'source1',
//                api_name: 'api1',
//              },
//              // n1
//              $input: {
//                obj: [
//                  {
//                    primaryID: 'n1_' + n1Index,
//                  },
//                ],
//              },
//              // n2
//              $output: {
//                obj: [
//                  {
//                    primaryID: 'n2_' + n2Index,
//                  },
//                ],
//              },
//            });
//          });
//        });
//
//        const queryResult = new QueryResult();
//        queryResult.update({
//          "e0": {
//            "connected_to": ["e1"],
//            "records": e0Records
//          },
//          "e1": {
//            "connected_to": ["e0"],
//            "records": e1Records
//          }
//        });
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(100000);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[0]).toHaveProperty('score');
//
//        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2'
//        ]);
//        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
//          'e0', 'e1'
//        ]);
//        expect(results[1]).toHaveProperty('score');
//      });
      
      test('should get 1 result when e0 has 1 record, and e1 has 50k + 1 (1 connected, 50k not)', () => {
        /**
         * n0 -e0-> n1 -e1-> n2
         *
         * e0: 1 connected record = 1 record
         * e1: 1 connected record + 50k unconnected records = 50,001 records
         *
         * primaryIDs for records
         * @ n0: 1 (1 common)
         * @ n1: 2 (1 common)
         * @ n2: 50001 (50001 common)
         */
        const e0Records = [];
        const e1Records = [];

        // generate connected records
        e0Records.push({
          $edge_metadata: {
            trapi_qEdge_obj: e0,
            predicate: 'biolink:record0_pred0',
            source: 'source0',
            api_name: 'api0',
          },
          // n0
          $input: {
            obj: [
              {
                primaryID: 'n0a',
              },
            ],
          },
          // n1
          $output: {
            obj: [
              {
                primaryID: 'n1_connected',
              },
            ],
          },
        });

        e1Records.push({
          $edge_metadata: {
            trapi_qEdge_obj: e1,
            predicate: 'biolink:record1_pred0',
            source: 'source1',
            api_name: 'api1',
          },
          // n1
          $input: {
            obj: [
              {
                primaryID: 'n1_connected',
              },
            ],
          },
          // n2
          $output: {
            obj: [
              {
                primaryID: 'n2_connected',
              },
            ],
          },
        });

        // generate unconnected records
        range(0, 50000).forEach(n2Index => {
          e1Records.push({
            $edge_metadata: {
              trapi_qEdge_obj: e1,
              predicate: 'biolink:record1_pred0',
              source: 'source1',
              api_name: 'api1',
            },
            // n1
            $input: {
              obj: [
                {
                  primaryID: 'n1_unconnected',
                },
              ],
            },
            // n2
            $output: {
              obj: [
                {
                  primaryID: 'n2_unconnected_' + n2Index,
                },
              ],
            },
          });
        });

        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": e0Records
          },
          "e1": {
            "connected_to": ["e0"],
            "records": e1Records
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');
      });
      
      test('should get 1 result with records: ⇉⇉ (duplicates)', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a, record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a, record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');
      });
      
      test('should get 2 results with records: -<', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a, record1_n1a_n2b]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(2);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');

        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[1]).toHaveProperty('score');
      });
      
      test('should get 1 result with records: →← (directionality does not match query graph)', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1Reversed"],
            "records": [record0_n0a_n1a]
          },
          "e1Reversed": {
            "connected_to": ["e0"],
            "records": [record1_n2a_n1a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1Reversed'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      // NOTE: with the new generalized query handling, this case shouldn't happen
      test('should get 0 results when 0 records for edge: ⇢̊→', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": []
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();
        expect(results.length).toEqual(0);
      });

      // NOTE: with the new generalized query handling, this case won't happen
      test('should get 0 results when 0 records for edge: →⇢̊', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": []
          }
        });
        const results = queryResult.getResults();
        expect(results.length).toEqual(0);
      });
    });

    describe('query graph: →←', () => {
      test('should get 1 result with records: →←', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1Reversed"],
            "records": [record0_n0a_n1a]
          },
          "e1Reversed": {
            "connected_to": ["e0"],
            "records": [record1_n2a_n1a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1Reversed'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      test('should get 1 result with records: →→ (directionality does not match query graph)', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      // NOTE: with the new generalized query handling, this case shouldn't happen.
      // TODO: should we remove this test?
      test('should get 0 results when 0 records for edge: ⇢̊←', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1Reversed"],
            "records": []
          },
          "e1Reversed": {
            "connected_to": ["e0"],
            "records": [record1_n2a_n1a]
          }
        });
        const results = queryResult.getResults();
        expect(results.length).toEqual(0);
      });

      // NOTE: with the new generalized query handling, this case won't happen.
      // TODO: should we remove this test?
      test('should get 0 results when 0 records for edge: →⇠̊', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0"],
            "records": []
          }
        });
        const results = queryResult.getResults();
        expect(results.length).toEqual(0);
      });

    });

    describe('query graph: ←→', () => {
      test('should get 1 result for 1 record per edge: ←→', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e1Reversed": {
            "connected_to": ["e4"],
            "records": [record1_n2a_n1a]
          },
          "e4": {
            "connected_to": ["e1Reversed"],
            "records": [record4_n2a_n5a]
          }
        });
        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n1', 'n2', 'n5'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e1Reversed', 'e4'
        ]);
        expect(results[0]).toHaveProperty('score');
      });

      test('should get 0 results due to unconnected record: ←̽→', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e1Reversed": {
            "connected_to": ["e4"],
            "records": [record1_n2b_n1a]
          },
          "e4": {
            "connected_to": ["e1Reversed"],
            "records": [record4_n2a_n5a]
          }
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(0);
      });

      // NOTE: with the new generalized query handling, this case shouldn't happen.
      // TODO: should we remove this test?
      test('should get 0 results when 0 records for edge: ⇠̊→', () => {
        const queryResult = new QueryResult();
        queryResult.update({
          "e0": {
            "connected_to": ["e1"],
            "records": []
          },
          "e1": {
            "connected_to": ["e0"],
            "records": [record1_n1a_n2a]
          }
        });
        const results = queryResult.getResults();
        expect(results.length).toEqual(0);
      });
    });

    describe('query graph: -<', () => {
      /*
       *               -e1-> n2
       *   n0 -e0-> n1
       *               -e2-> n3
       */
      test('should get 1 result for 1 record per edge: →⇉⮆', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e0": {
            "connected_to": ["e1", "e2"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0", "e2"],
            "records": [record1_n1a_n2a]
          },
          "e2": {
            "connected_to": ["e0", "e1"],
            "records": [record2_n1a_n3a]
          },
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2', 'n3'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1', 'e2'
        ]);

        expect(results[0]).toHaveProperty('score');
      });

//      // TODO: this test fails
//      /*
//       *               -e1-> n2
//       *   n0 <-e0- n1
//       *               -e2-> n3
//       */
//      test('should get 1 result for 1 record per edge: ←⇉⮆', () => {
//        const queryResult = new QueryResult();
//
//        queryResult.update({
//          "e0Reversed": {
//            "connected_to": ["e1", "e2"],
//            "records": [record0_n1a_n0a]
//          },
//          "e1": {
//            "connected_to": ["e0Reversed", "e2"],
//            "records": [record1_n1a_n2a]
//          },
//          "e2": {
//            "connected_to": ["e0Reversed", "e1"],
//            "records": [record2_n1a_n3a]
//          },
//        });
//
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(1);
//
//        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
//          'n0', 'n1', 'n2', 'n3'
//        ]);
//        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
//          'e0Reversed', 'e1', 'e2'
//        ]);
//
//        expect(results[0]).toHaveProperty('score');
//      });

      /*
       *               <-e1- n2
       *   n0 -e0-> n1
       *               -e2-> n3
       */
      test('should get 1 result for 1 record per edge: →⇆⮆', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e0": {
            "connected_to": ["e1Reversed", "e2"],
            "records": [record0_n0a_n1a]
          },
          "e1Reversed": {
            "connected_to": ["e0", "e2"],
            "records": [record1_n2a_n1a]
          },
          "e2": {
            "connected_to": ["e0", "e1Reversed"],
            "records": [record2_n1a_n3a]
          },
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2', 'n3'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1Reversed', 'e2'
        ]);

        expect(results[0]).toHaveProperty('score');
      });

      /*
       *               <-e1- n2
       *   n0 -e0-> n1
       *               <-e2- n3
       */
      test('should get 1 result for 1 record per edge: →⇇⮆', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e0": {
            "connected_to": ["e1Reversed", "e2Reversed"],
            "records": [record0_n0a_n1a]
          },
          "e1Reversed": {
            "connected_to": ["e0", "e2Reversed"],
            "records": [record1_n2a_n1a]
          },
          "e2Reversed": {
            "connected_to": ["e0", "e1Reversed"],
            "records": [record2_n3a_n1a]
          },
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(1);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1', 'n2', 'n3'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0', 'e1Reversed', 'e2Reversed'
        ]);

        expect(results[0]).toHaveProperty('score');
      });

      /*
       *               x--> n2
       *   n0 ---> n1
       *               ---> n2
       */
      test('should get 0 results due to unconnected record: -<̽', () => {
        const queryResult = new QueryResult();

        queryResult.update({
          "e0": {
            "connected_to": ["e1", "e2"],
            "records": [record0_n0a_n1a]
          },
          "e1": {
            "connected_to": ["e0", "e2"],
            "records": [record1_n1b_n2a]
          },
          "e2": {
            "connected_to": ["e0", "e1"],
            "records": [record2_n1a_n3a]
          },
        });

        const results = queryResult.getResults();

        expect(results.length).toEqual(0);
      });
    });

//    // TODO: the following tests fail. Leaving them disabled below,
//    // because Andrew said we don't have to handle cycles for now.
//    describe('query graph: -ᗕᗒ', () => {
//      /*
//       *               -e1-> n2 -e4->
//       *   n0 -e0-> n1 -e2-> n3 -e5-> n5
//       *               -e3-> n4 -e6->
//       */
//
////      test('should get 1 result for 1 record per edge', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(1);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////      });
//
////      test('should get 2 results for 2 records per edge at n0', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a, record0_n0b_n1a]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(2);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////
////        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[1]).toHaveProperty('score');
////      });
////
////      test('should get 2 results for 2 records per edge at n1', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a, record0_n0a_n1b]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a, record1_n1b_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a, record2_n1b_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a, record3_n1b_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(2);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////
////        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[1]).toHaveProperty('score');
////      });
////
////      /*
////       *                 -e1-> n2a -e4->
////       *   n0a -e0-> n1a -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       *
////       *
////       *                 -e1-> n2a -e4->
////       *   n0a -e0-> n1b -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       *
////       *
////       *                 -e1-> n2a -e4->
////       *   n0b -e0-> n1a -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       */
////      test('should get 3 results for n0a→n1a, n0a→n1b, n0b→n1a', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a, record0_n0a_n1b, record0_n0b_n1a]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a, record1_n1b_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a, record2_n1b_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a, record3_n1b_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(3);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////
////        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[1]).toHaveProperty('score');
////
////        expect(Object.keys(results[2].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[2]).toHaveProperty('score');
////      });
////
////      /*
////       *                 -e1-> n2a -e4->
////       *   n0a -e0-> n1a -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       *
////       *
////       *                 -e1-> n2a -e4->
////       *   n0a -e0-> n1b -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       *
////       *
////       *                 -e1-> n2a -e4->
////       *   n0b -e0-> n1a -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       *
////       *
////       *                 -e1-> n2a -e4->
////       *   n0b -e0-> n1b -e2-> n3a -e5-> n5a
////       *                 -e3-> n4a -e6->
////       */
////      test('should get 4 results for n0a→n1a, n0a→n1b, n0b→n1a, n0b→n1b', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a, record0_n0a_n1b, record0_n0b_n1a, record0_n0b_n1b]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a, record1_n1b_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a, record2_n1b_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a, record3_n1b_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(4);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////
////        expect(Object.keys(results[1].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[1]).toHaveProperty('score');
////
////        expect(Object.keys(results[2].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[2]).toHaveProperty('score');
////
////        expect(Object.keys(results[3].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[3].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[3]).toHaveProperty('score');
////      });
//
//      test('should get 0 results due to unconnected record at n1 (n1a vs. n1b)', () => {
//        const queryResult = new QueryResult();
//
//        queryResult.update({
//          "e0": {
//            "connected_to": ["e1", "e2", "e3"],
//            "records": [record0_n0a_n1a]
//          },
//          "e1": {
//            "connected_to": ["e0", "e2", "e3", "e4"],
//            "records": [record1_n1b_n2a]
//          },
//          "e2": {
//            "connected_to": ["e0", "e1", "e3", "e5"],
//            "records": [record2_n1a_n3a]
//          },
//          "e3": {
//            "connected_to": ["e0", "e1",  "e2", "e6"],
//            "records": [record3_n1a_n4a]
//          },
//          "e4": {
//            "connected_to": ["e1", "e5", "e6"],
//            "records": [record4_n2a_n5a]
//          },
//          "e5": {
//            "connected_to": ["e2", "e4", "e6"],
//            "records": [record5_n3a_n5a]
//          },
//          "e6": {
//            "connected_to": ["e3", "e4", "e5"],
//            "records": [record6_n4a_n5a]
//          }
//        });
//
//        const results = queryResult.getResults();
//
//        expect(results.length).toEqual(0);
//      });
//
////      test('should get 1 result & ignore unconnected record', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a, record1_n1b_n2a]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(1);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////      });
////
////      test('should get 1 result & ignore 4 unconnected records', () => {
////        const queryResult = new QueryResult();
////
////        queryResult.update({
////          "e0": {
////            "connected_to": ["e1", "e2", "e3"],
////            "records": [record0_n0a_n1a, record0_n0a_n1b]
////          },
////          "e1": {
////            "connected_to": ["e0", "e2", "e3", "e4"],
////            "records": [record1_n1a_n2a, record1_n1a_n2b, record1_n1b_n2a, record1_n1b_n2b]
////          },
////          "e2": {
////            "connected_to": ["e0", "e1", "e3", "e5"],
////            "records": [record2_n1a_n3a]
////          },
////          "e3": {
////            "connected_to": ["e0", "e1",  "e2", "e6"],
////            "records": [record3_n1a_n4a]
////          },
////          "e4": {
////            "connected_to": ["e1", "e5", "e6"],
////            "records": [record4_n2a_n5a]
////          },
////          "e5": {
////            "connected_to": ["e2", "e4", "e6"],
////            "records": [record5_n3a_n5a]
////          },
////          "e6": {
////            "connected_to": ["e3", "e4", "e5"],
////            "records": [record6_n4a_n5a]
////          }
////        });
////
////        const results = queryResult.getResults();
////
////        expect(results.length).toEqual(1);
////
////        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
////          'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
////        ]);
////        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
////          'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
////        ]);
////        expect(results[0]).toHaveProperty('score');
////      });
//    });

  });
});
