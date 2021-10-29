class InvalidQueryGraphError extends Error {
  constructor(message = 'Your Input Query Graph is invalid.',
  name = 'InvalidQueryGraphError',
  code = 400,
   ...params) {
    super(...params);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, InvalidQueryGraphError);
    }

    this.name = name;
    this.message = message;
    this.statusCode = code;
  }
}

module.exports = InvalidQueryGraphError;
