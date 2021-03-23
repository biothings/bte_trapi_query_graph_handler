
module.exports = class KGEdge {
    constructor(id, info) {
        this.id = id;
        this.predicate = info.predicate;
        this.subject = info.subject;
        this.object = info.object;
        this.apis = new Set();
        this.sources = new Set();
        this.publications = new Set();
        this.attributes = {};
    }

    addAPI(api) {
        if (typeof api === "undefined") {
            return
        }
        if (!Array.isArray(api)) {
            api = [api];
        }
        api.map(item => {
            this.apis.add(item);
        })
    }

    addSource(source) {
        if (typeof source === "undefined") {
            return
        }
        if (!Array.isArray(source)) {
            source = [source];
        }
        source.map(item => {
            this.sources.add(item);
        })
    }

    addPublication(publication) {
        if (typeof publication === "undefined") {
            return
        }
        if (!Array.isArray(publication)) {
            publication = [publication];
        }
        publication.map(item => {
            this.publications.add(item);
        })
    }

    addAdditionalAttributes(name, value) {
        this.attributes[name] = value;
    }
}