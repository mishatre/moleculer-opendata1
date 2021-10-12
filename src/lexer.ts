
import { Transform, TransformCallback } from 'stream';

export default class LexerStream extends Transform {

    private stateMachine = new XMLStateMachine();

    private streamingTag = 'nsiKTRUs';
    private streaming = false;
    private level = 0;

    private stack: any[] = [];
    private attributesStack: any[] = [];

    constructor(options?: any) {
        super();
    }

    async step(char: string) {

        for (const { type, value } of this.stateMachine.next(char)) {

            const [prefix, localname] = value.indexOf(":") !== -1 ? value.split(':') : ['', value];
            if(localname === this.streamingTag) {
                if(type === Type.openTag) {
                    this.streaming = true;
                    
                } else if(type === Type.closeTag) {
                    this.streaming = false;
                }
            } else if(this.streaming) {

                let current = null;

                switch(type) {
                    case Type.openTag: {
                        const current = {
                            name: localname,
                            value: [],
                        };
                        this.stack.push(current);
                        break;
                    }
                    case Type.closeTag: {

                        current = this.stack.pop();

                        if(current.value.length === 1) {
                            current.value = current.value[0];
                        }
                        
                        const parent = this.stack[this.stack.length -1];

                        if(parent) {
                            parent.value.push(current);
                        }

                        break;
                    }
                    case Type.attributeName: {
                        const current = this.stack[this.stack.length -1];
                        this.attributesStack.push(value);
                        current[value] = '';
                        break;
                    }
                    case Type.attributeValue: {
                        const current = this.stack[this.stack.length -1]
                        const attributeName = this.attributesStack.pop();
                        current[attributeName!] = value;
                        break;
                    }
                    case Type.text: {
                        const current = this.stack[this.stack.length -1]
                        if(current) {
                            current.value.push(value);
                        }
                        break;
                    }
                }

                if(this.stack.length === 0) {
                    console.dir(current, { depth: 10 })
                }

            }
            
        }

        // console.log(this.stack.length);

    }

    _transform(chunk: string | Buffer, encoding: BufferEncoding, callback: TransformCallback) {
        
        if(Buffer.isBuffer(chunk)) {
            chunk = chunk.toString();
        }

        for(const char of chunk.slice(0,5000)) {
            this.step(char);
        }

        // callback();

    }

    _flush(callback: TransformCallback) {
        callback();
    }

}

const States = {
    DATA: 'state-data',
    CDATA: 'state-cdata',
    TAG_BEGIN: 'state-tag-begin',
    TAG_NAME: 'state-tag-name',
    TAG_END: 'state-tag-end',
    ATTRIBUTE_NAME_START: 'state-attribute-name-start',
    ATTRIBUTE_NAME: 'state-attribute-name',
    ATTRIBUTE_NAME_END: 'state-attribute-name-end',
    ATTRIBUTE_VALUE_BEGIN: 'state-attribute-value-begin',
    ATTRIBUTE_VALUE: 'state-attribute-value',
}

const Actions = {
    LT: 'action-lt',
    GT: 'action-gt',
    SPACE: 'action-space',
    EQUAL: 'action-equal',
    QUOTE: 'action-quote',
    SLASH: 'action-slash',
    CHAR: 'action-char',
    ERROR: 'action-error',
}

const noop = function* (){};

const Type = {
    text: 'text',
    openTag: 'open-tag',
    closeTag: 'close-tag',
    attributeName: 'attribute-name',
    attributeValue: 'attribute-value',
};

const charToAction = {
    ' ':  Actions.SPACE,
    '\t': Actions.SPACE,
    '\n': Actions.SPACE,
    '\r': Actions.SPACE,
    '<':  Actions.LT,
    '>':  Actions.GT,
    '"':  Actions.QUOTE,
    "'":  Actions.QUOTE,
    '=':  Actions.EQUAL,
    '/':  Actions.SLASH,
};

const getAction = (char: keyof typeof charToAction | string) => charToAction[char as keyof typeof charToAction] || Actions.CHAR;

class XMLStateMachine {

    private state = States.DATA;
    private data = '';
    private tagName = '';
    private attrName = '';
    private attrValue = '';
    private isClosing = false;
    private openingQuote = '';

    constructor() {}

    emit(type: string, value: any) {
        // for now, ignore tags like: '?xml', '!DOCTYPE' or comments
        if (this.tagName[0] === '?' || this.tagName[0] === '!') {
            return;
        }
        return {
            type, 
            value
        };
    };

    *next(char: string) {

        const charAction = getAction(char);

        const actions = this.stateMachine[this.state];

        let action = null;

        if(charAction in actions) {
            action = actions[charAction];
        } else if (Actions.ERROR in actions) {
            action = actions[Actions.ERROR]
        } else if(Actions.CHAR in actions) {
            action = actions[Actions.CHAR]
        }

        if(action) {

            action = action.bind(this);

            for (const response of action(char) as unknown as Generator<{ type: string; value: any;}>) {
                yield response;
            }
            
        }
        
    }

    // State machine

