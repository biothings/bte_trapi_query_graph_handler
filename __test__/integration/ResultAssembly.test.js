const QueryResult = require('../../src/query_results');
// const results = require('./__mocks__/results');
jest.mock('results')
 
// const results = [];
describe('Testing QueryResults Module', () => {

    test('should get 1 result with 2 edge mappings when predicates differ: ⇉', () => {
        const results = require('results');
        const queryResult = new QueryResult();
        queryResult.update(results);
        const query_results = queryResult.getResults();

        expect(query_results.length).toEqual(4);

        expect(Object.keys(query_results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(query_results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);

        expect(query_results[0].edge_bindings['e0'].length).toEqual(2);

        expect(query_results[0]).toHaveProperty('score');
      });
});
