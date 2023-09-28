const crypto = require('crypto');
const biolink = require('./biolink');
const config = require('./config.js');

module.exports = class QueryGraphHelper {
  static _generateHash(stringToBeHashed) {
    return crypto.createHash('md5').update(stringToBeHashed).digest('hex');
  }
};
