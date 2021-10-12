
import { Writable, Readable, PipelineTransform, Transform, TransformCallback, EventEmitter } from 'stream';

interface Snapshot {
    start: bigint;
    input: number;
    output: number;
    end: bigint;
}

type BenchedTransform = Transform & { 
    name: string; 
    snapshots: Snapshot[],
    finished: boolean;
};

function formatBytes(bytes: number, decimals = 2) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];

    const i = Math.floor(Math.log(bytes) / Math.log(k));

    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export default function bench(items: any[], interval = 1000) {

    const benchingItems: BenchReadable[] = [];
    let timerId: NodeJS.Timer | null = null;

    for(const item of items) {
        if(items.indexOf(item) === 0) {
            benchingItems.push(benchifyReadable(item));
        } else if(items.indexOf(item) === items.length - 1) {
            benchingItems.push(benchifyWritable(item));
        } else {
            benchingItems.push(benchifyTransform(item));
        }
    }

    function log() {
        if (benchingItems.length === 0) {
            return;
        }

        let finishedCount = 0;

        const logItems = [];

        for(const item of benchingItems) {

            const bench = item.bench;

            if(bench.isFinished) {
                finishedCount++;
            }

            // if(bench.snapshots.length === 0) {
            //     continue;
            // }

            const stats = bench.snapshots.map((value, index, array) => ({
                waiting: index > 0 ? Number(value.start - array[index - 1].end) / 1e9 : 0,
                self: Number(value.end - value.start) / 1e9,
                input: value.input,
                output: value.output,
            }));

            const statsSum = stats.reduce((a,b) => {
                a.self += b.self;
                a.waiting += b.waiting;
                a.output += b.output;
                a.input += b.input;
                return a;
            }, { waiting: 0, self: 0, input: 0, output: 0, });

            const statsAvg = {
                waiting: statsSum.waiting / stats.length,
                self: statsSum.self / stats.length,
            }

            const lastChunk = bench.snapshots[bench.snapshots.length - 1];

            const speed = lastChunk ? lastChunk.output / (Number(lastChunk.end - lastChunk.start) / 1e9) : 0;
            const speedAvg = statsSum.output / statsSum.self;

            logItems.push({
                'Type': bench.type,
                'Input delay (avg)': `${(statsAvg.waiting * 1000).toFixed(0)} ms`,
                'Self time (avg)': `${(statsAvg.self * 1000).toFixed(0)} ms`,
                'Input': bench.inputObjectMode ? `${statsSum.input} obj` : formatBytes(statsSum.input),
                'Output': bench.outputObjectMode ? `${statsSum.output} obj` : formatBytes(statsSum.output),
                'Speed': bench.outputObjectMode ? `${(speed).toFixed(0)} obj/s` : `${formatBytes(speed)}/s`,
                'Speed (avg)': bench.outputObjectMode ? `${(speedAvg).toFixed(0)} obj/s` : `${formatBytes(speedAvg)}/s`,
                'Current chunk': bench.snapshots.length,
                'Finished': bench.isFinished,
            });

        }
        
        // console.clear();
        // console.table(logItems);

        if(benchingItems.length === finishedCount && timerId) {
            clearInterval(timerId);
        }
    }

    function startLogger() {
        timerId = setInterval(log, interval);        
    }

    function stopLogger() {
        if(timerId) {
            clearInterval(timerId);
        }
    }

    if(benchingItems.length > 0) {

        benchingItems[0].bench.once('started', () => {
            startLogger();
        });

        // benchingItems[benchingItems.length - 1].bench.once('close', () => {

        // });

    }

    return benchingItems as unknown as any[];

}

// function benchifyIterable(iterable: (source: Readable) => AsyncIterable<any>, name: string | number, cb: (name: string | number,start: [number, number], bytes: number, objectMode: boolean) => void) {
//     return async function*(source: Readable) {
//         const start = process.hrtime.bigint();
//         let objectMode = false;
//         let bytes = 0;
//         for await (const chunk of iterable(source)) {
//             if(chunk.length) {
//                 bytes += chunk.length;
//             } else if(typeof chunk === 'object') {
//                 if(!objectMode) {
//                     objectMode = true;
//                 }
//                 bytes++;
//             }
//             yield chunk;
//         }
//         if(start !== null) {
//             cb(name, start, bytes, objectMode);
//         }
//     }
// }

class Bench extends EventEmitter {

    public isStarted: boolean = false;
    public isFinished: boolean = false;

    public snapshots: any[] = [];
    private current: any = null;

    public inputObjectMode: boolean;
    public outputObjectMode: boolean;

    constructor(
        private stream: Readable | Writable,
        public type: 'readable' | 'writable' | 'transform'
    ) {
        super();

        if(stream instanceof Readable || stream instanceof Transform) {
            this.outputObjectMode = stream.readableObjectMode;
        } else {
            this.outputObjectMode = false;
        }

        if(stream instanceof Writable || stream instanceof Transform) {
            this.inputObjectMode = stream.writableObjectMode;
        } else {
            this.inputObjectMode = false;
        }

        // stream.on('drain', () => console.log('drain'))
        stream.on('abort', () => {
            console.log('abort');
        });
        stream.on('error', () => console.log('error'))
        stream.on('finish', () => console.log('finish'))
        stream.on('close', () => {
            this.isFinished = true;
            console.log('close')
        })
    }

    nextSnapshot(chunk?: any) {
        if(!this.isStarted) {
            this.isStarted = true;
            this.emit('started');
        }
        if(this.current !== null) {
            this.snapshots.push(this.current);
        }
        this.current = {
            start: process.hrtime.bigint(),
            input: chunk ? this.getChunkSize(chunk, true) : 0,
            output: 0,
            end: null,
        }
    }

