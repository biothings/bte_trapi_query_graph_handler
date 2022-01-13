const QueryResult = require('../../src/query_results');
// const results = require('./__mocks__/results');
jest.mock('results')
jest.mock('results-is-set-false')
 
// const results = [];
describe('Testing QueryResults Module', () => {

    test('is-set true', () => {
        const results = require('results');
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
