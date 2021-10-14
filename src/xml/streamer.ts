
import { Transform, TransformCallback } from 'stream';
import XMLStateMachine, { Type } from './state-machine';
import XMLStreamerParser, { ParserOptions } from './streamer-parser';

export default class XMLStreamer extends Transform {

    private stateMachine = new XMLStateMachine();
    private parser: XMLStreamerParser;

    constructor(options: ParserOptions) {
        super({
            readableObjectMode: true,
        });

        this.parser = new XMLStreamerParser(options);
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
