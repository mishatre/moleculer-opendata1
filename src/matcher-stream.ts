
import { Transform, TransformCallback } from 'stream';

type Options = {
    skipFirst?: boolean;
};

export default class MatcherStream extends Transform {

    private data: Buffer = Buffer.from([]);
    private pattern: Buffer;
    private requiredLength: number;

    private skipFirst = false;

    private i = 0;

    constructor(pattern: string | Buffer, options?: Options) {
        super({
            objectMode: true,
        });

        this.pattern = Buffer.isBuffer(pattern) ? pattern : Buffer.from(pattern);
        this.requiredLength = this.pattern.length;

        this.skipFirst = options?.skipFirst || false;

    }

    public _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {

        this.data = Buffer.concat([this.data, chunk]);

        let firstIteration = true;
        while(this.checkDataChunk(!firstIteration)) {
            firstIteration = false;
        }

        callback();
    }

    public _flush(callback: TransformCallback) {
        if(this.data.length > 0) {
            let firstIteration = true;
            while(this.checkDataChunk(!firstIteration)) {
                firstIteration = false;
            }
        }

        if(this.data.length > 0) {
            this.push(this.data);
            this.data = Buffer.from([]);
        }

        callback();
    }

    private checkDataChunk(ignoreMatchZero: boolean) {

        const enoughData = this.data.length >= this.requiredLength;

        if(!enoughData) {
            return;
        }

        const matchIndex = this.data.indexOf(this.pattern, ignoreMatchZero ? 1: 0);

        if(matchIndex === -1) {
            return false;
        }

        if(matchIndex > 0) {
            const packet = this.data.slice(0, matchIndex);
            if(!this.skipFirst) {
                this.push(packet);
            }
            this.skipFirst = false;
            this.data = this.data.slice(matchIndex);
        }

        return true;

    }



}