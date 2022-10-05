const utils = require('../../src/utils');

describe('Test utility functions', () => {
  describe('Test removeBioLinkPrefix function', () => {
    test('String input with biolink prefix should be removed', () => {
      const input = 'biolink:treats';
      const res = utils.removeBioLinkPrefix(input);
      expect(res).toEqual('treats');
    });

    test('String input without biolink prefix should be kept same', () => {
      const input = 'treats';
      const res = utils.removeBioLinkPrefix(input);
      expect(res).toEqual('treats');
    });
  });

  describe('Test toArray function', () => {
    test('Array input should return itself', () => {
      const input = ['a'];
      const res = utils.toArray(input);
      expect(res).toEqual(['a']);
    });

    test('Non-Array input should return an array of one element being itself', () => {
      const input = 'a';
      const res = utils.toArray(input);
      expect(res).toEqual(['a']);
    });
  });
});
