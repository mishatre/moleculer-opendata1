
import { Service as MoleculerService, Context, Errors } from 'moleculer';
import { Action, Event, Method, Service } from 'moleculer-decorators';
import path from 'path';
import fs from 'fs';
import { URL } from 'url';
import axios from 'axios';

import MatcherStream from '../src/matcher-stream';
import ArrayJSONStream from '../src/array-json-stream';
import { parse as parseXML } from 'fast-xml-parser';
import { ServerResponse } from 'http';

import parse from 'csv-parse';
import { PassThrough, Duplex, Readable, Writable, Transform, PipelineOptions } from 'stream';
import { pipeline, finished } from 'stream/promises';
import iconvLite from 'iconv-lite';
import unzip, { Entry } from 'unzip-stream';
import zlib from 'zlib';
import urljoin from 'url-join';

import bench from '../src/bench-stream';

function includes<T extends U, U>(coll: ReadonlyArray<T>, el: U): el is T {
    return coll.includes(el as T);
}
// import type { Errors: { MoleculerRetryableError } } from 'moleculer';

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


class ODCatalogNotFound extends Errors.MoleculerError {
    constructor(data?: unknown) {
        super('Requested catalog is not found in opendata catalog database', 500, "OD_CATALOG_NOT_FOUND", data);
    }
}

const formatDate = (dateString: string) => {
    return new Date(
        Number(dateString.substr(0, 4)),
        Number(dateString.substr(4, 2)), 
        Number(dateString.substr(6, 2))
    );
};

const delay = (time: number) => new Promise(resolve => setTimeout(resolve, time));

// META_URL: "https://roszdravnadzor.gov.ru/opendata/7710537160-medproducts/meta.csv"

type SupportedFileFormats = 'csv' | 'xml';

interface FetchDataOptions {
    sleep?: number;
    cache?: boolean;
    compress?: boolean;
}

interface OpendataCSVList {
    property: string; 
    title: string; 
    value: string; 
    format: 'csv' | 'xml';
}

interface OpendataCatalog {
    name: string;
    base_url: string;
    list: {
        name: string;
        format: SupportedFileFormats;
    };
    classificators: {
        [key: string]: OpendataClassificator;
    }
}

interface OpendataClassificator {
    name: string;
    title: string;
    description: string;
    subject: string;
    format: SupportedFileFormats;
    created: Date | null;
    modified: Date | null;
    valid: Date | null;
    meta: {
        name: string;
        format: SupportedFileFormats;
    },
    structure: null | {
        name: string;
        format: SupportedFileFormats;
        fields: {
            [key: string]: any    
        },
        previous: string[];
    },
    data: null | {
        name: string;
        format: SupportedFileFormats;
        archive: boolean,
        previous: string[];
    }
}

interface OpenDataDatabase {
    [key: string]: OpendataCatalog;
}

interface OpendataListItem {
    name: string;
    url: string;
}

interface OpendataSettings {
    bucketName?: string;
    compressFiles?: boolean | 'gzip' | 'brotli';

    opendataItems: OpendataListItem[];
}

interface RRequestCatalogData {
    catalog: string; 
    classificator: string;
    $req: any;
    $res: ServerResponse;
}

interface RRequestCatalogDataMeta {
    $responseType: string, 
    $responseHeaders: any, 
    $streamObjectMode: boolean
}

@Service({
    name: 'opendata',
    version: 1,

    dependencies: ['s3'],

    settings: {

        compressFiles: true,

        bucketName: 'opendata',

        opendataItems: [
            {   
                name: "roszdravnadzor",
                url: "https://roszdravnadzor.gov.ru/opendata/list.csv"
            }
        ]

    }

})
export default class OpenDataService extends MoleculerService<OpendataSettings> {

    private database: OpenDataDatabase = {};

    @Event({
        name: 'requestCatalog',
        params: {
            catalog: 'string',
            classificator: 'string',
        }
    })
    private async event_requestCatalog(ctx: any) {

        const { catalog, classificator } = ctx.params;

    }

    @Action()
    public async getCatalogList() {}

