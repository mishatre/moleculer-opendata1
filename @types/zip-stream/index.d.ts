
/// <reference types="node" />

declare module 'zip-stream' {

    import { ZlibOptions } from "zlib";
    import { Readable, Transform } from 'stream';

    interface ZipStreamOptions {
        comment?: string;
        forceLocalTime?: boolean;
        forceZip64?: boolean;
        namePrependSlash?: boolean;
        store?: boolean;
        zlib?: ZlibOptions;
    }

    interface ZipStreamData {
        name?: string;
        comment?: string;
        date?: string | Date;
        mode?: number;
        namePrependSlash?: boolean;
        store?: boolean;
        type?: string;
    }

    class ZipStream extends Transform {
        constructor(options?: ZipStreamOptions);
        entry(source: Buffer | Readable | string, data: ZipStreamData, callback: (err: Error, entry: unknown) => void): ZipStream;
        finalize(): void;
        getBytesWritten(): number;
    }

    export default ZipStream;

}