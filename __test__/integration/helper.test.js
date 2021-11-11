const QueryGraphHelper = require("../../src/helper");
const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');

describe("Test helper moduler", () => {
    const helper = new QueryGraphHelper();

    describe('query graph: gene1-disease1-gene2. ids specified for gene1', () => {
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

      test('should get n1 w/ NCBIGene:3778, n2 w/ MONDO:0011122 & n3 w/ NCBIGene:3778', () => {
        expect(helper._getInputQueryNodeID(record1)).toEqual("n1");
        expect(helper._getInputID(record1)).toEqual("NCBIGene:3778");
        expect(helper._getOutputQueryNodeID(record1)).toEqual("n2");
        expect(helper._getOutputID(record1)).toEqual("MONDO:0011122");

        expect(helper._getInputQueryNodeID(record2)).toEqual("n2");
        expect(helper._getInputID(record2)).toEqual("MONDO:0011122");
        expect(helper._getOutputQueryNodeID(record2)).toEqual("n3");
        expect(helper._getOutputID(record2)).toEqual("NCBIGene:3778");
      });
    });

    describe('query graph: gene1-disease1-gene2. ids specified for gene2', () => {
      const gene_node_start = new QNode('n1', { categories: ['Gene'] });
      const disease_node = new QNode('n2', { categories: ['Disease'] });
      const gene_node_end = new QNode('n3', { categories: ['Gene'], ids: ['NCBIGene:3778'] });

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

      test('should get n1 w/ NCBIGene:3778, n2 w/ MONDO:0011122 & n3 w/ NCBIGene:3778', () => {
        expect(helper._getInputQueryNodeID(record1)).toEqual("n1");
        expect(helper._getInputID(record1)).toEqual("NCBIGene:3778");
        expect(helper._getOutputQueryNodeID(record1)).toEqual("n2");
        expect(helper._getOutputID(record1)).toEqual("MONDO:0011122");

        expect(helper._getInputQueryNodeID(record2)).toEqual("n2");
        expect(helper._getInputID(record2)).toEqual("MONDO:0011122");
        expect(helper._getOutputQueryNodeID(record2)).toEqual("n3");
        expect(helper._getOutputID(record2)).toEqual("NCBIGene:3778");
      });
    });
})
