
import { spawn } from 'child_process';
import { types } from 'util';
import fs from 'fs';
import Duplexify from 'duplexify';

const isError = types.isNativeError;

const operators = Symbol();
const settings  = Symbol();

class ImageMagick extends Duplexify {

    private input: string = '-';
    private output: string = '-';
    private isSpawned: boolean = false;

    private [operators]: string[] = [];
    private [settings]: string[] = [];

    constructor(src?: string) {
        super();

        this[operators] = [];
        this[settings] = [];

        if(src) {
            this.from(src);
        }

    }

    resume() {
        if(!this.isSpawned) {
            this.spawn();
        }
        this.isSpawned = true;
        super.resume();
        return this;
    }

    inputFormat(args: string) {
        this.input = `${args}:-`;
        return this;
    }

    outputFormat(args: string) {
        this.output = `${args}:-`;
        return this;
    }

    quality(value: number) {
        this[operators].push('-quality', String(value));
        return this;
    }

    resize(args: string) {
        this[operators].push('-resize', args);
        return this;
    }

    scale(args: string) {
        this[operators].push('-scale', args);
        return this;
    }

    compress(args: string) {
        this[operators].push('-compress', args);
        return this;
    }

    extent(args: string) {
        this[operators].push('-extent', args);
        return this;
    }

    crop(args: string) {
        this[operators].push('-crop', args);
        return this;
    }

    gravity(args: string) {
        this[operators].push('-gravity', args);
        return this;
    }

    thumbnail(args: string) {
        this[operators].push('-thumbnail', args);
        return this;
    }

    autoOrient() {
        this[operators].push('-auto-orient');
        return this;
    }

    tags(args: string) {
        this[operators].push('-tags', args);
        return this;
    }

    annotate(degrees: string, text: string) {
        this[operators].push('-annotate', degrees, text);
        return this;
    }

    append(horizontalJoin: boolean) {
        let joinStrategy = horizontalJoin ? '+' : '-';
        this[operators].push(joinStrategy + 'append');
        return this;
    }

    density(value: number) {
        this[operators].push('-density', String(value));
        return this;
    }

    depth(value: number) {
        this[operators].push('-depth', String(value));
        return this;
    }

    set(key: string, value?: string | string[]) {
        this[settings].push(`-${key}`);
        if(!value) {
            return this;
        }
        if(!Array.isArray(value)) {
            value = [value];
        }
        value.forEach(v => this[settings].push(v));
        return this;
    }

    op(key: string, value?: string | string[]) {
        this[operators].push(`-${key}`);
        if(!value) {
            return this;
        }
        if(!Array.isArray(value)) {
            value = [value];
        }
        value.forEach(v => this[operators].push(v));
        return this;
    }

    from(path: string) {
        const read = fs.createReadStream(path);
        read.on('error', this.onerror);
        read.pipe(this);
        return this;
    }

    to(path: string) {
        const write = fs.createWriteStream(path);
        write.on('error', this.onerror);
        this.pipe(write);
        return write;
    }

    spawn() {
        const onerror = this.onerror.bind(this);
        // console.log(this.args().join(' '))
        const cp = spawn('convert', this.args());
        
        cp.stdout.on('error', onerror);
        this.setReadable(cp.stdout);

        cp.stdin.on('error', onerror);
        this.setWritable(cp.stdin);

        cp.stderr.on('data', (chunk) => console.log(chunk.toString()));
        cp.stderr.on('error', onerror);

        return cp.stdout;

    }

    private args() {
        return this[settings].concat([this.input], this[operators], [this.output]);
    }

    private onerror(error: unknown) {
        if(!isError(error)) {
            error = new Error(error as string);
        }
        if(!this.listeners('error')) {
            throw error;
        }
        this.emit('error', error);
    }

}

export default (src?: string) => new ImageMagick(src);


