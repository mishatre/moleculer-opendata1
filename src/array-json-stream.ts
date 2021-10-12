
import { Transform, TransformCallback } from 'stream';

export default class FlatArrayJSONStream extends Transform {
    private started = false;
    private objectsSoFar = 0;

    private buffer: any[] = [];

    constructor() {
        super({
            writableObjectMode: true,
            readableObjectMode: false,
            writableHighWaterMark: 100,
        });
    }

    public _transform(entry: {[key: string]: any}, encoding: BufferEncoding, cb: TransformCallback) {

        const prefix = this.getPrefix();
        this.push(prefix + JSON.stringify(entry), encoding);
        this.objectsSoFar++;
        
        cb();

    }

    public _destroy(error: Error | null, callback: (error: Error | null) => void) {
        console.log(error)
        callback(null);
    }

    public _flush(cb: TransformCallback) {
        // console.log('Done', 'Total object - ', this.objectsSoFar);
        this.push(']');
        cb();
    }

    private getPrefix() {
        if(!this.started) {
            this.started = true;
            return '[';
        } else {
            return ',';
        }
    }
}