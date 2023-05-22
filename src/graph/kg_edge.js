const _ = require('lodash');
module.exports = class KGEdge {
  constructor(id, info) {
    this.id = id;
    this.predicate = info.predicate;
    this.subject = info.subject;
    this.object = info.object;
    this.apis = new Set();
    this.inforesCuries = new Set();
    this.sources = {};
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
    source.forEach((item) => {
      if (!this.sources[item.resource_id]) this.sources[item.resource_id] = {};
      if (!this.sources[item.resource_id][item.resource_role]) {
        if (item.upstream_resource_ids) item.upstream_resource_ids = new Set(item.upstream_resource_ids);
        this.sources[item.resource_id][item.resource_role] = item;
      }
      item.upstream_resource_ids?.forEach((upstream) =>
        this.sources[item.resource_id][item.resource_role].upstream_resource_ids.add(upstream),
      );
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
      this.attributes[name].add(item);
    });
  }
};
