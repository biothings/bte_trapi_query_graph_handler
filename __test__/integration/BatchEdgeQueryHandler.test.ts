import BatchEdgeQueryHandler from '../../src/batch_edge_query';
import MetaKG from '@biothings-explorer/smartapi-kg';

describe('Testing BatchEdgeQueryHandler Module', () => {
  const kg = new MetaKG();
  kg.constructMetaKGSync();

  describe('Testing query function', () => {
    test('test subscribe and unsubscribe function', () => {
      const batchHandler = new BatchEdgeQueryHandler(kg);
      batchHandler.subscribe(1);
      batchHandler.subscribe(2);
      batchHandler.subscribe(3);
      expect(batchHandler.subscribers).toContain(2);
      batchHandler.unsubscribe(2);
      expect(batchHandler.subscribers).not.toContain(2);
    });
  });
});
