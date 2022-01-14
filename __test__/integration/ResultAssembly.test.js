const QueryResult = require('../../src/query_results');
// const results = require('./__mocks__/results');
jest.mock('results-a1_b2_a3_a4')
jest.mock('results-a1_b1_a3_a4')
jest.mock('results-is-set-false')
 
// const results = [];
describe('Testing QueryResults Module', () => {

    test('n0 is-set true, a1_b2_a3_a4', () => {
        const results = require('results-a1_b2_a3_a4');
        const queryResult = new QueryResult();
        queryResult.update(results);
        const query_results = queryResult.getResults();

        expect(query_results.length).toEqual(4);

        expect(Object.keys(query_results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(query_results[0].edge_bindings).sort()).toEqual([
          'e00'
        ]);

        expect(query_results[0].edge_bindings['e00'].length).toEqual(1);

        expect(query_results[0]).toHaveProperty('score');
      });

    test('n0 is-set true, a1_b1_a3_a4', () => {
        const results = require('results-a1_b1_a3_a4');
        const queryResult = new QueryResult();
        queryResult.update(results);
        const query_results = queryResult.getResults();

        expect(query_results.length).toEqual(3);

        expect(Object.keys(query_results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(query_results[0].node_bindings['n0'].map(x => x.id).sort()).toEqual([
          'MONDO:0013433',
          'MONDO:0019340'
        ]);
        expect(query_results[0].node_bindings['n1'].map(x => x.id).sort()).toEqual([
          'UMLS:001'
        ]);
        expect(Object.keys(query_results[0].edge_bindings).sort()).toEqual([
          'e00'
        ]);
        expect(query_results[0].edge_bindings['e00'].map(x => x.id).sort()).toEqual([
          '3172b78ca0f9b076f2967ab0c1a3eff6',
          '37ab975836865e8adeb93284df9b65df'
        ]);
        expect(query_results[0]).toHaveProperty('score');


        expect(Object.keys(query_results[1].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(query_results[1].node_bindings['n0'].map(x => x.id).sort()).toEqual([
          'MONDO:0013433',
        ]);
        expect(query_results[1].node_bindings['n1'].map(x => x.id).sort()).toEqual([
          'UMLS:003'
        ]);
        expect(Object.keys(query_results[1].edge_bindings).sort()).toEqual([
          'e00'
        ]);
        expect(query_results[1].edge_bindings['e00'].map(x => x.id).sort()).toEqual([
          'e20c0a79ecf316005ac05ddd72b562fb'
        ]);
        expect(query_results[1]).toHaveProperty('score');
      });

      test('is-set false', () => {
        const results = require('results-is-set-false');
        const queryResult = new QueryResult();
        queryResult.update(results);
        const query_results = queryResult.getResults();

        expect(query_results.length).toEqual(4);

        expect(Object.keys(query_results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(query_results[0].edge_bindings).sort()).toEqual([
          'e00'
        ]);

        expect(query_results[0].edge_bindings['e00'].length).toEqual(1);

        expect(query_results[0]).toHaveProperty('score');
      });
});
