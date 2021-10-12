
import { Service as MoleculerService } from 'moleculer';
import { Service, Action, Method } from 'moleculer-decorators';
import { pipeline } from 'stream/promises';
import { PassThrough, Readable, Writable } from 'stream';
import unzip, { Entry } from 'unzip-stream';

@Service({
    name: 'zip',
    version: 1,
})
export default class ZipService extends MoleculerService {

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
    private async unzipSingleFile(input: Readable, output: Writable) {
        try {
            await pipeline(
                input,
                unzip.Parse(),
                async function*(source) {
                    for await(const entry of source) {
                        for await (const chunk of entry) {
                            yield chunk;
                        }
                    }
                },
                output,
            );
            console.log('File unzipped')
        } catch(error) {
            console.log(error);
        }
    }

}