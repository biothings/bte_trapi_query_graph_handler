const { cloneDeep } = require('lodash');
const QNode = require('../../src/query_node_2');
const QEdge = require('../../src/query_edge');
const QueryResult = require('../../src/query_results');

describe('Testing QueryResults Module', () => {
  const n0 = new QNode('n0', { categories: 'category_n0_n2', ids: 'n0a' });
  const n1 = new QNode('n1', { categories: 'category_n1' });
  const n2 = new QNode('n2', { categories: 'category_n0_n2' });
  const n3 = new QNode('n3', { categories: 'biolink:category_n3' });
  const n4 = new QNode('n4', { categories: 'category_n4' });
  const n5 = new QNode('n5', { categories: 'category_n5' });

  const e0 = new QEdge('e0', { subject: n0, object: n1 });

  const e1 = new QEdge('e1', { subject: n1, object: n2 });
  const e2 = new QEdge('e2', { subject: n1, object: n3 });
  const e3 = new QEdge('e3', { subject: n1, object: n4 });

  const e4 = new QEdge('e4', { subject: n2, object: n5 });
  const e5 = new QEdge('e5', { subject: n3, object: n5 });
  const e6 = new QEdge('e6', { subject: n4, object: n5 });

  const record0_n0a_n1a = {
    $edge_metadata: {
      trapi_qEdge_obj: e0,
      predicate: 'biolink:record0_predicate',
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

  const record0_n0a_n1b = {
    $edge_metadata: {
      trapi_qEdge_obj: e0,
      predicate: 'biolink:record0_predicate',
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
      predicate: 'biolink:record0_predicate',
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
      predicate: 'biolink:record0_predicate',
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
      predicate: 'biolink:record1_predicate',
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
      predicate: 'biolink:record1_predicate',
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

  const record1_n1b_n2a = {
    $edge_metadata: {
      trapi_qEdge_obj: e1,
      predicate: 'biolink:record1_predicate',
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
      predicate: 'biolink:record1_predicate',
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
      predicate: 'biolink:record2_predicate',
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

  const record2_n1b_n3a = {
    $edge_metadata: {
      trapi_qEdge_obj: e2,
      predicate: 'biolink:record2_predicate',
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
      predicate: 'biolink:record3_predicate',
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
      predicate: 'biolink:record3_predicate',
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
      predicate: 'biolink:record4_predicate',
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
      predicate: 'biolink:record5_predicate',
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
      predicate: 'biolink:record6_predicate',
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

  // start tests

  describe('repeat calls', () => {
    test('should get no results for update (0) then getResults (1)', () => {
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

    test('should get same result for update (2) then getResults (1)', () => {
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

    test('should get same result for update (2) then getResults (2)', () => {
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

    test('should get same result for update (1) then getResults (2)', () => {
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
    test('should get one result for this record: →', () => {
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
  });

  describe('query graph: →→', () => {
    test('should get one result with records: →→', () => {
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
    
    test('should get two results with records: >→', () => {
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
    
    test('should get four results with records: ><', () => {
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
    
    test('should get two results with records: ⇉⇉', () => {
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
    
    test('should get two results with records: →<', () => {
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
    
    test('should get one result for these records: →← (directionality does not match query graph)', () => {
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

    // with the new generalized query handling, this case shouldn't happen
    test('should get no results when missing record0: ?→', () => {
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

    // with the new generalized query handling, this case won't happen
    test('should get no results when missing record1: →?', () => {
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
    test('should get two results for these records: →←', () => {
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

    test('should get two results for these records: →→ (directionality does not match query graph)', () => {
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

    // with the new generalized query handling, this case shouldn't happen
    test('should get no results for these records: ?←', () => {
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

    // with the new generalized query handling, this case won't happen
    test('should get no results with records: →?', () => {
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
    test('should get one result when one record per edge (←→)', () => {
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

    test('should get zero results due to a non-matching record (←→)', () => {
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

    // with the new generalized query handling, this case shouldn't happen
    test('should get no results when missing a record (?→)', () => {
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

  /* single-hop followed by forked second hop
   */
  describe('query graph: -<', () => {
    /*
     *               -e1-> n2
     *   n0 -e0-> n1
     *               -e2-> n3
     */
    test('should get two results (one record per edge)', () => {
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

    /*
     *               ?--> n2
     *   n0 ---> n1
     *               ---> n2
     */
    test('should get zero results due to a mis-matched edge', () => {
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

  /* single-hop followed by triple fork, all reconnecting to a single node
   */
  describe('query graph: -EƎ', () => {
    /*
     *               -e1-> n2 -e4->
     *   n0 -e0-> n1 -e2-> n3 -e5-> n5
     *               -e3-> n4 -e6->
     */

    test('should get one result for one record per edge', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');
    });

    test('should get two results for two at n0', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a, record0_n0b_n1a]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[1]).toHaveProperty('score');
    });

    test('should get two results for two at n1', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a, record0_n0a_n1b]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a, record1_n1b_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a, record2_n1b_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a, record3_n1b_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(2);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[1]).toHaveProperty('score');
    });

    test('should get three results for two at n0 and two at n1', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a, record0_n0a_n1b, record0_n0b_n1a]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a, record1_n1b_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a, record2_n1b_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a, record3_n1b_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(3);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[1]).toHaveProperty('score');

      expect(Object.keys(results[2].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[2]).toHaveProperty('score');
    });

    test('should get four results for two at n0 and two at n1', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a, record0_n0a_n1b, record0_n0b_n1a, record0_n0b_n1b]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a, record1_n1b_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a, record2_n1b_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a, record3_n1b_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(4);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');

      expect(Object.keys(results[1].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[1].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[1]).toHaveProperty('score');

      expect(Object.keys(results[2].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[2].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[2]).toHaveProperty('score');

      expect(Object.keys(results[3].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[3].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[3]).toHaveProperty('score');
    });

    test('should get no results for mis-matched record', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1b_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(0);
    });

    test('should get one result & ignore extra mis-matched record', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a, record1_n1b_n2a]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');
    });

    test('should get one result & ignore extra four mis-matched records', () => {
      const queryResult = new QueryResult();

      queryResult.update({
        "e0": {
          "connected_to": ["e1", "e2", "e3"],
          "records": [record0_n0a_n1a, record0_n0a_n1b]
        },
        "e1": {
          "connected_to": ["e0", "e2", "e3", "e4"],
          "records": [record1_n1a_n2a, record1_n1a_n2b, record1_n1b_n2a, record1_n1b_n2b]
        },
        "e2": {
          "connected_to": ["e0", "e1", "e3", "e5"],
          "records": [record2_n1a_n3a]
        },
        "e3": {
          "connected_to": ["e0", "e1",  "e2", "e6"],
          "records": [record3_n1a_n4a]
        },
        "e4": {
          "connected_to": ["e1", "e5", "e6"],
          "records": [record4_n2a_n5a]
        },
        "e5": {
          "connected_to": ["e2", "e4", "e6"],
          "records": [record5_n3a_n5a]
        },
        "e6": {
          "connected_to": ["e3", "e4", "e5"],
          "records": [record6_n4a_n5a]
        }
      });

      const results = queryResult.getResults();

      expect(results.length).toEqual(1);

      expect(Object.keys(results[0].node_bindings).sort()).toEqual([
        'n0', 'n1', 'n2', 'n3', 'n4', 'n5'
      ]);
      expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
        'e0', 'e1', 'e2', 'e3', 'e4', 'e5', 'e6'
      ]);
      expect(results[0]).toHaveProperty('score');
    });

  });
});
