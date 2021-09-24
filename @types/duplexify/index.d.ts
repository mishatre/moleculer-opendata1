
/// <reference types="node" />

declare module 'duplexify' {

  import * as stream from "stream";

  class Duplexify extends stream.Duplex {
    constructor(writable?: stream.Writable, readable?: stream.Readable, streamOptions?: stream.DuplexOptions);
    cork(): void;
    uncork(): void;
    setWritable(writable: stream.Writable): void;
    setReadable(readable: stream.Readable): void;
  }

  export = Duplexify;

}
