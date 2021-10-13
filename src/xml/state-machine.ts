

export const Type = {
    text: 'text',
    openTag: 'open-tag',
    closeTag: 'close-tag',
    attributeName: 'attribute-name',
    attributeValue: 'attribute-value',
};

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

const charToAction = {
    ' ': Actions.SPACE,
    '\t': Actions.SPACE,
    '\n': Actions.SPACE,
    '\r': Actions.SPACE,
    '<': Actions.LT,
    '>': Actions.GT,
    '"': Actions.QUOTE,
    "'": Actions.QUOTE,
    '=': Actions.EQUAL,
    '/': Actions.SLASH,
};

const getAction = (char: keyof typeof charToAction | string) => charToAction[char as keyof typeof charToAction] || Actions.CHAR;
const noop = () => { };

export default class XMLStateMachine {

    private state = States.DATA;
    private data = '';
    private tagName = '';
    private attrName = '';
    private attrValue = '';
    private isClosing = false;
    private openingQuote = '';

    private queue: [string, string][] = [];

    constructor() { }


    next(char: string) {

        this.queue = [];

        const actions = this.stateMachine[this.state];
        // Call action
        (actions[getAction(char)] || actions[Actions.ERROR] || actions[Actions.CHAR])?.(char);

        if (this.tagName[0] === '?' || this.tagName[0] === '!') {
            return [];
        }

        return this.queue;

    }

    // State machine

    private stateMachine = {
        [States.DATA]: {
            [Actions.LT]: () => {
                if (this.data.trim()) {
                    this.queue.push([Type.text, this.data]);
                }
                this.tagName = '';
                this.isClosing = false;
                this.state = States.TAG_BEGIN;
            },
            [Actions.CHAR]: (char: string) => {
                this.data += char;
            }
        },
        [States.CDATA]: {
            [Actions.CHAR]: (char: string) => {
                this.data += char;
            }
        },
        [States.TAG_BEGIN]: {
            [Actions.SPACE]: noop,
            [Actions.CHAR]: (char: string) => {
                this.tagName = char;
                this.state = States.TAG_NAME;
            },
            [Actions.SLASH]: () => {
                this.tagName = '';
                this.isClosing = true;
            }
        },
        [States.TAG_NAME]: {
            [Actions.SPACE]: () => {
                if (this.isClosing) {
                    this.state = States.TAG_END;
                } else {
                    this.state = States.ATTRIBUTE_NAME_START;
                    this.queue.push([Type.openTag, this.tagName]);
                }
            },
            [Actions.GT]: () => {
                if (this.isClosing) {
                    this.queue.push([Type.closeTag, this.tagName]);
                } else {
                    this.queue.push([Type.openTag, this.tagName]);
                }
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SLASH]: () => {
                this.state = States.TAG_END;
                this.queue.push([Type.openTag, this.tagName]);
            },
            [Actions.CHAR]: (char: string) => {
                this.tagName += char;
                if (this.tagName === '![CDATA[') {
                    this.state = States.CDATA;
                    this.data = '';
                    this.tagName = '';
                }
            },
        },
        [States.TAG_END]: {
            [Actions.GT]: () => {
                this.queue.push([Type.closeTag, this.tagName]);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: noop,
        },
        [States.ATTRIBUTE_NAME_START]: {
            [Actions.CHAR]: (char: string) => {
                this.attrName = char;
                this.state = States.ATTRIBUTE_NAME;
            },
            [Actions.GT]: () => {
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SPACE]: noop,
            [Actions.SLASH]: () => {
                this.isClosing = true;
                this.state = States.TAG_END;
            },
        },
        [States.ATTRIBUTE_NAME]: {
            [Actions.SPACE]: () => {
                this.state = States.ATTRIBUTE_NAME_END;
            },
            [Actions.EQUAL]: () => {
                this.queue.push([Type.attributeName, this.attrName]);
                this.state = States.ATTRIBUTE_VALUE_BEGIN;
            },
            [Actions.GT]: () => {
                this.attrValue = '';
                this.queue.push([Type.attributeName, this.attrName]);
                this.queue.push([Type.attributeValue, this.attrValue]);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.SLASH]: () => {
                this.isClosing = true;
                this.attrValue = '';
                this.queue.push([Type.attributeName, this.attrName]);
                this.queue.push([Type.attributeValue, this.attrValue]);
                this.state = States.TAG_END;
            },
            [Actions.CHAR]: (char: string) => {
                this.attrName += char;
            },
        },
        [States.ATTRIBUTE_NAME_END]: {
            [Actions.SPACE]: noop,
            [Actions.EQUAL]: () => {
                this.queue.push([Type.attributeName, this.attrName]);
                this.state = States.ATTRIBUTE_VALUE_BEGIN;
            },
            [Actions.GT]: () => {
                this.attrValue = '';
                this.queue.push([Type.attributeName, this.attrName]);
                this.queue.push([Type.attributeValue, this.attrValue]);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: (char: string) => {
                this.attrValue = '';
                this.queue.push([Type.attributeName, this.attrName]);
                this.queue.push([Type.attributeValue, this.attrValue]);
                this.attrName = char;
                this.state = States.ATTRIBUTE_NAME;
            },
        },
        [States.ATTRIBUTE_VALUE_BEGIN]: {
            [Actions.SPACE]: noop,
            [Actions.QUOTE]: (char: string) => {
                this.openingQuote = char;
                this.attrValue = '';
                this.state = States.ATTRIBUTE_VALUE;
            },
            [Actions.GT]: () => {
                this.attrValue = '';
                this.queue.push([Type.attributeValue, this.attrValue]);
                this.data = '';
                this.state = States.DATA;
            },
            [Actions.CHAR]: (char: string) => {
                this.openingQuote = '';
                this.attrValue = char;
                this.state = States.ATTRIBUTE_VALUE;
            },
        },
        [States.ATTRIBUTE_VALUE]: {
            [Actions.SPACE]: (char: string) => {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    this.queue.push([Type.attributeValue, this.attrValue]);
                    this.state = States.ATTRIBUTE_NAME_START;
                }
            },
            [Actions.QUOTE]: (char: string) => {
                if (this.openingQuote === char) {
                    this.queue.push([Type.attributeValue, this.attrValue]);
                    this.state = States.ATTRIBUTE_NAME_START;
                } else {
                    this.attrValue += char;
                }
            },
            [Actions.GT]: (char: string) => {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    this.queue.push([Type.attributeValue, this.attrValue]);
                    this.data = '';
                    this.state = States.DATA;
                }
            },
            [Actions.SLASH]: (char: string) => {
                if (this.openingQuote) {
                    this.attrValue += char;
                } else {
                    this.queue.push([Type.attributeValue, this.attrValue]);
                    this.isClosing = true;
                    this.state = States.TAG_END;
                }
            },
            [Actions.CHAR]: (char: string) => {
                this.attrValue += char;
            },
        },
    }

}
