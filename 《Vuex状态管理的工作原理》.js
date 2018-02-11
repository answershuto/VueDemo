let Vue;

class Store {
    constructor () {
        this._vm = new Vue({
            data: {
                $$state: this.state
            }
        })
    }

    commit (type, payload, _options) {
        const entry = this._mutations[type];
        entry.forEach(function commitIterator (handler) {
            handler(payload);
        });
    }

    dispatch (type, payload) {
        const entry = this._actions[type];

        return entry.length > 1
        ? Promise.all(entry.map(handler => handler(payload)))
        : entry[0](payload);
    }
}

function vuexInit () {
    const options = this.$options;
    if (options.store) {
        this.$store = options.store;
    } else {
        this.$store = options.parent.$store;
    }
}

export default install (_Vue) {
    Vue.mixin({ beforeCreate: vuexInit });
    Vue = _Vue;
}