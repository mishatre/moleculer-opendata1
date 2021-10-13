
import { Service as MoleculerService, ServiceBroker, ServiceSchema, ServiceSettingSchema } from 'moleculer';
import { Service, Action, Method } from 'moleculer-decorators';

import Client from 'ftp';
import { promisify } from 'util';
import fs from 'fs';
import unzip, { Entry } from 'unzip-stream';
import { Readable, PassThrough } from 'stream';
import { pipeline } from 'stream/promises';
// @ts-ignore
import XMLReader from 'xml-reader';
import LexerStream from '../src/lexer';
import KTRUParser from '../src/ktru-parser';
import bench from '../src/bench-stream';
import ArrayJSONStream from '../src/array-json-stream';

Client.prototype.get = promisify(Client.prototype.get);
Client.prototype.list = promisify(Client.prototype.list);

class FTPClient extends Client {
    
    list(path: string, useCompression: boolean): Promise<Client.ListingElement[]>;
    list(path: string): Promise<Client.ListingElement[]>;
    list(useCompression: boolean): Promise<Client.ListingElement[]>;
    list(): Promise<Client.ListingElement[]>;
    list(pathOrUseCompression?: string | boolean, useCompression?: boolean) {
        return new Promise((resolve, reject) => {

            const params = [];
            if(pathOrUseCompression) {
                params.push(pathOrUseCompression);
            } else if(useCompression) {
                params.push(useCompression);
            }

            const callback = (error: Error | null, listing: Client.ListingElement[] ) => {
                if(error) {
                    reject(error);
                } else {
                    resolve(listing)
                }
            }

            if(params.length === 2) {
                super.list(params[0] as string, params[1] as boolean, callback);
            } else if(params.length === 1) {
                super.list(params[0] as boolean, callback);
            } else {
                super.list(params[0] as boolean, callback);
            }

        })
    }

    get(path: string): Promise<NodeJS.ReadableStream>;
    get(path: string, useCompression: boolean): Promise<NodeJS.ReadableStream>;
    get(pathOrUseCompression?: string | boolean, useCompression?: boolean) {
        return new Promise((resolve, reject) => {

            const params = [];
            if(pathOrUseCompression) {
                params.push(pathOrUseCompression);
            } else if(useCompression) {
                params.push(useCompression);
            }

            const callback = (error: Error, stream: NodeJS.ReadableStream) => {
                if(error) {
                    reject(error);
                } else {
                    resolve(stream)
                }
            }

            if(params.length === 2) {
                super.get(params[0] as string, params[1] as boolean, callback);
            } else if(params.length === 1) {
                super.get(params[0] as string, callback);
            }

        })
    }
    
}

@Service({
    name: 'zakupki',
    dependencies: [
        'v1.zip'
    ],
    settings: {

    },
})
export default class ZakupkiService extends MoleculerService {

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

            const catalogPath = '/fcs_nsi/nsiKTRUNew';
            // const listing = await this.connection.list(catalogPath);

            const loadingFiles = [];

            // for(const element of listing) {
                // const inputStream = await this.connection.get(`${catalogPath}/${element.name}`);
                const unzippedStream = fs.createReadStream('./zakupki/nsiKTRU_all_20211009010000_001.xml.zip');
                // const unzippedStream = await this.broker.call('v1.zip.unzipSingle', inputStream) as Readable;

                const output = fs.createWriteStream('./text.txt');

                pipeline(
                    // bench(
                        [
                            unzippedStream,
                            new LexerStream({
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

                // const reader = XMLReader.create({
                //     stream: true,
                //     parentNodes: false,
                // });

                // reader.on('tag', (name: any, data: any) => console.log(`received a ${name} tag:`, data));

                // reader.on('tag:oos:data', (data: any) => {
                //     console.log(data)
                //     // for(const element of data.children) {

                //     //     const [_, localname] =(element.name as string).split(':');


                //     // }
                    
                // })

                // for await(const chunk of unzippedStream) {
                //     reader.parse(chunk.toString());
                // }


            // }

            // const loadingFiles = listing.map((value) => 
            //     this.connection.get(`${filename}/${value.name}`).then(async inputStream => {
            //         const unzippedStream = await this.broker.call('v1.zip.unzipSingle', inputStream) as Readable;
            //         const ouput = fs.createWriteStream(`./zakupki/${value.name}`);
            //         return pipeline(unzippedStream, ouput);
            //     });
            // );

            // await Promise.all(loadingFiles);


        } catch(error) {
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

            this.connection.connect({
                host: 'ftp.zakupki.gov.ru',
                port: 21,
                user: 'free',
                password: 'free'
            });
        });

    }

    private stopped() {

        this.connection.once('close', () => {
            this.connection.removeAllListeners();
            // this.connection = null;
        })

        this.connection.end();
    }

}