    @Action({
        rest: {
            method: 'GET',
            path: '/:catalog/:classificator'
        },
        params: {
            catalog: 'string',
            classificator: 'string',
        },
        visibility: 'published'    
    })
    public async getCatalogInfo(ctx: any) {

        let autoload = true;

        const { catalog, classificator } = ctx.params;

        const metadata = await this.broker.call('opendata.getCatalogMetadata', {
            catalog,
            classificator,
        }) as {};

        let status = await this.broker.call('opendata.getCatalogQueryStatus', {
            catalog,
            classificator,
        }) as 'not_loaded' | 'pending' | 'loading' | 'invalidated' | 'ready';

        if(status === 'not_loaded' && autoload) {
            this.broker.emit('requestCatalog', {
                catalog,
                classificator,
            });
            status = 'loading';
        }

        return {
            ...metadata,
            status,
        };

    }

    // private async loadCatalogData(catalog : string, classificator: string) {

    //     const metadata = await this.broker.call('opendata.getCatalogMetadata', { catalog, classificator }) as any;

    //     if(!metadata) {
    //         throw new Error('Classificator is not in database');
    //     }

    //     if(metadata.valid && metadata.valid <= new Date) {
    //         // refetch metadata
    //     }

    //     this.logger.info('Fetching classificator')
    //     const fileStream = await this.fetchOpendataFile(catalog, 'data', metadata.name);

    //     if(!fileStream) {
    //         return null;
    //     }
        
    //     const output = new PassThrough();

    //     this.putFile()

    //     try {
    //         await this.buildPipeline({
    //             input: fileStream,
    //             output: res,
    //             format: metadata.data!.format,
    //             compress: true,
    //         });
    //         console.log('Am i here?')
    //     } catch(error) {
    //         console.log(error);
    //     }

    // }

    // @Action({
    //     params: {
    //         catalog: 'string',
    //         classificator: 'string',
    //         // request catalog even if it is already in database and current date < "valid" date
    //         force: 'boolean',
    //     }
    // })
    // public async requestCatalogLoading(ctx: any) {

    //     const { catalog, classificator, force } = ctx.params;

    //     const status = await this.getCatalogStatus(catalog, classificator);

    //     if (status === 'ready' && force !== true) {
    //         return {
    //             result: 'already_loaded',
    //         };
    //     }

    //     // Create loading task

    //     return {
    //         result: 'task_created'
    //     }

    // }

    // @Action({})
    // public async getCatalogMetadata(ctx: any) {

    //     const { catalog, classificator } = ctx.params;

    //     const metadata = this.database[catalog]?.classificators[classificator];

    //     if(!metadata) {
    //         return null;
    //     }

    //     return {
    //         catalog,
    //         ...metadata,            
    //     }

    // }

    // // @Action({})
    // // public async getCatalogData(ctx: any) {

    // // }

    // @Action({})
    // public async getCatalogQueryStatus(ctx: any) {
    //     return 'loading';
    // }

    // @Action({
    //     name: 'requestCatalogData',
    //     rest: {
    //         method: 'GET',
    //         path: '/:catalog/:classificator',
    //         // @ts-ignore
    //         passReqResToParams: true,
    //     },
    //     visibility: 'published',
    //     timeout: 60000,
    // })
    // public async requestCatalogData(ctx: Context<RRequestCatalogData, RRequestCatalogDataMeta>) {

    //     ctx.meta.$responseType = 'application/octet-stream';
    //     ctx.meta.$responseHeaders = {
    //         'Content-Encoding': 'gzip',
    //     };
    //     ctx.meta.$streamObjectMode = true

    //     await this.getCatalogData(ctx.params.$res, ctx.params.catalog, ctx.params.classificator);

    // }

    // @Method
    // public async getCatalogData(res: ServerResponse, catalogName: string, classificator: string) {

    //     const catalog = this.database[catalogName];

    //     if(!catalog) {
    //         throw new Error('Catalog is not in database');
    //     }

    //     const metadata = catalog.classificators[classificator];

    //     if(!metadata) {
    //         throw new Error('Classificator is not in database');
    //     }

    //     if(metadata.valid && metadata.valid <= new Date) {
    //         // refetch metadata
    //     }

    //     // const structureStream = await this.fetchStructure(catalog, classificator, metaInfo.structure_url, metaInfo.format);

