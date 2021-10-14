
import { Service as MoleculerService, Context } from 'moleculer';
import { Service, Action, Method } from 'moleculer-decorators';
import { pipeline } from 'stream/promises';
import { PipelineOptions } from 'stream';
import { PassThrough, Readable, Writable } from 'stream';
import path from 'path';
import unzip from 'unzip-stream';
import iconvLite from 'iconv-lite';
import bench from '../src/bench-stream';

interface PipelineBuilderOptions {
    input: Readable;
    output: Writable;
    encoding?: string;
    singleFile?: boolean;
    filename?: string;
    benchmark?: boolean;
}

@Service({
    name: 'zip',
    version: 1,
})
export default class ZipService extends MoleculerService {

    @Action({
        name: 'extractFile',
        rest: {
            method: 'POST',
            path: '/extract-file',
            // @ts-ignore
            type: 'stream',
        },
        visibility: 'published',
    })
    public async extractFile(ctx: Context<Readable, { filename: string, $responseType: string }>) {

        ctx.meta.$responseType = 'application/octet-stream';

        const output = new PassThrough();

        this.findAndExtractFile(ctx.params, ctx.meta.filename, output);

        return output;

    }

    @Action({
        rest: {
            method: 'POST',
            path: '/unzip-single',
            // @ts-ignore
            passReqResToParams: true,
            type: 'stream',
        },
        visibility: 'published',
    })
    public async unzipSingle(ctx: any) {

        ctx.meta.$responseType = 'application/octet-stream';

        const output = new PassThrough();

        this.unzipSingleFile(ctx.params, output);

        return output;

    }

    @Method
    private async findAndExtractFile(input: Readable, filename: string, output: Writable) {

        const unzipPipeline = this.buildUnzipPipeline({
            input,
            output,
            filename,
            singleFile: true,
        });

        try {
            await unzipPipeline();
            console.log('File unzipped')
        } catch (error) {
            console.log(error);
        }
    }

    @Method
    private async unzipSingleFile(input: Readable, output: Writable) {

        const unzipPipeline = this.buildUnzipPipeline({
            input,
            output,
            singleFile: true,
        })

        try {
            await unzipPipeline();
            console.log('File unzipped')
        } catch (error) {
            console.log(error);
        }
    }

    @Method
    private buildUnzipPipeline(options: PipelineBuilderOptions) {

        const pipelineItems: Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream> = [];

        pipelineItems.push(options.input);

        pipelineItems.push(unzip.Parse());

        if (options.encoding) {
            pipelineItems.push(iconvLite.decodeStream(options.encoding));
        }

        if (options.singleFile) {
            pipelineItems.push(
                // @ts-ignore
                async function* (source: Readable) {
                    for await (const entry of source) {

                        if(options.filename) {
                            if(entry.type !== 'File' || path.basename(entry.path) !== options.filename) {
                                continue;
                            }
                        }
                        
                        for await (const chunk of entry) {
                            yield chunk;
                        }
                    }
                }
            );
        }

        pipelineItems.push(options.output);

        const benchmark = options.benchmark || false;

        return (options?: PipelineOptions) => {

            const args = [];

            if(benchmark) {
                args.push(bench(pipelineItems));
            } else {
                args.push(pipelineItems);
            }

            if(options) {
                args.push(options);
            }

            return pipeline(...args as [Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream>, PipelineOptions])
        };

    }

}