    addChunk(chunk: any) {

        this.current.output += this.getChunkSize(chunk);

    }

    finishChunk() {
        this.current.end = process.hrtime.bigint();
    }

    finished() {
        if(!this.current.end) {
            this.current.end = process.hrtime.bigint();
        }
        this.snapshots.push(this.current);
        this.current = null;
        this.isFinished = true;
    }

    private getChunkSize(chunk: any, input = true) {
        if(this.stream instanceof Readable) {
            if (this.stream.readableObjectMode) {
                return 1;
            }
        } else if(this.stream instanceof Writable) {
            if (this.stream.writableObjectMode) {
                return 1;
            }
        }

        if(!Buffer.isBuffer(chunk)) {

            if(typeof chunk === 'object') {
                return 1;
            }

            return Buffer.from(chunk).length;
        }

        return chunk.length;
    }

}

type BenchReadable = (Readable | Writable) & { bench: Bench };

function benchStream(stream: Readable | Writable | Transform) {

    let type: "readable" | "writable" | "transform" = 'transform';

    if(stream instanceof Transform) {
        type = 'transform';
    } else if(stream instanceof Readable) {
        type = 'readable';
    } else if(stream instanceof Writable) {
        type = 'writable';
    }

    const bench = new Bench(stream, type);

    

}

function benchifyReadable(stream: Readable): BenchReadable {

    const bench = new Bench(stream, 'readable');

    const read = stream._read;
    const push = stream.push;

    stream._read = function (size: number) {
        bench.nextSnapshot();
        read.call(stream, size);
    }

    stream.push = function (chunk: any, encoding?: BufferEncoding) {

        if(chunk === null) {
            bench.finished();
            return push.call(stream, chunk, encoding);
        }

        bench.addChunk(chunk);

        const result = push.call(stream, chunk, encoding);

        bench.finishChunk();

        return result;

    }

    return Object.assign(stream, { bench });

}

function benchifyTransform(stream: Transform): BenchReadable {

    const bench = new Bench(stream, 'transform');

    const push = stream.push;
    const transform = stream._transform;
    const destroy = stream._destroy;
    const flush = stream._flush;

    stream.push = function(chunk: any, encoding?: BufferEncoding | undefined): boolean {
        bench.addChunk(chunk);
        return push.call(stream, chunk, encoding);
    }

    stream._transform = function(chunk: any, encoding: BufferEncoding, callback: TransformCallback) {

        bench.nextSnapshot(chunk);

        const cb = (error?: Error | null, data?: any) => {
            if(data) {
                push.call(stream, data, encoding);
            }
            bench.finishChunk();
            callback(error, null);
        }

        return transform.call(stream, chunk, encoding, cb);
    }

    stream._flush = function(callback: TransformCallback) {
        const cb = (error?: Error | null, data?: any) => {
            if(data) {
                push.call(stream, data);
            }
            bench.finished();
            callback(error, null);
        }
        return flush.call(stream, cb);
    }

    stream._destroy = function(error: Error | null, callback: (error: Error | null, ) => void) {
        console.log(error);
        return destroy.call(stream, error, callback);
    }

    return Object.assign(stream, { bench });

}

function benchifyWritable(stream: Writable): BenchReadable {
    const bench = new Bench(stream, 'writable');

    const write = stream._write;
    const writev = stream._writev;
    const destroy = stream._destroy;
    const final = stream._final;

    stream._write = function (chunk: any, encoding: BufferEncoding, callback: (error?: Error | null) => void) {

        bench.nextSnapshot(chunk);

        const cb = (error?: Error | null) => {
            bench.finishChunk();
            callback(error);
        }

        return write.call(stream, chunk, encoding, cb);

    }

    stream._writev = function (chunks: Array<{ chunk: any; encoding: BufferEncoding; }>, callback: (error?: Error | null) => void) {

        console.log('Multiple writes');
        return writev?.call(stream, chunks, callback);

    }

    stream._destroy = function(error: Error | null, callback: (error?: Error | null) => void) {
        console.log(error);
        return destroy.call(stream, error, callback);
    }

    stream._final = function(callback: (error?: Error | null) => void) {
        bench.finished();
        final.call(stream, callback);
    }

    return Object.assign(stream, { bench });

}


// function benchify(originalStream: Transform, name: string | number, cb: (name: string | number, start: [number, number], bytes: number, objectMode: boolean) => void) {

    


//     const snapshots = [];
//     let currentSnapshot: any = null;

//     const push      = originalStream.push;
//     const transform = originalStream._transform;
//     const flush     = originalStream._flush;

//     function getChunkLength(chunk: Buffer | Object, objectMode: boolean) {
//         if(objectMode) {
//             return 1;
//         }
//         return (chunk as Buffer).length;
//     }

//     originalStream.push = function (chunk: any, encoding?: BufferEncoding | undefined): boolean {

//         currentSnapshot.output += getChunkLength(chunk, writableObjectMode);

//         return push(chunk, encoding);
//     }

//     originalStream._transform = function (chunk, encoding, callback) {

//         currentSnapshot = {
//             start: process.hrtime.bigint(),
//             input: getChunkLength(chunk, readableObjectMode),
//             output: null,
//             end: null,
//         }

//         transform.call(originalStream, chunk, encoding, (error, data) => {
//             callback(error, data);
//             currentSnapshot.end = process.hrtime.bigint();
//             snapshots.push(currentSnapshot);
//             currentSnapshot = null;
//         });

//     }

//     originalStream._flush = function (callback: TransformCallback) {
//         flush.call(originalStream, callback);
//     }

//     return originalStream;

// }
