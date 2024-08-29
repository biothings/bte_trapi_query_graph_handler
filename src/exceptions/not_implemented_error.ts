export default class NotImplementedError extends Error {
  statusCode: number;
  constructor(message = 'Feature not implemented', ...params: string[]) {
    super(...params);

    Object.setPrototypeOf(this, NotImplementedError.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NotImplementedError);
    }

    this.name = 'NotImplementedError';
    this.message = message;
    this.statusCode = 501;
  }
}
