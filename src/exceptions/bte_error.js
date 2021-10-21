class BTEError extends Error {
    constructor(message = 'Your Input Query Graph is invalid.',
    name = 'InvalidQueryGraphError',
    code = 400,
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
  