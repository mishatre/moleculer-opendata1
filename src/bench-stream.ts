
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
        const index = items.indexOf(item);
        if(index === 0) {
            benchingItems.push(benchifyReadable(item, index));
        } else if(index === items.length - 1) {
            benchingItems.push(benchifyWritable(item, index));
        } else {
            benchingItems.push(benchifyTransform(item, index));
        }
    }

    function log() {
        if (benchingItems.length === 0) {
            return;
        }

        let finishedCount = 0;

        const logItems = [];

        for(const item of benchingItems) {
            const stats = item.bench.getStats();
            if(item.bench.isFinished) {
                finishedCount++;
            }
            logItems.push(stats);
        }
        
        console.clear();
        console.table(logItems);

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

    public snapshots: Snapshot[] = [];
    private current: any = null;

    public inputObjectMode: boolean;
    public outputObjectMode: boolean;

    public hasInput: boolean = false;
    public hasOutput: boolean = false;

    constructor(
        private index: number,
        private stream: Readable | Writable,
        public type: 'readable' | 'writable' | 'transform'
    ) {
        super();

        this.hasInput = stream instanceof Writable;
        this.hasOutput = stream instanceof Readable;

        this.inputObjectMode = (this.hasInput && (stream as Writable).writableObjectMode) || false;
        this.outputObjectMode = (this.hasOutput && (stream as Readable).readableObjectMode) || false;

        // stream.on('drain', () => console.log('drain'))
        // stream.on('abort', () => {
        //     console.log('abort');
        // });
        // stream.on('error', (error) => console.log('error'))
        // stream.on('finish', () => console.log('finish'))
        // stream.on('close', () => {
        //     this.isFinished = true;
        //     console.log('close')
        // })
    }

    private outNumber(number: bigint) {
        return Number(number / 1000000n).toFixed(0)
    }

    public getStats() {

        const statObject = {
            type: this.type,
        } as { [key: string]: any };

 
        const stats = {
            waiting: 0n,
            waitingTotal: 0n,
            waitingAvg: 0n,
            self: 0n,
            selfTotal: 0n,
            selfAvg: 0n,
            input: 0,
            inputTotal: 0,
            output: 0, 
            outputTotal: 0,
            speed: 0,
            speedAvg: 0,
        }
        for(let i = 0; i < this.snapshots.length; i++) {

            const { input, output, start, end } = this.snapshots[i]; 

            stats.waiting = i > 0 ? start - this.snapshots[i - 1].end : 0n;
            stats.waitingTotal += stats.waiting;
            stats.self = end - start;
            stats.selfTotal += stats.self;
            stats.input = input;
            stats.inputTotal += stats.input;
            stats.output = output;
            stats.outputTotal += stats.output;
 
        }

        stats.waitingAvg = stats.waitingTotal / BigInt(this.snapshots.length);
        stats.selfAvg = stats.selfTotal / BigInt(this.snapshots.length);

        stats.speed = Number(BigInt(stats.output) * 12500000000n / stats.self) / 10;
        stats.speedAvg = Number(BigInt(stats.outputTotal) * 12500000000n / stats.selfTotal) / 10;

        statObject['Input delay (avg)'] = this.hasInput ? `${this.outNumber(stats.waitingAvg)} ms` : `-`;
        statObject['Self time (avg)'] = `${this.outNumber(stats.selfAvg)} ms`;
        statObject['Self (total)'] = `${this.outNumber(stats.selfTotal)} ms`;
        statObject['Input'] = this.hasInput ? (this.inputObjectMode ? `${stats.inputTotal} obj` : formatBytes(stats.inputTotal)) : `-`;
        statObject['Output'] = this.hasOutput ? (this.outputObjectMode ? `${stats.outputTotal} obj` : formatBytes(stats.outputTotal)) : `-`;
        statObject['Speed'] = this.outputObjectMode ? `${(stats.speed).toFixed(0)} obj/s` : `${formatBytes(stats.speed)}/s`;
        statObject['Speed (avg)'] = this.outputObjectMode ? `${(stats.speedAvg).toFixed(0)} obj/s` : `${formatBytes(stats.speedAvg)}/s`;
        statObject['Chunk'] = this.snapshots.length;
        statObject['Finished'] = this.isFinished;

        return statObject;

    }

    nextSnapshot(chunk?: any, multipleWrite?: boolean) {
        if(!this.isStarted) {
            this.isStarted = true;
            this.emit('started');
        }
        if(this.current !== null) {
            this.snapshots.push(this.current);
        }

        const input = chunk ? ( multipleWrite ? this.getChunksSize(chunk) : this.getChunkSize(chunk) ) : 0;

        this.current = {
            start: process.hrtime.bigint(),
            input,
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

    private getChunksSize(chunks: any): number {
        if(Array.isArray(chunks)) {
            const size = chunks.reduce((acc, { chunk }) => acc + this.getChunkSize(chunk), 0) as number;
            return size;
        }
        return 1;
    }

    private getChunkSize(chunk: any): number {

        if(typeof chunk === 'string') {
            return Buffer.from(chunk).length;
        } else if(Buffer.isBuffer(chunk)) {
            return chunk.length;
        } else {
            return 1;
        }

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

    const bench = new Bench(0, stream, type);

    

}

function benchifyReadable(stream: Readable, index: number): BenchReadable {

    const bench = new Bench(index, stream, 'readable');

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

function benchifyTransform(stream: Transform, index: number): BenchReadable {

    const bench = new Bench(index, stream, 'transform');

    const push = stream.push;
    const transform = stream._transform;
    const destroy = stream._destroy;
    const flush = stream._flush;

    stream.push = function(chunk: any, encoding?: BufferEncoding | undefined): boolean {
        if(chunk !== null) {
            bench.addChunk(chunk);
        }
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

        if(!flush) {
            bench.finished();
            callback(null, null);
            return;
        }

        bench.nextSnapshot();

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
        return destroy.call(stream, error, callback);
    }

    return Object.assign(stream, { bench });

}

function benchifyWritable(stream: Writable, index: number): BenchReadable {
    const bench = new Bench(index, stream, 'writable');

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

        bench.nextSnapshot(chunks, true);

        const cb = (error?: Error | null) => {
            bench.finishChunk();
            callback(error);
        }

        return writev?.call(stream, chunks, cb);

    }

    stream._destroy = function(error: Error | null, callback: (error?: Error | null) => void) {
        return destroy.call(stream, error, callback);
    }

    stream._final = function(callback: (error?: Error | null) => void) {
        bench.finished();

        if(final) {
            final.call(stream, callback);
        } else {
            callback(null);
        }
   
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
