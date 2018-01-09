const ncname = '[a-zA-Z_][\\w\\-\\.]*';
const singleAttrIdentifier = /([^\s"'<>/=]+)/
const singleAttrAssign = /(?:=)/
const singleAttrValues = [
  /"([^"]*)"+/.source,
  /'([^']*)'+/.source,
  /([^\s"'=<>`]+)/.source
]
const attribute = new RegExp(
  '^\\s*' + singleAttrIdentifier.source +
  '(?:\\s*(' + singleAttrAssign.source + ')' +
  '\\s*(?:' + singleAttrValues.join('|') + '))?'
)

const qnameCapture = '((?:' + ncname + '\\:)?' + ncname + ')'
const startTagOpen = new RegExp('^<' + qnameCapture)
const startTagClose = /^\s*(\/?)>/

const endTag = new RegExp('^<\\/' + qnameCapture + '[^>]*>')

const defaultTagRE = /\{\{((?:.|\n)+?)\}\}/g

const forAliasRE = /(.*?)\s+(?:in|of)\s+(.*)/

const stack = [];
let currentParent, root;

let index = 0;

function advance (n) {
    index += n
    html = html.substring(n)
}

function makeAttrsMap (attrs) {
    const map = {}
    for (let i = 0, l = attrs.length; i < l; i++) {
        map[attrs[i].name] = attrs[i].value;
    }
    return map
}

function parseStartTag () {
    const start = html.match(startTagOpen);
    if (start) {
        const match = {
            tagName: start[1],
            attrs: [],
            start: index
        }
        advance(start[0].length);

        let end, attr
        while (!(end = html.match(startTagClose)) && (attr = html.match(attribute))) {
            advance(attr[0].length)
            match.attrs.push({
                name: attr[1],
                value: attr[3]
            });
        }
        if (end) {
            match.unarySlash = end[1];
            advance(end[0].length);
            match.end = index;
            return match
        }
    }
}

function parseEndTag (tagName) {
    let pos;
    for (pos = stack.length - 1; pos >= 0; pos--) {
        if (stack[pos].lowerCasedTag === tagName.toLowerCase()) {
            break;
        }
    }

    if (pos >= 0) {
        stack.length = pos;
        currentParent = stack[pos]; 
    }   
}

function parseText (text) {
    if (!defaultTagRE.test(text)) return;

    const tokens = [];
    let lastIndex = defaultTagRE.lastIndex = 0
    let match, index
    while ((match = defaultTagRE.exec(text))) {
        index = match.index

        if (index > lastIndex) {
        tokens.push(JSON.stringify(text.slice(lastIndex, index)))
        }
        
        const exp = match[1].trim()
        tokens.push(`_s(${exp})`)
        lastIndex = index + match[0].length
    }

    if (lastIndex < text.length) {
        tokens.push(JSON.stringify(text.slice(lastIndex)))
    }
    return tokens.join('+');
}

function getAndRemoveAttr (el, name) {
    let val
    if ((val = el.attrsMap[name]) != null) {
        const list = el.attrsList
        for (let i = 0, l = list.length; i < l; i++) {
            if (list[i].name === name) {
                list.splice(i, 1)
                break
            }   
        }
    }
    return val
}

function processFor (el) {
    let exp;
    if ((exp = getAndRemoveAttr(el, 'v-for'))) {
        const inMatch = exp.match(forAliasRE);
        el.for = inMatch[2].trim();
        el.alias = inMatch[1].trim();
    }
}

function processIf (el) {
    const exp = getAndRemoveAttr(el, 'v-if');
    if (exp) {
        el.if = exp;
        if (!el.ifConditions) {
            el.ifConditions = [];
        }
        el.ifConditions.push({
            exp: exp,
            block: el
        });
    }
}

function parseHTML () {
    while(html) {
        let textEnd = html.indexOf('<');
        if (textEnd === 0) {
            const endTagMatch = html.match(endTag)
            if (endTagMatch) {
                advance(endTagMatch[0].length);
                parseEndTag(endTagMatch[1]);
                continue;
            }
            if (html.match(startTagOpen)) {
                const startTagMatch = parseStartTag();
                const element = {
                    type: 1,
                    tag: startTagMatch.tagName,
                    attrsList: startTagMatch.attrs,
                    attrsMap: makeAttrsMap(startTagMatch.attrs),
                    parent: currentParent,
                    children: []
                }

                processIf(element);
                processFor(element);

                if(!root){
                    root = element
                }

                if(currentParent){
                    currentParent.children.push(element);
                }
        
                stack.push(element);
                currentParent = element;
                continue;
            }
        } else {
            text = html.substring(0, textEnd)
            advance(textEnd)
            let expression;
            if (expression = parseText(text)) {
                currentParent.children.push({
                    type: 2,
                    text,
                    expression
                });
            } else {
                currentParent.children.push({
                    type: 3,
                    text,
                });
            }
            continue;
        }
    }
    console.log('root', root);
    console.log('----------');
    return root;
}

function parse () {
    return parseHTML();
}

function optimize (rootAst) {
    function isStatic () {
        if (node.type === 2) {
            return false
        }
        if (node.type === 3) {
            return true
        }
    }
    function markStatic () {
        
    }
}
//
var html = '<div :class="c" class="demo" v-if="isShow"><span v-for="item in sz">{{item}}</span></div>';

const ast = parse();
optimize(ast);
