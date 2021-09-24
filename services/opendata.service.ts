
import { Service as MoleculerService, Context, Errors } from 'moleculer';
import { Action, Service } from 'moleculer-decorators';
import path from 'path';
import fs from 'fs';
import axios from 'axios';
import csvParseSync from 'csv-parse/lib/sync';
import ODCatalog from './opendata.catalog.json';


import parse from 'csv-parse';
import { PassThrough, Readable, Transform } from 'stream';
import { pipeline } from 'stream/promises';
import iconvLite from 'iconv-lite';
import unzip, { Entry } from 'unzip-stream';


// import type { Errors: { MoleculerRetryableError } } from 'moleculer';

interface MedproductsRecord {
    unique_number: string;
    registration_number: string;
    registration_date: string;
    registration_date_end: string;
    name: string;
    applicant: string;
    applicant_address_post: string;
    applicant_address_legal: string;
    producer: string;
    producer_address_post: string;
    producer_address_legal: string;
    okp: string;
    class: string;
    appointment: string;
    kind: string;
    address_production: string;
    details: string;
}

interface OpenDataCatalog {
    [key: string]: any;
}

interface CatalogRecord {
    name: string;
    url: string;
    meta: string;
    meta_type: string;
}

interface CatalogMeta {
    id: string;
    title: string;
    subject: string;
    description: string;
    creator: Date;
    format: 'CSV' | 'XML';
    created: Date;
    modified: Date;
    validBefore: Date;
    structure: {
        name: string;
        url: string;
    };
    current: string;
    previous: {

    }[]
}


interface ClassificatorInfo {
    id: string;
    name: string;
    description: string;
    meta_url: string;
    meta_type: string;
    created: Date,
    modified: Date,
    valid: Date,
    format: string;
    structure_url: string;
    data_url: string;
}

type PropertyValues = 'standardversion' | 
'identifier' | 
'title' | 
'description' | 
'creator' | 
'publishername' | 
'publisherphone' | 
'publishermbox' |
'format' |
'created' |
'modified' |
'provenance' |
'valid' |
'subject' |
`data-${number}-structure-${number}` | 
`structure-${number}`;

type RawClassificatorInfo = {
    property: PropertyValues, 
    value: string
};

interface Category {
    name: string;
    classificators: {
        [key: string]: {
            id: string;
            name: string;
            meta_url: string;
            meta_type: string;

            description: string;
            format: string;
            created: string;
            modified: string;
            valid: string;
            structure_url: string;
            data_url: string;
        }
    }
}

class ODCatalogNotFound extends Errors.MoleculerError {
    constructor(data?: unknown) {
        super('Requested catalog is not found in opendata catalog database', 500, "OD_CATALOG_NOT_FOUND", data);
    }
}

const formatDate = (dateString: string) => {
    return new Date(
        Number(dateString.substr(0, 4)),
        Number(dateString.substr(5, 2)), 
        Number(dateString.substr(8, 2))
    );
};

const delay = (time: number) => new Promise(resolve => setTimeout(resolve, time));

// META_URL: "https://roszdravnadzor.gov.ru/opendata/7710537160-medproducts/meta.csv"

@Service({
    name: 'opendata',
    version: 1,

    settings: {

        initialList: [
            {   
                name: "roszdravnadzor",
                url: "https://roszdravnadzor.gov.ru/opendata/list.csv"
            }
        ]

    }

})
export default class OpenDataService extends MoleculerService {

    // @Action({
    //     name: 'loadOpenData',
    //     params: {
    //         opendataCatalog: 'string', 
    //     }   
    // })
    // public async loadOpenData(ctx: Context<{ opendataCatalog: string }>) {

    //     const catalog = ctx.params.opendataCatalog;

    //     const catalogInfo = this.findCatalogInfo(catalog);

    //     if(!catalogInfo) {
    //         throw new ODCatalogNotFound();
    //     }

    //     return await this.getCatalogMetaInfo(catalogInfo)


    // }