    //     this.logger.info('Fetching classificator')
    //     const fileStream = await this.fetchOpendataFile(catalog, 'data', metadata.name);

    //     if(!fileStream) {
    //         return null;
    //     }
        
    //     const ac = new AbortController();

    //     res.on('close', () => {
    //         res.end();
    //         console.log('response close')
    //     });

    //     // ac.abort();

    //     try {
    //         await this.buildPipeline({
    //             input: fileStream,
    //             output: res,
    //             format: metadata.data!.format,
    //             compress: true,
    //             abort: ac.signal,
    //         });
    //         console.log('Am i here?')
    //     } catch(error) {
    //         console.log(error);
    //     }

    // }


    // private buildPipeline(options: {
    //     input: Readable;
    //     output?: Writable;
    //     format: 'xml' | 'csv';
    //     compress: boolean;
    //     abort?: AbortSignal,
    // }) {

    //     this.logger.info('Building pipeline');
    //     const self = this;

    //     const items = [] as unknown as any[];

    //     items.push(options.input);

    //     if(options.format.toLowerCase() === 'xml') {
    //         const separator = `<classificator>`;
    //         items.push(
    //             new MatcherStream(separator, { skipFirst: true }),
    //             async function*(source: AsyncIterable<string>) {
    //                 for await (const xmlChunk of source) {
    //                     const string = xmlChunk.toString();
    //                     const data = parseXML(string); 
    //                     const { code, name, description } = data.classificator;
    //                     yield {
    //                         code, 
    //                         name, 
    //                         description
    //                     }
    //                 }
    //             },
    //         );
    //     } else if(options.format.toLowerCase() === 'csv') {
    //         items.push(
    //             iconvLite.decodeStream('win1251'),

    //             parse({
    //                 columns: true,
    //                 relax: true,
    //                 delimiter: ';',
    //             }),
    //         );
    //     }

    //     items.push(new ArrayJSONStream());

    //     if(options.compress) {
    //         items.push(zlib.createGzip());
    //     }

    //     if(options.output) {
    //         items.push(options.output);
    //     }

    //     const opts = {} as PipelineOptions;

    //     if(options.abort) {
    //         opts.signal = options.abort;
    //     }

    //     return pipeline(bench(items), opts);
    // }

    // private async getFile(objectName: string): Promise<Readable | null> {

    //     try {

    //         const fileStream = await this.broker.call('s3.getObject', {
    //             bucketName: this.settings.bucketName,
    //             objectName,
    //             timeout: 0,
    //         }) as Readable;

    //         if(path.extname(objectName) === '.br') {
    //             const output = new PassThrough();
    //             pipeline(
    //                 fileStream,
    //                 zlib.createBrotliDecompress(),
    //                 output,
    //             )
    //             finished(output).catch((error) => {
    //                 this.logger.info('Could not decompress files', error);
    //             });

    //             return output;
    //         } else {
    //             return fileStream;
    //         }

    //     } catch(error) {
    //         this.logger.warn(`Object - ${objectName} not found in storage`)
    //     }

    //     return null;

    // }

    // private async putFile(fileStream: Readable, objectName: string, compress?: boolean) {

    //     pipeline(
    //         fileStream,
    //         zlib.createBrotliCompress(),
    //         async (source) => {
    //             try {
    //                 await this.broker.call('s3.putObject', source, {
    //                     meta: {
    //                         bucketName: this.settings.bucketName,
    //                         objectName,
    //                     },
    //                     timeout: 0,
    //                 });
    //                 return true;
    //             } catch(error) {
    //                 this.logger.error(error);
    //             }
    //             return false;
    //         }
    //     );

    // }

    // private getFileName(filename: string, format: string, options?: { compressed: boolean }) {
    //     return `${filename}.${format}${options?.compressed ? '.br' : ''}`;
    // }

    // private getOpendataObjectName(
    //     type: 'list' | 'meta' | 'structure' | 'data',
    //     catalog: string,
    //     classificator?: string,
    //     filename: string,
        
    //     isEncoded?: boolean
    // ) {

    //     const path_parts = [];

    //     path.join(catalog, classificator, this.getFileName(filename, format, { compressed }));

    //     path.join(catalog.name, classificatorInfo.name, `${record.name}.${record.format}${isEncoded ?  '.br' : ''}`)

