import Body from '../body.js';

export default class ClientResponse extends Body {
  get headers () {
    return this.raw.headers;
  }

  get status () {
    return this.raw.statusCode;
  }

  get statusMessage () {
    return this.raw.statusMessage;
  }
}