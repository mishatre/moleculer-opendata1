
import { Transform, TransformCallback } from 'stream';

interface RawKTRU {
    data: {
        code: string;
        version: string;
        name: string;
        OKPD2: string;
        actual: boolean;
        applicationDateStart: string;
        applicationDateEnd: string;
        OKEIs: string;
        characteristics: string;
        NSI: string;
        attachments: string;
        cancelInfo: string;
        nsiDescription: string;
        isTemplate: string;
        parentPositionInfo: string;
        noNewFeatures: boolean;
        noNewFeaturesReason: boolean;
    }
}

export default class KTRUParser extends Transform {
    constructor() {
        super({
            objectMode: true,
        })
    }

    parseDate(dateString: string) {
        return new Date(dateString);
    }

    getCharacteristicType(type: '1' | '2') {
        switch(type) {
            case '1': return 'qualitative';
            case '2': return 'quantitative';
        }
    }

    getCharacteristicKind(kind: '1' | '2' | '3') {
        switch(kind) {
            case '1': return 'unchangeable';
            case '2': return 'changeableOne';
            case '3': return 'changeableMany';
        }
    }
    
    parseCharacteristics(value: any) {

        const newChr = {} as { [key: string]: any };

        for(const characteristic of value.characteristic) {

            newChr.code = characteristic.code;
            newChr.name = characteristic.name;

            newChr.type = this.getCharacteristicType(characteristic.type);
            newChr.kind = this.getCharacteristicKind(characteristic.kind);

        }

        console.log(value);

    }

    _transform(chunk: RawKTRU, encoding: BufferEncoding, callback: TransformCallback) {

        if(typeof chunk === 'string' || Buffer.isBuffer(chunk)) {
            throw new Error('Incorrect input data');
        }


        const ktru = {} as { [key: string]: any };
                            
        for(const [name, value] of Object.entries(chunk.data)) {

            switch(name) {
                case 'code': ktru[name] = value; break;
                case 'version': ktru[name] = Number(value); break;
                case 'name': ktru[name] = value; break;
                case 'OKPD2': ktru[name] = value;
                case 'actual': ktru[name] = value; break;
                case 'applicationDateStart': ktru[name] = this.parseDate(value as string); break;
                case 'applicationDateEnd': ktru[name] = this.parseDate(value as string); break;
                case 'OKEIs': ktru[name] = value;
                case 'characteristics': ktru[name] = this.parseCharacteristics(value);
                case 'NSI': ktru[name] = value;
                case 'attachments': ktru[name] = value;
                case 'cancelInfo': ktru[name] = value;
                case 'nsiDescription': ktru[name] = value;
                case 'isTemplate': ktru[name] = value;
                case 'parentPositionInfo': ktru[name] = value;
                case 'noNewFeatures': ktru[name] = value; break;
                case 'noNewFeaturesReason': ktru[name] = value; break;
            }

        }

        this.push(ktru);

        callback();

        // console.dir(ktru.characteristics.characteristic[0].values)

    }
}