    //     if(type === 'list') {
    //         return path.join(catalog.name, `${catalog[type].name}${isEncoded ?  '.br' : ''}`)
    //     } else if(classificator !== undefined) {
    //         const classificatorInfo = catalog.classificators[classificator];
    //         if(type === 'data') {
    //             const record = classificatorInfo?.[type];
    //             if(record) {
    //                 return path.join(catalog.name, classificatorInfo.name, `${record.name}.${record.format}${isEncoded ?  '.br' : ''}`);
    //             }
    //         } else {
    //             const record = classificatorInfo?.[type];
    //             if(record) {
    //                 return path.join(catalog.name, classificatorInfo.name, `${record.name}${isEncoded ?  '.br' : ''}`)
    //             }
    //         }
    //     }
    //     return null;
    // }

    // private async fetchOpendataFile(url: string, options?: FetchDataOptions) {

    //     const isEncoded = options?.compress || true;
    //     const useCache = options?.cache || true;

    //     const objectName = this.getOpendataObjectName(catalog, type, classificator, isEncoded);
    //     if(!objectName) {
    //         throw new Error('Could not found catalog type');
    //     }

    //     if(useCache) {
    //         const fileStream = await this.getFile(objectName);
    //         if(fileStream) {
    //             return fileStream;            
    //         }
    //     }

    //     const fileUrl = this.getOpendataFileURL(catalog, type, classificator);
    //     this.logger.info(fileUrl)
    //     if(!fileUrl) {
    //         throw new Error('Could not found catalog type url');
    //     }

    //     try {

    //         if(options?.sleep) {
    //             await delay(options.sleep);
    //         }

    //         this.logger.debug(`Fetching ${objectName} from ${fileUrl}`);
    //         const response = await axios.get(fileUrl, {
    //             responseType: 'stream',
    //         });

    //         if(!response.data) {
    //             return null;
    //         }

    //         const outputStream = new PassThrough();
    //         // this.logger.warn(response.headers);
    //         if(response.headers['content-type'] === 'application/zip') {
    //             pipeline(
    //                 response.data, 
    //                 unzip.Parse(), 
    //                 async function*(source) {
    //                     for await(const entry of source) {
    //                         for await (const chunk of entry) {
    //                             yield chunk;
    //                         }
    //                     }
    //                 },
    //                 outputStream
    //             );
    //         } else {
    //             response.data.pipe(outputStream);
    //         }

    //         if(useCache) {
    //             const fileStream = new PassThrough();
    //             outputStream.pipe(fileStream);
    //             this.logger.debug(`Saving ${objectName} to storage`);
    //             const fileSaved = await this.putFile(fileStream, objectName, isEncoded);
    //             // if(!fileSaved) {
    //             //     this.logger.error(`Could not save ${objectName}`);
    //             // }
    //         }

    //         return outputStream;
    //     } catch(error) {
    //         this.logger.error(error);
    //     }

    //     return null;

    // }

    // private async loadCatalogList(catalog: OpendataCatalog) {

    //     this.logger.debug(`Fetching catalog list`);
    //     const fileStream = await this.fetchOpendataFile(catalog, 'list');

    //     if(!fileStream) {
    //         return null;
    //     }
    //     const self = this;

    //     const oneToOneProperties = ['description', 'subject'] as const;
    //     const dataProperties = ['created', 'modified', 'valid'] as const;

    //     this.logger.warn(`Parsing list file`);
    //     await pipeline(
    //         fileStream,
    //         parse({
    //             columns: true,
    //         }),
    //         async function* (source: AsyncIterable<OpendataCSVList>) {
    //             for await (const { property, title, value, format } of source) {
    //                 if (property === 'standardversion') {
    //                     continue;
    //                 }

    //                 const pathname = new URL(value).pathname;
                    
    //                 const classificatorInfo: OpendataClassificator = {
    //                     name: property,
    //                     title,
    //                     description: '',
    //                     subject: '',
    //                     created: null,
    //                     modified: null,
    //                     valid: null,
    //                     format,
    //                     meta: {
    //                         name: path.basename(pathname),
    //                         format: path.extname(pathname).slice(1) as 'xml' | 'csv',
    //                     },
    //                     structure: null,
    //                     data: null,
    //                 }

