
import { Type } from './state-machine';

type StackElement = { [key: string]: any } | string;

export default class XMLStreamerParser {

    private started = false;
    private stack: StackElement[] = [];

    constructor(private streamingTag: string) { }

    castValue(value: string) {

        const trimmed = value.trim();

        if (trimmed === 'true') {
            return true;
        } else if (trimmed === 'false') {
            return false;
        }

        return value;

    }

    produce(type: string, value: string) {

        const [prefix, localname] = value.indexOf(":") !== -1 ? value.split(':') : ['', value];
        if (localname === this.streamingTag) {
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

        switch (type) {
            case Type.openTag: {

                if (this.stack.length === 0) {
                    this.stack.push({});
                } else {
                    const obj = {
                        $name: localname,
                    };

                    this.stack.push(obj);
                }

                break;
            }
            case Type.closeTag: {

                const current = this.stack.pop();
                const parent = this.stack.at(-1);

                if (parent && typeof parent === 'object') {

                    if (typeof current === 'object') {

                        const { $name, ...rest } = current;

                        let value = null;
                        if (Object.keys(rest).length === 1 && 'value' in rest) {
                            value = rest.value;
                        } else {
                            value = rest;
                        }

                        if (!($name in parent)) {
                            parent[$name] = value;
                        } else {
                            if (Array.isArray(parent[$name])) {
                                parent[$name].push(value)
                            } else {
                                parent[$name] = [parent[$name], value];
                            }
                        }

                    } else {
                        if (parent.value) {
                            if (!Array.isArray(parent.value)) {
                                parent.value = [parent.value, current];
                            } else {
                                parent.value.push(current);
                            }
                        } else {
                            parent.value = current;
                        }
                    }

                    if (this.stack.length === 1) {
                        return this.stack.pop();
                    }
                }

                break;
            }
            case Type.attributeName: {
                const current = this.stack.at(-1);
                if (current && typeof current === 'object') {
                    current[value] = '';
                    this.stack.push(value);
                }
                break;
            }
            case Type.attributeValue: {
                const current = this.stack.at(-2);
                if (current && typeof current === 'object') {
                    const attrName = this.stack.pop();
                    if (typeof attrName === 'string') {
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