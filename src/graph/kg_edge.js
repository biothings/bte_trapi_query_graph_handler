module.exports = class KGEdge {
  constructor(id, info) {
    this.id = id;
    this.predicate = info.predicate;
    this.subject = info.subject;
    this.object = info.object;
    this.apis = new Set();
    this.api_ids = new Set();
    this.inforesCuries = new Set();
    this.sources = new Set();
    this.publications = new Set();
    this.qualifiers = {};
    this.attributes = {};
  }

  addAPI(api) {
    if (typeof api === 'undefined') {
      return;
    }
    if (!Array.isArray(api)) {
      api = [api];
    }
    api.map((item) => {
      this.apis.add(item);
    });
  }

  addApiID(id) {
    if (typeof id === 'undefined') {
      return
    }
    if (!Array.isArray(id)) {
      id = [id]
    }
    id.map((item) => {
      this.api_ids.add(item);
    })
  }

  addInforesCurie(inforesCurie) {
    if (typeof inforesCurie === 'undefined') {
      return;
    }
    if (!Array.isArray(inforesCurie)) {
      inforesCurie = [inforesCurie];
    }
    inforesCurie.map((item) => {
      this.inforesCuries.add(item);
    });
  }

  addSource(source) {
    if (typeof source === 'undefined') {
      return;
    }
    if (!Array.isArray(source)) {
      source = [source];
    }
    source.map((item) => {
      this.sources.add(item);
    });
  }

  addPublication(publication) {
    if (typeof publication === 'undefined') {
      return;
    }
    if (!Array.isArray(publication)) {
      publication = [publication];
    }
    publication.map((item) => {
      this.publications.add(item);
    });
  }

  addQualifier(name, value) {
    this.qualifiers[name] = value;
  }

  addAdditionalAttributes(name, value) {
    // special handling for full edge attributes
    if (name === 'edge-attributes') {
      this.attributes[name] = value;
      return;
    }

    if (!(name in this.attributes)) {
      this.attributes[name] = new Set();
    }
    if (!Array.isArray(value)) {
      value = [value];
    }
    value.map((item) => {
      this.attributes[name].add(item)
    })
  }
};