    //                 catalog.classificators[classificatorInfo.name] = classificatorInfo;

    //                 self.logger.warn(`Fetching classificator metadata`);
    //                 const fileStream = await self.fetchOpendataFile(catalog, 'meta', classificatorInfo.name, {
    //                     sleep: 500,
    //                 });
    //                 if(!fileStream) {
    //                     self.logger.info(`Could not load metadata for - ${catalog.name}/${classificatorInfo.name}`);
    //                     continue;
    //                 }

    //                 const dataUrls = [];
    //                 const structureUrls = [];

    //                 for await (const { property, value } of fileStream.pipe(parse({ columns: true })) as AsyncIterable<RawClassificatorInfo>) {
    //                     if (property === 'standardversion') {
    //                         continue;
    //                     }
    //                     if(property === 'format') {
    //                         classificatorInfo.format = value as SupportedFileFormats;
    //                     } else if(includes(oneToOneProperties, property)) {
    //                         classificatorInfo[property] = value;
    //                     } else if(includes(dataProperties, property)) {
    //                         classificatorInfo[property] = formatDate(value);
    //                     } else if(property.startsWith('structure')) {
    //                         structureUrls.push({
    //                             name: property,
    //                             url: value,
    //                         });
    //                     } else if(property.startsWith('data')) {
    //                         dataUrls.push({
    //                             name: property,
    //                             url: value,
    //                         });
    //                     }
    //                 }

    //                 structureUrls.sort((a,b) => {
    //                     const dateA = formatDate(a.name.replace('structure-', ''));
    //                     const dateB = formatDate(b.name.replace('structure-', ''))
    //                     return dateB.getTime() - dateA.getTime();
    //                 }).forEach(({ name, url }, index) => {                        
    //                     if(index === 0) {
    //                         const pathname = new URL(url).pathname;
    //                         classificatorInfo.structure = {
    //                             name: path.basename(pathname),
    //                             format: path.extname(pathname).slice(1) as 'xml' | 'csv',
    //                             fields: {},
    //                             previous: [],
    //                         }
    //                     } else {
    //                         classificatorInfo.structure?.previous.push(name);
    //                     }
    //                 });

    //                 dataUrls.sort((a,b) => {
    //                     const dateA = formatDate(a.name.replace('data-', '').slice(0, 8));
    //                     const dateB = formatDate(b.name.replace('data-', '').slice(0, 8));
    //                     return dateB.getTime() - dateA.getTime();
    //                 }).forEach(({ name, url }, index) => {                        
    //                     if(index === 0) {
    //                         const pathname = new URL(url).pathname;
    //                         classificatorInfo.data = {
    //                             name: name,
    //                             archive: path.extname(pathname).slice(1) as 'xml' | 'csv' | 'zip' === 'zip',
    //                             format: classificatorInfo.format,
    //                             previous: [],
    //                         }
    //                     } else {
    //                         classificatorInfo.data?.previous.push(name);
    //                     }
    //                 })

    //             }
    //         }
    //     );

    // }

    // private initOpendataDatabase() {

    //     if(this.settings.opendataItems.length === 0) {
    //         this.logger.warn('No opendata items in settings!');
    //         return false;
    //     }

    //     for(const item of this.settings.opendataItems) {
            
    //         const url = new URL(item.url);
    //         const pathname = url.pathname;

    //         this.database[item.name] = {
    //             name: item.name,
    //             base_url: path.join(url.origin, path.dirname(pathname)),
    //             list: {
    //                 name: path.basename(pathname),
    //                 format: path.extname(pathname).slice(1) as 'xml' | 'csv',
    //             },
    //             classificators: {}
    //         }

    //     }

    // }

    // private async loadOpendataItems() {

    //     const initialized = this.initOpendataDatabase();

    //     if(initialized === false) {
    //         this.logger.error('Could not init opendata database');
    //         return;
    //     }

    //     const items = Object.values(this.database).map((catalog) => {
    //         return this.loadCatalogList(catalog);
    //     });
        
    //     await Promise.all(items);

    // }

    // private async started() {

    //     const bucketExist = await this.broker.call('s3.bucketExists', {
	// 		bucketName: this.settings.bucketName,
	// 	});

