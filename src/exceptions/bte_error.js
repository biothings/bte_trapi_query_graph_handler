class BTEError extends Error {
    constructor(message = 'Query aborted',
    name = 'QueryAborted',
    code = '501',
     ...params) {
      super(...params);
  
      if (Error.captureStackTrace) {
        Error.captureStackTrace(this, BTEError);
      }
  
      this.name = name;
      this.message = message;
      this.statusCode = code;
    }
  }
  
  module.exports = BTEError;
  