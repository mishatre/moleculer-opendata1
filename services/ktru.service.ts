
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

import csvstringify from 'csv-stringify';

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
        // 'v1.s3',
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

    @Action({})
    public async xmlAction(ctx: any) {
        const input = fs.createReadStream('./word/document.docx');

        const unzippedFile = await this.broker.call('v1.zip.extractFile', input, {
            meta: {
                filename: 'document.xml',
            }
        });

        const jsonStream = await this.broker.call('v1.xml.toJS', unzippedFile, {
            meta: {
                xmlOptions: {
                    ignoreAttrs: true,
                    streamingTag: 'tr',
                }
            }
        }) as Readable;

        await pipeline(
            jsonStream,

            async function* (stream) {

                const table = [];

                for await (const row of stream) {

                    const newRow: any[] = [];

                    row.tc.forEach((row: any) => {
                        if (!row.p.r?.t) {
                            console.log(row.p);
                        }

                        let p = row.p;
                        if (!Array.isArray(row.p)) {
                            p = [row.p];
                        }

                        const value = p.map(({ r }: any) => {

                            if (!Array.isArray(r)) {
                                r = [r];
                            }

                            return r.map(({ t }: any) => {
                                return t;
                            }).join('');

                        }).join('\n');

                        newRow.push(value);
                    });

                    table.push(newRow);

                }

                const finalTable = [];

                for (let i = 0; i < table.length; i++) {
                    const row = table[i];

                    const newRow = [];

                    if (i === 0) {

                        for (const cell of row) {
                            switch (cell) {
                                case 'Артикул': {
                                    newRow.push(cell);
                                    break;
                                }
                                case 'Фирменное наименование': {
                                    newRow.push("Наименование");
                                    break;
                                }
                                case 'Наименование в соответствии с РУ': {
                                    newRow.push("НаименованиеОбщее");
                                    break;
                                }
                                case 'Сведения о РУ': {
                                    newRow.push("НомерРУ");
                                    newRow.push("ДатаРУ");
                                    newRow.push("НомерСтрокиРУ");
                                    break;
                                }
                                case 'Код вида МИ': {
                                    newRow.push("КодМИ");
                                    break;
                                }
                                case 'Код позиции КТРУ': {
                                    newRow.push("КодКТРУ");
                                    break;
                                }
                                case 'Доп характеристики текст': {
                                    newRow.push("Текст");
                                    break;
                                }
                            }
                        }

                    } else {
                        for (let j = 0; j < row.length; j++) {
                            switch (j) {
                                case 0: {
                                    newRow.push(row[j]);
                                    break;
                                }
                                case 1: {
                                    newRow.push(row[j]);
                                    break;
                                }
                                case 2: {
                                    newRow.push(row[j]);
                                    break;
                                }
                                case 3: {
                                    // RU
                                    // ФСЗ 2011/09128 от 27.08.2019
                                    const value = row[j] as string;
                                    newRow.push(value.substring(0, value.length - 14));
                                    newRow.push(value.substr(-10));
                                    newRow.push('');
                                    break;
                                }
                                case 4:
                                case 5: {
                                    if (row[j] === '-') {
                                        newRow.push('');
                                    } else {
                                        newRow.push(row[j]);
                                    }
                                    break;
                                }
                                case 6: {
                                    newRow.push(row[j]);
                                    break;
                                }
                            }
                        }
                    }

                    yield newRow;

                }



            },
            csvstringify({
                delimiter: '\t',

            }),
            fs.createWriteStream('./word/output.json')
        );

    }

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

        return;

        const bucketExist = await this.broker.call('v1.s3.bucketExists', {
            bucketName: this.settings.bucketName,
        });

        if (!bucketExist) {
            await this.broker.call('v1.s3.makeBucket', {
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