	// 	if(!bucketExist) {
	// 		await this.broker.call('s3.makeBucket', {
	// 			bucketName: this.settings.bucketName,
	// 			region: 'us-east-1',
	// 		});
	// 	}

    //     this.loadOpendataItems().then(() => {
    //         // console.dir(this.database, {
    //         //     compact: false,
    //         //     depth: 10,
    //         // })
    //     }).catch((error) => this.logger.info(error));


    // }


    // // 

    
    // private async *parseOpendataCSVList(source: AsyncIterable<OpendataCSVList>) {

    //     const oneToOneProperties = ['description', 'subject'] as const;
    //     const dataProperties = ['created', 'modified', 'valid'] as const;

    //     for await (const { property, title, value, format } of source) {
    //         if (property === 'standardversion') {
    //             continue;
    //         }

    //         const pathname = new URL(value).pathname;
            
    //         const classificatorInfo: OpendataClassificator = {
    //             name: property,
    //             title,
    //             description: '',
    //             subject: '',
    //             created: null,
    //             modified: null,
    //             valid: null,
    //             format,
    //             meta: {
    //                 name: path.basename(pathname),
    //                 format: path.extname(pathname).slice(1) as 'xml' | 'csv',
    //             },
    //             structure: null,
    //             data: null,
    //         }

    //         catalog.classificators[classificatorInfo.name] = classificatorInfo;

    //         this.logger.warn(`Fetching classificator metadata`);
    //         const fileStream = await this.fetchOpendataFile(catalog, 'meta', classificatorInfo.name, {
    //             sleep: 500,
    //         });
    //         if(!fileStream) {
    //             this.logger.info(`Could not load metadata for - ${catalog.name}/${classificatorInfo.name}`);
    //             continue;
    //         }

    //         const dataUrls = [];
    //         const structureUrls = [];

    //         for await (const { property, value } of fileStream.pipe(parse({ columns: true })) as AsyncIterable<RawClassificatorInfo>) {
    //             if (property === 'standardversion') {
    //                 continue;
    //             }
    //             if(property === 'format') {
    //                 classificatorInfo.format = value as SupportedFileFormats;
    //             } else if(includes(oneToOneProperties, property)) {
    //                 classificatorInfo[property] = value;
    //             } else if(includes(dataProperties, property)) {
    //                 classificatorInfo[property] = formatDate(value);
    //             } else if(property.startsWith('structure')) {
    //                 structureUrls.push({
    //                     name: property,
    //                     url: value,
    //                 });
    //             } else if(property.startsWith('data')) {
    //                 dataUrls.push({
    //                     name: property,
    //                     url: value,
    //                 });
    //             }
    //         }

    //         structureUrls.sort((a,b) => {
    //             const dateA = formatDate(a.name.replace('structure-', ''));
    //             const dateB = formatDate(b.name.replace('structure-', ''))
    //             return dateB.getTime() - dateA.getTime();
    //         }).forEach(({ name, url }, index) => {                        
    //             if(index === 0) {
    //                 const pathname = new URL(url).pathname;
    //                 classificatorInfo.structure = {
    //                     name: path.basename(pathname),
    //                     format: path.extname(pathname).slice(1) as 'xml' | 'csv',
    //                     fields: {},
    //                     previous: [],
    //                 }
    //             } else {
    //                 classificatorInfo.structure?.previous.push(name);
    //             }
    //         });

    //         dataUrls.sort((a,b) => {
    //             const dateA = formatDate(a.name.replace('data-', '').slice(0, 8));
    //             const dateB = formatDate(b.name.replace('data-', '').slice(0, 8));
    //             return dateB.getTime() - dateA.getTime();
    //         }).forEach(({ name, url }, index) => {                        
    //             if(index === 0) {
    //                 const pathname = new URL(url).pathname;
    //                 classificatorInfo.data = {
    //                     name: name,
    //                     archive: path.extname(pathname).slice(1) as 'xml' | 'csv' | 'zip' === 'zip',
    //                     format: classificatorInfo.format,
    //                     previous: [],
    //                 }
    //             } else {
    //                 classificatorInfo.data?.previous.push(name);
    //             }
    //         })

    //     }

    // }


};