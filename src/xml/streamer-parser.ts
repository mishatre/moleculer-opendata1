
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

        if (!options.streamingTag) {
            this.streaming = false;
        }
    }

    produce(type: string, value: string) {

        return this.parseToken(type, value);

    }

    private parseToken(type: string, value: string) {
        return this.parser[type](value) as undefined | object;
    }

    private assignValue(object: { [key: string]: any }, key: string, value: any) {

        if (typeof value === 'string') {
            value = this.castValue(value);
        }

        if (!(key in object)) {
            object[key] = value;
        } else {
            if (!Array.isArray(object[key])) {
                object[key] = [object[key]];
            }
            object[key].push(value);
        }
    }

    private castValue(value: string) {

        const trimmed = value.trim();

        if (trimmed === 'true') {
            return true;
        } else if (trimmed === 'false') {
            return false;
        }

        return value;

    }

    private parseTagName(value: string) {
        const [_, localName] = value.indexOf(':') !== -1 ? value.split(':') : ['', value];
        return localName;
    }

    private parser = {
        [Type.openTag]: (value: string) => {
            this.stack.push({
                $name: this.parseTagName(value),
            });
        },
        [Type.closeTag]: (value: string) => {

            let tagName = null;

            let current = this.stack.pop();

            // if (this.parseTagName(value) === this.options.streamingTag) {
            //     console.log(value, this.stack.length, current);
            // }

            if (this.stack.length === 0 && !this.streaming) {
                return current;
            }

            const parent = this.stack.at(-1);

            if (typeof current === 'object') {
                tagName = current.$name;
                delete current.$name;

                if (Object.keys(current).length === 1 && 'value' in current) {
                    current = current.value;
                } else {
                    current = current;
                }
                if (!Array.isArray(current) && typeof current === 'object' && Object.keys(current).length === 0) {
                    current = undefined;
                }

            }

            if (!tagName) {
                tagName = 'value';
            }

            if (parent && typeof parent === 'object') {
                if (current !== undefined) {
                    this.assignValue(parent, tagName, current);
                }
            }

            if (this.streaming && tagName === this.options.streamingTag) {
                // console.log(value, this.stack.length, parent);
                return current;
            }

        },
        [Type.attributeName]: (value: string) => {
            if (this.options.ignoreAttrs === true) {
                return;
            }
            this.stack.push(this.parseTagName(value));
        },
        [Type.attributeValue]: (value: string) => {
            if (this.options.ignoreAttrs === true) {
                return;
            }

            const attrName = this.stack.pop();
            const current = this.stack.at(-1);

            if (typeof attrName === 'string' && current !== undefined && typeof current === 'object') {
                this.assignValue(current, attrName, value);
            }
        },
        [Type.text]: (value: string) => {
            const current = this.stack.at(-1);
            if (current && typeof current === 'object') {
                this.assignValue(current, 'value', value);
            }
        }

    }



}