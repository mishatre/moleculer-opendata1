import { Readable, Transform, TransformCallback, TransformOptions } from 'stream';

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const PNG_IEND = Buffer.from([0x49, 0x45, 0x4e, 0x44]);
// IEND Offset for CRC code (4 byte);
const PNG_IEND_OFFSET = 4;

class PngSplitter extends Transform {

    private firstChunk = true;
    private buffer: Uint8Array = new Uint8Array;

    private currentStream?: Readable;
    private streamIndex = 0;


    constructor(options?: TransformOptions) {
        super({
            encoding: 'hex',
            ...options,
        });
    }

    _transform(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {
        if (!Buffer.isBuffer(chunk)) {
            chunk = Buffer.from(chunk);
        }
        this.processChunk(chunk, encoding);
        callback();
    }

    private createStream() {
        this.currentStream = new Readable({
            read: () => { },
        });
        this.emit('data', this.currentStream, this.streamIndex);
        this.streamIndex++;
    }

    private processChunk(chunk: Buffer, encoding: BufferEncoding) {

        if (this.firstChunk) {
            this.firstChunk = false;
            if (chunk.indexOf(PNG_SIGNATURE) !== 0) {
                throw new Error('Incorrect stream. PNG signature is not found');
            }
        }

        let chunkLength = chunk.length;

        if (this.buffer?.length && this.buffer.length > 0) {
            chunkLength += this.buffer.length;
            chunk = Buffer.concat([this.buffer, chunk], chunkLength);
        }

        let pos = 0;
        let end = 0;
        let offset = 0;

        while ((pos = chunk.indexOf(PNG_IEND, offset, encoding)) !== -1) {
            end = pos + PNG_IEND.length + PNG_IEND_OFFSET;
            if(end > chunkLength) {
                this.stashBuffer(chunk, pos, chunkLength);
                this.pushChunk(chunk.slice(offset, pos), encoding);
                offset = pos;
            } else if(end === chunkLength) {
                this.pushChunk(chunk.slice(offset, end), encoding, true);
                offset = end;
            } else {
                this.pushChunk(chunk.slice(offset, end), encoding, true);
                offset = end;
            }
        }

        if (offset !== chunkLength) {
            this.stashBuffer(chunk, chunkLength - PNG_IEND.length, chunkLength);
            this.pushChunk(chunk.slice(offset, chunkLength - PNG_IEND.length), encoding);
        }

    }

    private stashBuffer(chunk: Buffer, start: number, end: number) {
        this.buffer = new Uint8Array(end - start);
        chunk.copy(this.buffer, 0, start, end);
    }

    private pushChunk(chunk: Buffer, encoding: BufferEncoding, end = false) {

        if (!this.currentStream) {
            this.createStream();
        }

        this.currentStream?.push(chunk, encoding);

        if (end) {
            this.currentStream?.push(null, encoding);
            this.currentStream = undefined;
        }

    }

}


// const splitter = new PngSplitter();
// splitter.on('data', (stream: Readable, index: number) => {
//     // console.log('Stream', index);
//     const write = createWriteStream(`./result/file1-${index}.png`, { encoding: 'hex' });
//     stream.pipe(write);
// })

// pipeline(
//     createReadStream('./input/data.png'),
//     splitter,
//     (err) => {
//         if (err) {
//             console.error('Pipeline failed.', err);
//         } else {
//             console.log('Pipeline succeeded.');
//         }
//     }
// )

// const read = createReadStream('./download.png');
// const write = createWriteStream('./input/data.png', { encoding: 'hex' });
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);
// read.pipe(write);

export default PngSplitter;