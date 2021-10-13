
import { Transform, TransformCallback } from 'stream';
import XMLStateMachine, { Type } from './state-machine';
import XMLStreamerParser from './streamer-parser';

export default class XMLStreamer extends Transform {

    private streamingTag: string;

    private stateMachine = new XMLStateMachine();
    private parser: XMLStreamerParser;

    constructor(options: { streamingTag?: string }) {
        super({
            readableObjectMode: true,
        });

        if (!options.streamingTag) {
            throw new Error('options.streamingTag must be provided');
        }

        this.streamingTag = options.streamingTag;
        this.parser = new XMLStreamerParser(this.streamingTag);
    }

    step(char: string) {

        for (const [type, value] of this.stateMachine.next(char)) {
            const object = this.parser.produce(type, value);
            if (object) {
                this.push(object);
            }
        }

    }

    _transform(chunk: string | Buffer, encoding: BufferEncoding, callback: TransformCallback) {

        if (Buffer.isBuffer(chunk)) {
            chunk = chunk.toString();
        }

        for (const char of chunk) {
            this.step(char);
        }

        callback();

    }

    _flush(callback: TransformCallback) {
        callback();
    }

}