    private stateMachine = {
        [States.DATA]: {
            [Actions.LT]: function* (this: XMLStateMachine) {
                if (this.data.trim()) {
                    yield this.emit(Type.text, this.data);
                }
                this.tagName = '';
                this.isClosing = false;
                this.state = States.TAG_BEGIN;
            },
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.data += char;
            }
        },
        [States.CDATA]: {
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.data += char;
            }
        },
        [States.TAG_BEGIN]: {
            [Actions.SPACE]: noop,
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.tagName = char;
                this.state = States.TAG_NAME;
            },
            [Actions.SLASH]: function* (this: XMLStateMachine) {
                this.tagName = '';
                this.isClosing = true;
            }
        },
        [States.TAG_NAME]: {
            [Actions.SPACE]: function*(this: XMLStateMachine) {
                if (this.isClosing) {
                    this.state = States.TAG_END;
                } else {
                    this.state = States.ATTRIBUTE_NAME_START;
                    yield this.emit(Type.openTag, this.tagName);
                }
            },
            [Actions.GT]: function*(this: XMLStateMachine) {
                if (this.isClosing) {
                    yield this.emit(Type.closeTag, this.tagName);
                } else {
                    yield this.emit(Type.openTag, this.tagName);
                }
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SLASH]: function*(this: XMLStateMachine) {
                this.state = States.TAG_END;
                yield this.emit(Type.openTag, this.tagName);
            },
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.tagName += char;
                if (this.tagName === '![CDATA[') {
                    this.state = States.CDATA;
                    this.data = '';
                    this.tagName = '';
                }
            },
        },
        [States.TAG_END]: {
            [Actions.GT]: function*(this: XMLStateMachine) {
                yield this.emit(Type.closeTag, this.tagName);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: noop,
        },
        [States.ATTRIBUTE_NAME_START]: {
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.attrName = char;
                this.state = States.ATTRIBUTE_NAME;
            },
            [Actions.GT]: function* (this: XMLStateMachine) {
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SPACE]: noop,
            [Actions.SLASH]: function* (this: XMLStateMachine) {
                this.isClosing = true;
                this.state = States.TAG_END;
            },
        },
        [States.ATTRIBUTE_NAME]: {
            [Actions.SPACE]: function* (this: XMLStateMachine) {
                this.state = States.ATTRIBUTE_NAME_END;
            },
            [Actions.EQUAL]: function*(this: XMLStateMachine) {
                yield this.emit(Type.attributeName, this.attrName);
                this.state = States.ATTRIBUTE_VALUE_BEGIN;
            },
            [Actions.GT]: function*(this: XMLStateMachine) {
                this.attrValue = '';
                yield this.emit(Type.attributeName, this.attrName);
                yield this.emit(Type.attributeValue, this.attrValue);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SLASH]: function*(this: XMLStateMachine) {
                this.isClosing = true;
                this.attrValue = '';
                yield this.emit(Type.attributeName, this.attrName);
                yield this.emit(Type.attributeValue, this.attrValue);
                this.state = States.TAG_END;
            },
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.attrName += char;
            },
        },
        [States.ATTRIBUTE_NAME_END]: {
            [Actions.SPACE]: noop,
            [Actions.EQUAL]: function*(this: XMLStateMachine) {
                yield this.emit(Type.attributeName, this.attrName);
                this.state = States.ATTRIBUTE_VALUE_BEGIN;
            },
            [Actions.GT]: function*(this: XMLStateMachine) {
                this.attrValue = '';
                yield this.emit(Type.attributeName, this.attrName);
                yield this.emit(Type.attributeValue, this.attrValue);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: function*(this: XMLStateMachine, char: string) {
                this.attrValue = '';
                yield this.emit(Type.attributeName, this.attrName);
                yield this.emit(Type.attributeValue, this.attrValue);
                this.attrName = char;
                this.state = States.ATTRIBUTE_NAME;
            },
        },
        [States.ATTRIBUTE_VALUE_BEGIN]: {
            [Actions.SPACE]: noop,
            [Actions.QUOTE]: function* (this: XMLStateMachine, char: string) {
                this.openingQuote = char;
                this.attrValue = '';
                this.state = States.ATTRIBUTE_VALUE;
            },
            [Actions.GT]: function*(this: XMLStateMachine)  {
                this.attrValue = '';
                yield this.emit(Type.attributeValue, this.attrValue);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.openingQuote = '';
                this.attrValue = char;
                this.state = States.ATTRIBUTE_VALUE;
            },
        },
        [States.ATTRIBUTE_VALUE]: {
            [Actions.SPACE]: function*(this: XMLStateMachine, char: string)  {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    yield this.emit(Type.attributeValue, this.attrValue);
                    this.state = States.ATTRIBUTE_NAME_START;
                }
            },
            [Actions.QUOTE]: function*(this: XMLStateMachine, char: string)  {
                if (this.openingQuote === char) {
                    yield this.emit(Type.attributeValue, this.attrValue);
                    this.state = States.ATTRIBUTE_NAME_START;
                } else {
                    this.attrValue += char;
                }
            },
            [Actions.GT]: function*(this: XMLStateMachine, char: string)  {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    yield this.emit(Type.attributeValue, this.attrValue);
                    this.data = '';
                    this.state = States.DATA;
                }
            },
            [Actions.SLASH]: function*(this: XMLStateMachine, char: string)  {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    yield this.emit(Type.attributeValue, this.attrValue);
                    this.isClosing = true;
                    this.state = States.TAG_END;
                }
            },
            [Actions.CHAR]: function* (this: XMLStateMachine, char: string) {
                this.attrValue += char;
            },
        },
    }

}
