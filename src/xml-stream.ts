
import { Transform, TransformCallback } from 'stream';
import MatcherStream from './matcher-stream';
import { parse } from 'fast-xml-parser';

enum XMLStreamStates {
    STREAM_START,
    START,
    XML_DATA,
    XML_DATA_END,

}


export default null;
// class XMLStream extends Transform {

//     private data: Buffer = Buffer.from([]);
//     private state: XMLStreamStates = XMLStreamStates.STREAM_START;
//     private outputStream: MatcherStream | null = null;

//     constructor(public tagSeparator: string) {
//         super({
//             objectMode: true,
//         });

//     }

//     private processDataChunk(chunk: Buffer) {

//         let requiredLength = 0;

//         switch(this.state) {
//             case XMLStreamStates.STREAM_START:
//             case XMLStreamStates.START: {
//                 requiredLength = Buffer.from(`<${this.tagSeparator}>`).length;
//                 break;
//             }
//             case XMLStreamStates.XML_DATA: {
//                 return 0;
//             }
//             case XMLStreamStates.XML_DATA_END: {
//                 return 0;
//             }
//         };

//         const chunkLength = chunk.length;
//         if (chunkLength < requiredLength) {
//             return 0;
//         }

//         switch(this.state) {
//             case XMLStreamStates.STREAM_START:
//             case XMLStreamStates.START: {

//                 this.state = XMLStreamStates.XML_DATA;
//                 const separator = `<${this.tagSeparator}>`;
//                 this.outputStream = new MatcherStream(separator, (matchedChunk: any, sizeSoFar: any) => {

//                     return false;

//                     // console.log(1, matchedChunk.toString());
//                     // console.log(2, matchedChunk.toString().startsWith(separator))
//                     if(!matchedChunk.toString().startsWith(separator)) {
//                         this.data = this.data.slice(sizeSoFar);
                        
//                     }



//                     this.state = XMLStreamStates.XML_DATA_END;
//                     if(this.data.length > 0) {
//                         this.data = Buffer.concat([this.data, matchedChunk]);
//                     } else {
//                         this.data = matchedChunk;
//                     }
//                     this.push(this.data.toString());

//                     return true;

//                 });
//                 this.outputStream.on('data', (chunk) => {
//                     console.log(`-----------------------------------------------`);
//                     console.log(chunk.toString());
//                     console.log(`-----------------------------------------------`);
//                 })

//             }
//         }

//         return 0;
//     }

//     private parseOrEmit(encoding: BufferEncoding, cb: TransformCallback) {
//         let consume = 0;
//         while((consume = this.processDataChunk(this.data)) > 0) {
//             this.data = this.data.slice(consume);
//             if(this.data.length === 0) {
//                 break;
//             }
//         }

//         if(this.state === XMLStreamStates.XML_DATA) {
//             const packet = this.data;
//             this.data = Buffer.from([]);

//             this.outputStream?.write(packet, encoding, () => {
//                 if(this.state === XMLStreamStates.XML_DATA_END) {
//                     this.outputStream?.end(cb);
//                     this.state = XMLStreamStates.START;
//                     return;
//                 }
//                 cb();
//             });
//             return;
//         }

//         cb();

//     }

//     _transform(chunk: Buffer, encoding: BufferEncoding, callback: TransformCallback) {

//         if(this.data.length > 0) {
//             this.data = Buffer.concat([this.data, chunk]);
//         } else {
//             this.data = chunk;
//         }

//         let startDataLength = this.data.length;
//         const done = () => {
//             if(this.data.length > 0 && this.data.length < startDataLength) {
//                 startDataLength = this.data.length;
//                 this.parseOrEmit(encoding, done);
//                 return;
//             }
//             callback();
//         }

//         this.parseOrEmit(encoding, done);

//     }

// }