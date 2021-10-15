
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

    @Action({
        rest: {
            path: 'xmlAction',
            // @ts-ignore
            type: 'stream'
        },
    })
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

        const self = this;

        await pipeline(
            jsonStream,
            // new ArrayJSONStream(),
            async function* (stream) {

                const table = [];

                for await (const row of stream) {

                    const newRow: any[] = [];

                    if(row.tc) {
                        row.tc.forEach((row: any) => {

                            let p = row.p;
                            if (!Array.isArray(row.p)) {
                                p = [row.p];
                            }

                            const value = p.map(({ r }: any) => {

                                if (!Array.isArray(r)) {
                                    r = [r];
                                }

                                return r.map((value: any) => {
                                    if(value?.t) {
                                        if(typeof value.t === 'object') {
                                            return ' ';
                                        }
                                        return value.t;
                                    }
                                    return '';
                                }).join('');

                            }).join('##$$');

                            newRow.push(value);
                        });

                        table.push(newRow);
                    }

                }

                const rawHeader = [];
                const header = [];

                for (let i = 0; i < table.length; i++) {
                    const row = table[i];

                    if (i === 0) {
                        console.log(row)

                        for (const cell of row) {
                            const value = cell.replaceAll('##$$', '').trim();
                            switch (value) {
                                case 'Артикул': {
                                    header.push(value);
                                    rawHeader.push(value);
                                    break;
                                }
                                case 'Каталожный номер': 
                                case 'Фирменное наименование': {
                                    header.push("Наименование");
                                    rawHeader.push("Наименование");
                                    break;
                                }
                                case 'Наименование общее':
                                case 'Наименование в соответствии с РУ': {
                                    header.push("НаименованиеОбщее");
                                    rawHeader.push("НаименованиеОбщее");
                                    break;
                                }
                                case 'Сведения о РУ': {
                                    rawHeader.push("НомерРУ");
                                    header.push("НомерРУ");
                                    header.push("ДатаРУ");
                                    header.push("НомерСтрокиРУ");
                                    break;
                                }
                                case 'Вид МИ': 
                                case 'Код вида МИ': {
                                    header.push("КодМИ");
                                    rawHeader.push("КодМИ");
                                    break;
                                }
                                case 'КТРУ': 
                                case 'Код КТРУ':
                                case 'Код позиции КТРУ': {
                                    header.push("КодКТРУ");
                                    rawHeader.push("КодКТРУ");
                                    break;
                                }
                                case 'Описание (если требуется)': {
                                    header.push("Описание");
                                    rawHeader.push("Описание");
                                    break;
                                }
                                case 'Технические характеристики':
                                case 'Доп характеристика ТЕКСТ':
                                case 'Доп характеристики текст': {
                                    header.push("Текст");
                                    rawHeader.push("Текст");
                                    break;
                                }
                            }
                        }

                        yield header;

                    } else {

                        const newRow = [];

                        for (let j = 0; j < row.length; j++) {

                            const value = (row[j] as string).replaceAll('##$$', '').trim();

                            switch (rawHeader[j]) {
                                case 'Артикул': {
                                    newRow.push(value);
                                    break;
                                }
                                case 'Наименование': {
                                    newRow.push(value);
                                    break;
                                }
                                case 'НаименованиеОбщее': {
                                    newRow.push(value);
                                    break;
                                }
                                case 'НомерРУ': {
                                    // RU
                                    // ФСЗ 2011/09128 от 27.08.2019
                                    const value = row[j] as string;

                                    if(value === '' || value === '-' || value === 'нет РУ') {
                                        newRow.push('', '', '');
                                        break;
                                    }

                                    const s = /^(.*?)(?:\s{0,2}от\s{0,2}|\s{0,2})(?:(\d{2}\.\d{2}\.\d{4})\s{0,2}|\s{0,2})(?:п\.\s{0,2}(\d*)|$)/g;
                                    const result = s.exec(value);

                                    if(result) {
                                        const [_, number, date, position] = result;
                                        newRow.push(number);
                                        newRow.push(date);
                                        newRow.push(position || '');
                                    } else {
                                        newRow.push('', '', '');
                                    }
                                    
                                    break;
                                }
                                case 'КодМИ':
                                case 'КодКТРУ': {
                                    if (row[j] === '-') {
                                        newRow.push('');
                                    } else {
                                        newRow.push(row[j].trim().replaceAll('##$$', ',').replaceAll(',,', ','));
                                    }
                                    break;
                                }
                                case 'Описание': {
                                    newRow.push(row[j].trim());
                                    break;
                                }
                                case 'Текст': {
                                    newRow.push(row[j].trim());
                                    break;
                                }
                            }
                        }

                        yield newRow;

                    }


                }

            },
            // csvstringify({
            //     delimiter: '\t',
            //     // quote: '"',
            //     // quoted_string: true

            // }),

            async function*(stream) {

                yield '<ValueTable xmlns="http://v8.1c.ru/8.1/data/core" xmlns:xs="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">';

                let firstRow = true;

                const headers = [];
                const rows = [];

                for await(const row of stream) {
                    // console.log(row)
                    if(firstRow) {
                        for(const cell of row) {
                            headers.push({
                                name: cell,
                                type: cell === 'НомерСтрокиРУ' ? 'number' : 'string',
                                length: 0,
                            });
                        }
                        firstRow = false;
                    } else {
                        const rowArr = [];
                        for(const cell of row) {
                            const index = row.indexOf(cell);
                            headers[index].length = Math.max(headers[index].length, cell.length);
                            rowArr.push(`<Value>${cell}</Value>`)
                        }
                        rows.push(`\n\t<row>\n\t\t${rowArr.join('\n\t\t')}\n\t</row>`);
                    }
                }
                const rowsText = rows.join('');

                let headerText = '';
                for(const cell of headers) {
                    headerText += 
`
    <column>
        <Name xsi:type="xs:string">${cell.name}</Name>
        <ValueType>
            ${cell.type === 'numbre' ? `
                <Type>xs:decimal</Type>
                <NumberQualifiers>
                    <Digits>0</Digits>
                    <FractionDigits>0</FractionDigits>
                    <AllowedSign>Any</AllowedSign>
                </NumberQualifiers>
            `: `
                <Type>xs:string</Type>
                <StringQualifiers>
                    <Length>${cell.length}</Length>
                    <AllowedLength>Variable</AllowedLength>
                </StringQualifiers>
            `}
        </ValueType>
        <Title>${cell.name}</Title>
        <Width xsi:type="xs:decimal">9</Width>
    </column>`;
                }

                yield headerText;
                yield rowsText;                
                

                yield '\n</ValueTable>';

            },
            async function* (stream) {

                const inputStream = Readable.from(stream)

                const zipStream = await self.broker.call('v1.zip.compress', inputStream, { meta: {filename: 'document.xml'} }) as Readable;

                for await (const chunk of zipStream) {
                    yield chunk;
                }

            }, 
            fs.createWriteStream('./word/document.VT_')
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