class VNode {
    constructor (tag, data, children, text, elm) {
        this.tag = tag;
        this.data = data;
        this.children = children;
        this.text = text;
        this.elm = elm;
    }
}

createEmptyVNode () {
    const node = new VNode();
    node.text = '';
    return node;
}

function createTextVNode (val) {
    return new VNode(undefined, undefined, undefined, String(val));
}

function cloneVNode (node) {
    const cloneVnode = new VNode(
        node.tag,
        node.data,
        node.children,
        node.text,
        node.elm
    );
}