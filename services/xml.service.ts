
import { Service as MoleculerService, Context } from 'moleculer';
import { Service, Action, Method } from 'moleculer-decorators';
import { pipeline } from 'stream/promises';
import { Readable, Writable, PassThrough, PipelineOptions } from 'stream';
import ArrayJSONStream from '../src/array-json-stream';
import XMLStreamer from '../src/xml';
import bench from '../src/bench-stream';


interface PipelineBuilderOptions {
    input: Readable;
    output: Writable;
    xmlOptions?: XMLParserOptions;
    json?: boolean;
    benchmark?: boolean;
}

interface XMLParserOptions {
    streamingTag?: string;
    ignoreAttrs?: boolean;
}

@Service({
    name: 'xml',
    version: 1,
})
export default class XMLService extends MoleculerService {

    @Action({
        name: 'toJSON',
        rest: {
            method: 'POST',
            path: 'to/json',
            // @ts-ignore
            type: 'stream',
        },
        visibility: 'published'
    })
    public async toJSON(ctx: Context<Readable, { xmlOptions?: XMLParserOptions }>) {

        const output = new PassThrough();

        this.XMLToJSON(ctx.params, output, ctx.meta.xmlOptions);

        return output;

    }

    @Action({
        name: 'toJS',
        rest: {
            method: 'POST',
            path: 'to/js',
            // @ts-ignore
            type: 'stream',
        },
        visibility: 'published'
    })
    public async toJS(ctx: Context<Readable, { xmlOptions?: XMLParserOptions }>) {

        const output = new PassThrough({ objectMode: true });

        this.XMLToJS(ctx.params, output, ctx.meta.xmlOptions);

        return output;

    }

    @Method
    private async XMLToJS(input: Readable, output: Writable, xmlOptions?: XMLParserOptions) {

        const xmlPipeline = this.buildXMLPipeline({
            input,
            output,
            xmlOptions,
            json: false
        });

        try {
            await xmlPipeline();
        } catch (error) {
            console.log(error);
        }

    }

    @Method
    private async XMLToJSON(input: Readable, output: Writable, xmlOptions?: XMLParserOptions) {

        const xmlPipeline = this.buildXMLPipeline({
            input,
            output,
            xmlOptions,
            json: true
        });

        try {
            await xmlPipeline();
        } catch (error) {
            console.log(error);
        }

    }

    @Method
    private buildXMLPipeline(options: PipelineBuilderOptions) {

        const pipelineItems: Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream> = [];

        pipelineItems.push(options.input);

        const xmlOptions = options.xmlOptions || {};
        pipelineItems.push(new XMLStreamer(xmlOptions));

        if (options.json) {
            pipelineItems.push(new ArrayJSONStream());
        }

        pipelineItems.push(options.output);

        const benchmark = options.benchmark || false;

        return (options?: PipelineOptions) => {
            const args = [];

            if (benchmark) {
                args.push(...bench(pipelineItems));
            } else {
                args.push(...pipelineItems);
            }

            if (options) {
                args.push(options);
            }

            return pipeline(...args as [Array<NodeJS.ReadableStream | NodeJS.WritableStream | NodeJS.ReadWriteStream>, PipelineOptions])
        };

    }

}