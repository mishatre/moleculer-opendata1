
import { Service as MoleculerService } from 'moleculer';
import { Service, Action, Method } from 'moleculer-decorators';

import fs from 'fs';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
import XMLStreamer from '../src/xml';
import KTRUParser from '../src/ktru-parser';
import bench from '../src/bench-stream';
import ArrayJSONStream from '../src/array-json-stream';
import FTPClient from '../src/ftp';


interface ServiceSettings {
    catalog: string;
    ftp: {
        host: string;
        port: number;
        user: string;
        password: string;
    },
    bucketName: string;
}

@Service({
    name: 'ktru',
    dependencies: [
        'v1.zip',
        'v1.s3',
    ],
    settings: {
        ftp: {
            host: 'ftp.zakupki.gov.ru',
            port: 21,
            user: 'free',
            password: 'free'
        },
        catalog: '/fcs_nsi/nsiKTRUNew',
        bucketName: 'ktru',
    },
})
export default class KTRUService extends MoleculerService<ServiceSettings> {

    private connection: FTPClient = new FTPClient();
    private connected: boolean = false;

    @Action({
        timeout: 0,
    })
    public async someAction(ctx: any) {




        try {

            // if(!this.connected) {
            //     await this.initConnection();
            // }

            // const listing = await this.connection.list(this.settings.catalog);

            const loadingFiles = [];

            // for(const element of listing) {
            // const inputStream = await this.connection.get(`${this.settings.catalog}/${element.name}`);
            const unzippedStream = fs.createReadStream('./zakupki/nsiKTRU_all_20211009010000_001.xml.zip');
            // const unzippedStream = await this.broker.call('v1.zip.unzipSingle', inputStream) as Readable;

            const output = fs.createWriteStream('./text.txt');

            pipeline(
                // bench(
                [
                    unzippedStream,
                    new XMLStreamer({
                        streamingTag: 'nsiKTRUs',
                    }),
                    new KTRUParser(),
                    new ArrayJSONStream(),
                    output,
                ]
                // )
            ).catch(error => {
                console.log(111, error);
            }).then(() => {
                console.log('done');
            })

            // const loadingFiles = listing.map((value) => 
            //     this.connection.get(`${filename}/${value.name}`).then(async inputStream => {
            //         const unzippedStream = await this.broker.call('v1.zip.unzipSingle', inputStream) as Readable;
            //         const ouput = fs.createWriteStream(`./zakupki/${value.name}`);
            //         return pipeline(unzippedStream, ouput);
            //     });
            // );

            // await Promise.all(loadingFiles);


        } catch (error) {
            console.log(error);
        }

    }

    @Method
    private initConnection(): Promise<void> {

        return new Promise((resolve, reject) => {
            this.connection.on('ready', () => {
                this.connected = true;
                resolve();
            });
            this.connection.on('error', (error) => {
                reject(error);
            });
            this.connection.on('end', (error) => {
                this.connected = false;
            });

            this.connection.connect(this.settings.ftp);
        });

    }

    @Method
    private async listSaved() {
        const response = await this.broker.call('v1.s3.listObjects', {
            bucketName: this.settings.bucketName,
            prefix: ''
        });
    }

    @Method
    private async initStorage() {
        const bucketExist = await this.broker.call('s3.bucketExists', {
            bucketName: this.settings.bucketName,
        });

        if (!bucketExist) {
            await this.broker.call('s3.makeBucket', {
                bucketName: this.settings.bucketName,
                region: 'us-east-1',
            });
        }
    }

    private async started() {

        await this.initStorage();

        this.connection.once('close', () => {
            this.connection.removeAllListeners();
            // this.connection = null;
        });
    }

    private stopped() {

        this.connection.end();
    }

}