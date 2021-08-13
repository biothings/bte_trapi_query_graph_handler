const { cloneDeep } = require('lodash');
const QNode = require('../../src/query_node');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');

describe('Testing QueryResults Module', () => {
  const n0 = new QNode('n0', { categories: 'Gene', ids: 'NCBIGene:3778' });
  const n1 = new QNode('n1', { categories: 'Disease' });
  const n2 = new QNode('n2', { categories: 'Gene' });
  const n3 = new QNode('n3', { categories: 'biolink:BiologicalProcessOrActivity' });

  const e0 = new QEdge('e0', { subject: n0, object: n1 });
  const e1 = new QEdge('e1', { subject: n1, object: n2 });
  const e2 = new QEdge('e2', { subject: n1, object: n3 });

  const record0 = {
    $edge_metadata: {
      trapi_qEdge_obj: e0,
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

  const record1 = {
    $edge_metadata: {
      trapi_qEdge_obj: e1,
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

  const record1Broken = cloneDeep(record1);
  record1Broken.$edge_metadata.trapi_qEdge_obj = e0;
  record1Broken.publications = ['PMID:placeholder1', 'PMID:placeholder2'];
  record1Broken.$input = {
    original: 'MONDO:placeholder',
    obj: [
      {
        primaryID: 'MONDO:placeholder',
        label: 'placeholder',
        dbIDs: {
          MONDO: 'placeholder',
          MESH: 'placeholder',
          name: 'placeholder',
        },
        curies: ['MONDO:placeholder', 'MESH:placeholder', 'name:placeholder'],
      },
    ],
  };

  const e1Reversed = new QEdge('e1Reversed', { subject: n2, object: n1 });

  const record1Reversed = cloneDeep(record1);
  record1Reversed.$edge_metadata.trapi_qEdge_obj = e1Reversed;
  record1Reversed.$input = cloneDeep(record1.$output)
  record1Reversed.$output = cloneDeep(record1.$input)

  const record1Opposed = cloneDeep(record1);
  record1Opposed.$edge_metadata.trapi_qEdge_obj = e1Reversed;

  const record2 = {
    $edge_metadata: {
      trapi_qEdge_obj: e1,
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

  const record3 = {
    $edge_metadata: {
      trapi_qEdge_obj: e2,
      predicate: 'biolink:related_to',
      api_name: 'SEMMED Disease API',
    },
    publications: [
      "PMID:25543077",
      "PMID:6408111",
      "PMID:23707540",
      "PMID:7550204",
      "PMID:7547843",
      "PMID:3225330",
      "PMID:21464077",
      "PMID:18834432"
    ],
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
      original: 'UMLS:C0000934',
      obj: [
        {
          primaryID: 'UMLS:C0000934',
          label: 'Acclimatization',
          dbIDs: {
            UMLS: 'C0000934',
            name: 'Acclimatization',
          },
          curies: ['UMLS:C0000934', 'name:Acclimatization'],
        },
      ],
    },
  };

  const record3Broken = cloneDeep(record3);
  record3Broken.$edge_metadata.trapi_qEdge_obj = e0;
  record3Broken.publications = ['PMID:placeholder1', 'PMID:placeholder2'];
  record3Broken.$input = {
    original: 'MONDO:placeholder',
    obj: [
      {
        primaryID: 'MONDO:placeholder',
        label: 'placeholder',
        dbIDs: {
          MONDO: 'placeholder',
          MESH: 'placeholder',
          name: 'placeholder',
        },
        curies: ['MONDO:placeholder', 'MESH:placeholder', 'name:placeholder'],
      },
    ],
  };

  describe('query graph: →', () => {
    test('should get one result for this record: →', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).length).toEqual(2);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0]).toHaveProperty('score');
    });
  });

  describe('query graph: →→', () => {
    test('should get two results for these records: →→', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0]);
      queryResult.update([record1]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');
      expect(results[0]).toHaveProperty('score');
    });


    
    test('should get one result for these records: →← (directionality does not match query graph)', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0]);
      queryResult.update([record1Opposed]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1Reversed');
      expect(results[0]).toHaveProperty('score');
    });

    test('should get no results when missing record0: ?→', () => {
      const queryResult = new QueryResult();
      queryResult.update([]);
      queryResult.update([record1]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(0);
    });

    test('should get no results when missing record1: →?', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0]);
      queryResult.update([]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(0);
    });
  });

  describe('query graph: ↘↙', () => {
    test('should get two results for these records: ↘↙', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0, record1Reversed]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(2);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(2);
      expect(results[1].node_bindings).toHaveProperty('n2');
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(1);
      expect(results[1].edge_bindings).toHaveProperty('e1Reversed');
      expect(results[1]).toHaveProperty('score');
    });

    test('should get two results for these records: ↘↗ (directionality does not match query graph)', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0, record1Opposed]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(2);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0]).toHaveProperty('score');
    });

    test('should get no results for these records: ?↙', () => {
      const queryResult = new QueryResult();
      queryResult.update([]);
      queryResult.update([record1Reversed]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(0);
    });

    test('should get no results with records: ↘?', () => {
      const queryResult = new QueryResult();
      queryResult.update([record0]);
      queryResult.update([]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(0);
    });
  });

  describe('query graph: ↙↘', () => {
    test('should get two results for these records: ↙↘', () => {
      const queryResult = new QueryResult();
      queryResult.update([record1, record2]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(2);
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
      expect(results[0].edge_bindings).toHaveProperty('e1');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(2);
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(1);
      expect(results[1].edge_bindings).toHaveProperty('e1');
      expect(results[1]).toHaveProperty('score');
    });

    test('should get two results, depite a mismatched record: ⇙↘', () => {
      const queryResult = new QueryResult();
      queryResult.update([record1Broken, record2]);
      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(2);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(1);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(2);
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(1);
      expect(results[1].edge_bindings).toHaveProperty('e1');
      expect(results[1]).toHaveProperty('score');
    });
  });

  /* single-hop followed by double-forked second hop
   */
  describe('query graph: -<', () => {
    /*
     *               -e1-> n2
     *   n0 -e0-> n1
     *               -e1-> n2
     */
    test('should get two results (all edges fine)', () => {
      const queryResult = new QueryResult();

      queryResult.update([record0]);
      queryResult.update([record1, record2]);

      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');

      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');

      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(3);
      expect(results[1].node_bindings).toHaveProperty('n0');
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n2');

      expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
      expect(results[1].edge_bindings).toHaveProperty('e0');
      expect(results[1].edge_bindings).toHaveProperty('e1');

      expect(results[1]).toHaveProperty('score');
    });

    /*
     *               -/-> n2
     *   n0 ---> n1
     *               ---> n2
     */
    test('should get just one result due to a broken edge', () => {
      const queryResult = new QueryResult();

      queryResult.update([record0]);
      queryResult.update([record1Broken, record2]);

      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');

      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');

      expect(results[0]).toHaveProperty('score');
    });
  });

  /* single-hop followed by triple-forked second hop
   */
  describe('query graph: -E', () => {
    /*
     *               -e1-> n2
     *   n0 -e0-> n1 -e1-> n2
     *               -e2-> n3
     */
    test('should get three results (all edges fine)', () => {
      const queryResult = new QueryResult();

      queryResult.update([record0]);
      queryResult.update([record1, record2, record3]);

      const results = queryResult.getResults();

      expect(results.length).toEqual(3);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(3);
      expect(results[1].node_bindings).toHaveProperty('n0');
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
      expect(results[1].edge_bindings).toHaveProperty('e0');
      expect(results[1].edge_bindings).toHaveProperty('e1');
      expect(results[1]).toHaveProperty('score');

      expect(Object.keys(results[2].node_bindings).length).toEqual(3);
      expect(results[2].node_bindings).toHaveProperty('n0');
      expect(results[2].node_bindings).toHaveProperty('n1');
      expect(results[2].node_bindings).toHaveProperty('n3');
      expect(Object.keys(results[2].edge_bindings).length).toEqual(2);
      expect(results[2].edge_bindings).toHaveProperty('e0');
      expect(results[2].edge_bindings).toHaveProperty('e2');
      expect(results[2]).toHaveProperty('score');
    });

    /*
     *               -/-> n2
     *   n0 ---> n1  ---> n2
     *               ---> n3
     */
    test('should get just two results due to broken edge e1', () => {
      const queryResult = new QueryResult();

      queryResult.update([record0]);
      queryResult.update([record1Broken, record2, record3]);

      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(3);
      expect(results[1].node_bindings).toHaveProperty('n0');
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n3');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
      expect(results[1].edge_bindings).toHaveProperty('e0');
      expect(results[1].edge_bindings).toHaveProperty('e2');
      expect(results[1]).toHaveProperty('score');
    });

    /*
     *               ---> n2
     *   n0 ---> n1  ---> n2
     *               -/-> n3
     */
    test('should get just two results due to broken edge e2', () => {
      const queryResult = new QueryResult();

      queryResult.update([record0]);
      queryResult.update([record1, record2, record3Broken]);

      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).length).toEqual(3);
      expect(results[0].node_bindings).toHaveProperty('n0');
      expect(results[0].node_bindings).toHaveProperty('n1');
      expect(results[0].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[0].edge_bindings).length).toEqual(2);
      expect(results[0].edge_bindings).toHaveProperty('e0');
      expect(results[0].edge_bindings).toHaveProperty('e1');
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).length).toEqual(3);
      expect(results[1].node_bindings).toHaveProperty('n0');
      expect(results[1].node_bindings).toHaveProperty('n1');
      expect(results[1].node_bindings).toHaveProperty('n2');
      expect(Object.keys(results[1].edge_bindings).length).toEqual(2);
      expect(results[1].edge_bindings).toHaveProperty('e0');
      expect(results[1].edge_bindings).toHaveProperty('e1');
      expect(results[1]).toHaveProperty('score');
    });
  });

});