    // private async fetchData(catalog: OpenDataCatalog) {

    //     // const response = await axios.get('https://roszdravnadzor.gov.ru/opendata/7710537160-medproducts/data-20210919-structure-20150601.zip', {
    //     //     responseType: 'stream',
    //     // });

    //     const response = {
    //         data: fs.createReadStream('./data.zip')
    //     }

    //     const parser = parse({
    //         columns: true,
    //         autoParseDate: true,
    //         delimiter: ';',
    //         relax: true,
    //     });

    //     await pipeline(
    //         response.data,
    //         unzip.Parse(),
    //         // @ts-ignore
    //         async function* (source: AsyncIterable<PassThrough>) {
    //             for await (const entry of source) {

    //                 pipeline(
    //                     entry,
    //                     iconvLite.decodeStream('win1251'),
    //                     parser,
    //                     async function* (source: AsyncIterable<Entry>) {
    //                         // @ts-ignore
    //                         for await (const chunk of source as AsyncIterable<MedproductsRecord>) {
    //                             const [name, content] = chunk.name.split('<br>');
    //                             const productionAddresses = chunk.address_production.split('\n');

    //                             const obj = {
    //                                 uid: Number(chunk.unique_number),
    //                                 number: chunk.registration_number,
    //                                 issuedDate: chunk.registration_date,
    //                                 validBefore: chunk.registration_date_end === '' ? null : chunk.registration_date_end,
    //                                 name: name,
    //                                 content,
    //                                 applicant: chunk.applicant,
    //                                 applicantLegalAddress: chunk.applicant_address_legal,
    //                                 producer: chunk.producer,
    //                                 producerLegalAddress: chunk.producer_address_legal,
    //                                 okp: chunk.okp,
    //                                 class: chunk.class,
    //                                 kind: Number(chunk.kind),
    //                                 productionAddresses,
    //                             }

    //                             yield obj;
    //                         }
    //                     }
    //                 )
    //             }
    //         },
    //         async function* (source: AsyncIterable<any>) {

    //             const s = new Set();

    //             for await (const chunk of source) {
    //                 if (!chunk.content) {
    //                     continue;
    //                 }
    //                 const content = (chunk.content as string);
    //                 if (content.includes(':')) {
    //                     const [first] = content.split(':');
    //                     s.add(first);
    //                 }

    //                 // break;
    //             }

    //             console.log([...s].join('\n'))

    //         }
    //     )


    // }


    // private findCatalogInfo(catalogName: string): CatalogRecord | null {

    //     // const data = ODCatalog.find((record: CatalogRecord) => record.name === catalogName);

    //     // if(data) {
    //     //     return data;
    //     // }

    //     return null;

    // }

    // private async getCatalogMetaInfo(catalog: CatalogRecord) {

    //     try {
    //         const url = path.join(catalog.url, catalog.meta);
    //         const response =  await axios.get(url);
    //         // console.log(response.status)

    //         if(response.status === 200) {

    //             switch(catalog.meta_type) {
    //                 case 'csv': return this.parseCSVMetaInfo(response.data);
    //             }
    //         }

    //         throw new Errors.MoleculerRetryableError(`Could not load meta info from -${url}`);

    //     } catch(error: unknown) {
    //         if(error instanceof Errors.MoleculerRetryableError) {
    //             throw error;
    //         }
    //         console.log(error)
    //     }

    // }


    // private parseCSVMetaInfo(metaInfo: string) {

    //     const mapping = {
    //         identifier: 'id',
    //         title: 'title',
    //         subject: 'subject',
    //         description: 'description',
    //         creator: 'creator',
    //         format: 'format',
    //         structure: 'structure',
    //     } as const;

    //     const data = csvParseSync(metaInfo, { columns: true });

    //     let createdString = '';

    //     const meta = {} as CatalogMeta;

