/* 匹配头 */
const ncname = '[a-zA-Z_][\\w\\-\\.]*';

const singleAttrIdentifier = /([^\s"'<>/=]+)/
const singleAttrAssign = /(?:=)/
const singleAttrValues = [
  // attr value double quotes
  /"([^"]*)"+/.source,
  // attr value, single quotes
  /'([^']*)'+/.source,
  // attr value, no quotes
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

const stack = [];
let currentParent, root;

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
                tag: attr[1],
                val: attr[3]
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
            console.log(text);
            advance(textEnd)
        }
    }
    //console.log(root);
}
//
var html = '<div :class="c" class="demo" v-if="isShow"><span v-for="item in sz">{{item}}</span></div>';
var index = 0;

parseHTML();