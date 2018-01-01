function patch (oldVNode, vnode, parentElm) {
    if (!oldVnode) {
        addVnodes(parentElm, vnode, 0, vnode.length - 1);
    } else if (!vnode) {
        removeVnodes(parentElm, oldVnode, 0, oldVnode.length - 1);
    } else {
        if (sameVnode(oldVNode, vnode)) {
            patchVnode(oldVNode, vnode);
        } else {
            addVnodes(vnode.elm, vnode);
            removeVnodes(oldVNode);
        }
    }
}