    //     for(const { property, value } of data) {
    //         if(typeof property === 'string') {
    //             if(property in mapping) {
    //                 meta[mapping[property as keyof typeof mapping] as keyof CatalogMeta] = value;
    //             } else if(typeof value === 'string' && value !== '') {
    //                 switch(property) {
    //                     case 'created': {
    //                         createdString = value;
    //                         meta.created = new Date(Number(value.substr(0, 4)), Number(value.substr(5, 2)) - 1, Number(value.substr(-2)));
    //                         break;
    //                     }
    //                     case 'modified': {
    //                         meta.modified = new Date(Number(value.substr(0, 4)), Number(value.substr(5, 2)) - 1, Number(value.substr(-2)));;
    //                         break;
    //                     }
    //                     case 'valid': {
    //                         meta.validBefore = new Date(Number(value.substr(0, 4)), Number(value.substr(5, 2)) - 1, Number(value.substr(-2)));;
    //                         break;
    //                     }
    //                     default: {

    //                         if(property.startsWith('structure')) {
    //                             meta.structure = {
    //                                 name: property,
    //                                 url: value
    //                             }
    //                         }
    //                     }
    //                 }
    //             }
    //         }

    //         if(meta.structure && createdString) {

    //             const dataArray = data.filter(([property]: [string, string]) => property.startsWith('data'));

    //             for(const [property, value] of dataArray as [string, string][]) {

    //                 if(property === `data-${createdString}-${meta.structure}`) {
    //                     meta.current = value;
    //                 } else {
    //                     if(!meta.previous) {
    //                         meta.previous = [];
    //                     }
    //                     meta.previous.push(value);
    //                 }

    //             }
    //         }


    //     }

    //     return meta;

    // }

    // // INIT

    // private async initializeList(init = false) {

    //     if(init) {
    //         this.removeAllListItems();
    //     }

    //     for(const listItem of this.settings.initialList) {

    //         // if(init || !this.db.list.includes(listItem.name) || this.db.list.get(listItem.name).url !== listItem.url) {
    //             await this.loadListItem(listItem);
    //         // }

    //     }

    // }

    // private async fetchCSVData(url: string, useStream = true) {

    //     try {
    //         const options = useStream ? { responseType: 'stream' } as const : {};
    //         const response = await axios.get<Readable>(url, options);

    //         if(response.status === 200) {
    //             return response.data;
    //         }
    //     } catch(error) {
    //         // console.log(error);
    //     }

    //     return null;
    // }

    // private async *parseData(stream: Readable) {

    //     for await (const chunk of stream.pipe(parse({ columns: true, relax: true }))) {

    //         if(chunk.property === 'standardversion') {
    //             continue;
    //         }

    //         const data =  {
    //             id: chunk.property,
    //             name: chunk.title,
    //             meta_url: chunk.value,
    //             meta_type: chunk.format,

    //             description: "",
    //             format: '',
    //             created: '',
    //             modified: '',
    //             valid: '',
    //             structure_url: "",
    //             data_url: "",
    //         }

    //         const stream = await this.fetchCSVData(data.meta_url, false);

    //         if(stream === null) {
    //             console.log('FAILED');
    //             yield data;
    //             continue;
    //         }

    //         let maxStructureDate = null;
    //         let maxDataDate = null;
    //         for await (const { property, value } of stream.pipe(parse({ columns: true, relax: true })) as AsyncIterable<{property: keyof RawClassificator, value: string }>) {
    //             if(property in data) {
    //                 data[property] = value;
    //             } else if(property.startsWith('structure-')) {
    //                 const maxDate = Number(property.replace('structure-', ''));
    //                 if(!maxStructureDate) {
    //                     data.structure_url = value;
    //                     maxStructureDate = maxDate;
    //                 } else if(maxDate > maxStructureDate) {
    //                     data.structure_url = value;
    //                     maxStructureDate = maxDate;
    //                 }
    //             } else if(property.startsWith('data-')) {
    //                 const maxDate = Number(property.replace('data-', '').substr(0, 8));
    //                 if(!maxDataDate) {
    //                     data.structure_url = value;
    //                     maxDataDate = maxDate;
    //                 } else if(maxDataDate < maxDate) {
    //                     data.data_url = value;
    //                     maxDataDate = maxDate;
    //                 }
    //             }
    //         }
    //         console.log('SUCCESS');

