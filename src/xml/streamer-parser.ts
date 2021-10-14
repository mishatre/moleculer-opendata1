
import { Type } from './state-machine';

type StackElement = { [key: string]: any } | string;

export interface ParserOptions {
    streamingTag?: string;
    ignoreAttrs?: boolean;
}

export default class XMLStreamerParser {

    private streaming = true;
    private started = false;
    private stack: StackElement[] = [];

    constructor(private options: ParserOptions) {

        if(!options.streamingTag) {
            this.streaming = false;
        }
    }

    castValue(value: string) {

        const trimmed = value.trim();

        if (trimmed === 'true') {
            return true;
        } else if (trimmed === 'false') {
            return false;
        }

        return value;

    }

    parseTagName(name: string) {
        return name.indexOf(":") !== -1 ? name.split(':') : ['', name];
    }

    produce(type: string, value: string) {

        // return type as any

        const [prefix, localname] = this.parseTagName(value);

        if(this.streaming) {
            // if (type === Type.openTag && this.stack.length === 0) {
            //     console.log(localname, this.stack.length)
            // }
            if (localname === this.options.streamingTag) {
                if (type === Type.openTag) {
                    this.started = true;
                } else if (type === Type.closeTag) {
                    this.started = false;
                }
                return;
            }

            if (!this.started) {
                return;
            }
        }

        switch (type) {
            case Type.openTag: {
                this.stack.push({
                    $name: localname,
                });
                break;
            }
            case Type.closeTag: {

                let tagName = null;

                let current = this.stack.pop();
                const parent = this.stack.at(-1);

                if(typeof current === 'object') {
                    const { $name, ...rest } = current;
                    tagName = $name;

                    // if(Object.keys(rest).length > 0) {
                        if (Object.keys(rest).length === 1 && 'value' in rest) {
                            current = rest.value;
                        } else {
                            current = rest;
                        }
                    // }
                }

                if(!tagName) {
                    tagName = 'value';
                }

                if (parent && typeof parent === 'object') {

                    // if(typeof current === 'object' && !Array.isArray(current) && Object.keys(current).length === 0) {
                    //     return;
                    // }

                    if (!(tagName in parent)) {
                        parent[tagName] = current;
                    } else {
                        if (!Array.isArray(parent[tagName])) {
                            parent[tagName] = [parent[tagName]];
                        }
                        parent[tagName].push(current);
                    }

                } else {
                    return {
                        [tagName]: current
                    }
                }

                break;
            }
            case Type.attributeName: {
                if(this.options.ignoreAttrs === true) {
                    break;
                }
                const [prefix, localname] = this.parseTagName(value);
                const current = this.stack.at(-1);
                if (current && typeof current === 'object') {
                    current[localname] = '';
                    this.stack.push(localname);
                }
                break;
            }
            case Type.attributeValue: {
                if(this.options.ignoreAttrs === true) {
                    break;
                }

                const attrName = this.stack.pop();

                if(attrName !== undefined && typeof attrName === 'string') {
                    const current = this.stack.at(-1);
                    if(!current || typeof current !== 'object') {
                        throw new Error('There is something terrebly wrong');
                    } else {
                        current[attrName] = value;
                    }
                }

                break;
            }
            case Type.text: {
                const current = this.stack.at(-1);
                if (current && typeof current === 'object') {
                    current.value = this.castValue(value);
                }
                break;
            }
        }
    }

}