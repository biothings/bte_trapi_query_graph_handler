const QueryResult = require('../../src/query_results');
jest.mock('results')
describe('Testing QueryResults Module', () => {

    test('should get 1 result with 2 edge mappings when predicates differ: ⇉', () => {
        const queryResult = new QueryResult();
        queryResult.update(results);
        const results = queryResult.getResults();

        expect(results.length).toEqual(4);

        expect(Object.keys(results[0].node_bindings).sort()).toEqual([
          'n0', 'n1'
        ]);
        expect(Object.keys(results[0].edge_bindings).sort()).toEqual([
          'e0'
        ]);

        expect(results[0].edge_bindings['e0'].length).toEqual(2);

        expect(results[0]).toHaveProperty('score');
      });
});