    //         yield data;

    //     }

    // }
 
    // private async loadListItem(item: any) {

    //     const responseData = await this.fetchCSVData(item.url);

    //     if(responseData === null) {
    //         return;
    //     }

    //     const newCategory = {
    //         name: item.name,
    //         classificators: {},
    //     } as Category;

    //     for await (const row of this.parseData(responseData)) {
    //         newCategory.classificators[row.id] = row;
    //     }

    //     // console.log(newCategory);

    //     // const self = this;

    //     // try {
    //     //     await pipeline(
    //     //         responseData,
    //     //         parse({
    //     //             columns: true,
    //     //             relax: true,
    //     //         }),
    //     //         async function* (source) {
    //     //             let i = 0;
    //     //             for await (const chunk of source) {

    //     //                 if(i > 4) {
    //     //                     return;
    //     //                 }
    //     //                 i++;

    //     //                 if(chunk.property === 'standardversion') {
    //     //                     continue;
    //     //                 }

    //     //                 const id = chunk.property;

    //     //                 newCategory.classificators[id] = {
    //     //                     id: chunk.property,
    //     //                     name: chunk.title,
    //     //                     meta_url: chunk.value,
    //     //                     meta_type: chunk.format,

    //     //                     description: "",
    //     //                     format: '',
    //     //                     created: '',
    //     //                     modified: '',
    //     //                     valid: '',
    //     //                     structure_url: "",
    //     //                     data_url: "",
    //     //                 }

    //     //                 const responseData = await self.fetchCSVData(chunk.value);

    //     //                 if(responseData === null) {
    //     //                     continue;
    //     //                 }

    //     //                 try {
    //     //                     await pipeline(
    //     //                         responseData,
    //     //                         parse({
    //     //                             columns: true,
    //     //                             relax: true,
    //     //                         }),
    //     //                         async function (source: AsyncIterable<{property: keyof RawClassificator, value: string }>) {
    //     //                             let maxStructureDate = null;
    //     //                             let maxDataDate = null;
    //     //                             for await (const { property, value, ...rest } of source) {
    //     //                                 try {
    //     //                                     if(newCategory.classificators[id][property]) {
    //     //                                         newCategory.classificators[id][property] = value;
    //     //                                     } else if(property.startsWith('structure-')) {
    //     //                                         const maxDate = Number(property.replace('structure-', ''));
    //     //                                         if(!maxStructureDate) {
    //     //                                             newCategory.classificators[id].structure_url = value;
    //     //                                             maxStructureDate = maxDate;
    //     //                                         } else if(maxDate > maxStructureDate) {
    //     //                                             newCategory.classificators[id].structure_url = value;
    //     //                                             maxStructureDate = maxDate;
    //     //                                         }
    //     //                                     } else if(property.startsWith('data-')) {
    //     //                                         const maxDate = Number(property.replace('data-', '').substr(0, 8));
    //     //                                         if(!maxDataDate) {
    //     //                                             newCategory.classificators[id].structure_url = value;
    //     //                                             maxDataDate = maxDate;
    //     //                                         } else if(maxDataDate < maxDate) {
    //     //                                             newCategory.classificators[id].data_url = value;
    //     //                                             maxDataDate = maxDate;                                                
    //     //                                         }
    //     //                                     }
    //     //                                 } catch(error) {
    //     //                                     console.log(error)
    //     //                                 }
    //     //                             }
    //     //                         }
    //     //                     );
    //     //                 } catch(error) {
    //     //                     console.log('error1', error)
    //     //                 }

    //     //             }
    //     //         }
    //     //     )

    //     // } catch(error) {
    //     //     console.log('error', error)
    //     // }

    //     // console.log(newCategory)        


