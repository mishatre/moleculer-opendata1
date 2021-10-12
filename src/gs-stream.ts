
import { spawn } from 'child_process';
import { types } from 'util';
import fs from 'fs';
import Duplexify from 'duplexify';

const isError = types.isNativeError;

const operators = Symbol();
const settings  = Symbol();

class GhostScript extends Duplexify {

    private input: string = '-';
    private output: string = '-sOutputFile=-';
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

    compress(resolution: number) {
        this[settings].push('-q');
        this[settings].push('-dNOPAUSE');
        this[settings].push('-dBATCH');
        this[settings].push('-dSAFER');
        this[operators].push('-sDEVICE=pdfwrite');
        this[operators].push('-dCompatibilityLevel=1.3');
        this[operators].push('-dPDFSETTINGS=/screen');
        this[operators].push('-dEmbedAllFonts=true');
        this[operators].push('-dSubsetFonts=true');
        this[operators].push('-dAutoRotatePages=/None');
        this[operators].push('-dColorImageDownsampleType=/Bicubic');
        this[operators].push(`-dColorImageResolution=${String(resolution)}`);
        this[operators].push('-dGrayImageDownsampleType=/Bicubic');
        this[operators].push(`-dGrayImageResolution=${String(resolution)}`);
        this[operators].push('-dMonoImageDownsampleType=/Subsample');
        this[operators].push(`-dMonoImageResolution=${String(resolution)}`);
        // this[operators].push('-sstdout', '%stderr');
        

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
        const cp = spawn('gs', this.args());
        
        cp.stdout.on('error', onerror);
        this.setReadable(cp.stdout);

        cp.stdin.on('error', onerror);
        this.setWritable(cp.stdin);

        cp.stderr.on('data', (chunk) => console.log(chunk.toString()));
        cp.stderr.on('error', onerror);

        return cp.stdout;

    }

    private args() {
        return this[settings].concat(this[operators], [this.output], [this.input]);
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

export default (src?: string) => new GhostScript(src);


