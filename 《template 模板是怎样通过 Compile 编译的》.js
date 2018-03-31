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
        if (pos > 0) {
            currentParent = stack[pos - 1];
        } else {
            currentParent = null;
        }
        stack.length = pos;
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
                    lowerCasedTag: startTagMatch.tagName.toLowerCase(),
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
    return root;
}

function parse () {
    return parseHTML();
}

function optimize (rootAst) {
    function isStatic (node) {
        if (node.type === 2) {
            return false
        }
        if (node.type === 3) {
            return true
        }
        return (!node.if && !node.for);
    }
    function markStatic (node) {
        node.static = isStatic(node);
        if (node.type === 1) {
            for (let i = 0, l = node.children.length; i < l; i++) {
                const child = node.children[i];
                markStatic(child);
                if (!child.static) {
                    node.static = false;
                }
            }
        }
    }

    function markStaticRoots (node) {
        if (node.type === 1) {
            if (node.static && node.children.length && !(
            node.children.length === 1 &&
            node.children[0].type === 3
            )) {
                node.staticRoot = true;
                return;
            } else {
                node.staticRoot = false;
            }
        }
    }

    markStatic(rootAst);
    markStaticRoots(rootAst);
}

function generate (rootAst) {

    function genIf (el) {
        el.ifProcessed = true;
        if (!el.ifConditions.length) {
            return '_e()';
        }
        return `(${el.ifConditions[0].exp})?${genElement(el.ifConditions[0].block)}: _e()`
    }

    function genFor (el) {
        el.forProcessed = true;

        const exp = el.for;
        const alias = el.alias;
        const iterator1 = el.iterator1 ? `,${el.iterator1}` : '';
        const iterator2 = el.iterator2 ? `,${el.iterator2}` : '';

        return `_l((${exp}),` +
            `function(${alias}${iterator1}${iterator2}){` +
            `return ${genElement(el)}` +
        '})';
    }

    function genText (el) {
        return `_v(${el.expression})`;
    }

    function genNode (el) {
        if (el.type === 1) {
            return genElement(el);
        } else {
            return genText(el);
        }
    }

    function genChildren (el) {
        const children = el.children;

        if (children && children.length > 0) {
            return `${children.map(genNode).join(',')}`;
        }
    }

    function genElement (el) {
        if (el.if && !el.ifProcessed) {
            return genIf(el);
        } else if (el.for && !el.forProcessed) {
            return genFor(el);
        } else {
            const children = genChildren(el);
            let code;
            code = `_c('${el.tag},'{
                staticClass: ${el.attrsMap && el.attrsMap[':class']},
                class: ${el.attrsMap && el.attrsMap['class']},
            }${
                children ? `,${children}` : ''
            })`
            return code;
        }
    }

    const code = rootAst ? genElement(rootAst) : '_c("div")'
    return {
        render: `with(this){return ${code}}`,
    }
}

//
var html = '<div :class="c" class="demo" v-if="isShow"><span v-for="item in sz">{{item}}</span></div>';

const ast = parse();
optimize(ast);
const code = generate(ast);