    // }

    // // 

    private async load() {

        let stream: Readable | null = null;

        const pathToList = path.join(__dirname, '..', 'roszdravnadzor', 'list.csv');
        if(!fs.existsSync(path.dirname(pathToList))) {
            fs.mkdirSync(path.dirname(pathToList));
        }
        if(fs.existsSync(pathToList)) {
            stream = fs.createReadStream(pathToList);
        } else {
            const response = await axios.get('https://roszdravnadzor.gov.ru/opendata/list.csv', { responseType: 'stream' });
            if (response.data) {
                stream = new PassThrough();
                response.data.pipe(stream);
                response.data.pipe(fs.createWriteStream(pathToList));
            }
        }

        if(!stream) {
            console.log('Cannot load list')
            return;
        }

        const parsingStream = await this.parseCaterogyList(stream);

        parsingStream
            .pipe(
                new Transform({
                    objectMode: true,
                    transform: (chunk, e, cb) => {
                        console.log(chunk)
                        cb();
                    }
                })
            )

    }

    private async fetchCategoryMetadata(url: string) {
        const filePath = path.join(__dirname, '../roszdravnadzor', path.dirname(url), path.basename(url));
        if(!fs.existsSync(path.dirname(filePath))) {
            fs.mkdirSync(path.dirname(filePath));
        }
        if (fs.existsSync(filePath)) {
            return fs.createReadStream(filePath);
        } else {
            const response = await axios.get(url, { responseType: 'stream' });                        
            if(response.data) {
                const stream = new PassThrough();
                response.data.pipe(stream)
                response.data.pipe(fs.createWriteStream(filePath));
                return stream;
            }
        }
    }

    private async parseCaterogyList(source: Readable) {

        const through = new PassThrough({
            objectMode: true,
        });

        const self = this;

        const oneToOneProperties = ['description', 'format'] as const;
        const dataProperties = ['created', 'modified', 'valid'] as const;

        pipeline(
            source,
            parse({
                columns: true,
            }),
            async function* (source: AsyncIterable<{ property: string; title: string; value: string; format: string }>) {
                for await (const row of source) {
                    if (row.property === 'standardversion') {
                        continue;
                    }

                    const data = {
                        id: row.property,
                        name: row.title,
                        meta_url: row.value,
                        meta_type: row.format,
                    } as ClassificatorInfo;

                    await delay(1000);
                    const stream = await self.fetchCategoryMetadata(data.meta_url);
                    if(!stream) {
                        console.log('Cannot load metadata', data.name);
                        continue;
                    }

                    let maxStructureDate = null;
                    let maxDataDate = null;

                    for await (const { property, value } of stream.pipe(parse({ columns: true })) as AsyncIterable<RawClassificatorInfo>) {
                        if (property === 'standardversion') {
                            continue;
                        }
                        if(oneToOneProperties.includes(property)) {
                            data[property as keyof ClassificatorInfo] = (value as any);
                        } else if(property in dataProperties) {
                            data[property] = formatDate(value);
                        } else if(property.startsWith('structure')) {
                            const maxDate = formatDate(property.replace('structure-', ''));
                            if(!maxStructureDate || maxDate > maxStructureDate) {
                                data.structure_url = value;
                                maxStructureDate = maxDate;
                            }
                        } else if(property.startsWith('data')) {
                            const maxDate = formatDate(property.replace('data-', '').substr(0, 8));
                            if(!maxDataDate || maxDate > maxDataDate) {
                                data.data_url = value;
                                maxDataDate = maxDate;
                            }
                        }
                    }

                    yield data;
                }
            },
            async function* (source) {
                for await (const data of source) {
                    await delay(1000);
                    const stream = await self.fetchCategoryMetadata(data.meta_url);
                    if(!stream) {
                        console.log('Cannot load metadata', data.name);
                        continue;
                    }

                    

                    yield data;
                }
            },
            through
        );

        return through;

    }


    private async started() {

        this.load();



    }




};