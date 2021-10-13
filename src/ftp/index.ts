
import Client from 'ftp';
import { promisify } from 'util';

Client.prototype.get = promisify(Client.prototype.get);
Client.prototype.list = promisify(Client.prototype.list);

export default class FTPClient extends Client {

    list(path: string, useCompression: boolean): Promise<Client.ListingElement[]>;
    list(path: string): Promise<Client.ListingElement[]>;
    list(useCompression: boolean): Promise<Client.ListingElement[]>;
    list(): Promise<Client.ListingElement[]>;
    list(pathOrUseCompression?: string | boolean, useCompression?: boolean) {
        return new Promise((resolve, reject) => {

            const params = [];
            if (pathOrUseCompression) {
                params.push(pathOrUseCompression);
            } else if (useCompression) {
                params.push(useCompression);
            }

            const callback = (error: Error | null, listing: Client.ListingElement[]) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(listing)
                }
            }

            if (params.length === 2) {
                super.list(params[0] as string, params[1] as boolean, callback);
            } else if (params.length === 1) {
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
            if (pathOrUseCompression) {
                params.push(pathOrUseCompression);
            } else if (useCompression) {
                params.push(useCompression);
            }

            const callback = (error: Error, stream: NodeJS.ReadableStream) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(stream)
                }
            }

            if (params.length === 2) {
                super.get(params[0] as string, params[1] as boolean, callback);
            } else if (params.length === 1) {
                super.get(params[0] as string, callback);
            }

        })
    }

}