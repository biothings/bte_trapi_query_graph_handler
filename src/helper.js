const crypto = require('crypto');
const biolink = require('./biolink');

module.exports = class QueryGraphHelper {
  _generateHash(stringToBeHashed) {
    return crypto.createHash('md5').update(stringToBeHashed).digest('hex');
  }

  _getInputQueryNodeID(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$edge_metadata.trapi_qEdge_obj.getObject().getID()
      : record.$edge_metadata.trapi_qEdge_obj.getSubject().getID();
  }

  _getPredicate(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? 'biolink:' + biolink.reverse(record.$edge_metadata.predicate)
      : 'biolink:' + record.$edge_metadata.predicate;
  }

  _getOutputQueryNodeID(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$edge_metadata.trapi_qEdge_obj.getSubject().getID()
      : record.$edge_metadata.trapi_qEdge_obj.getObject().getID();
  }

  _getOutputID(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$input.obj[0].primaryID
      : record.$output.obj[0].primaryID;
  }

  _getInputID(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$output.obj[0].primaryID
      : record.$input.obj[0].primaryID;
  }

  _getAPI(record) {
    return record.$edge_metadata.api_name || undefined;
  }

  _getSource(record) {
    return record.$edge_metadata.source || undefined;
  }

  _getPublication(record) {
    return record.publications || undefined;
  }

  _getKGEdgeID(record) {
    return [this._getInputID(record), this._getPredicate(record), this._getOutputID(record)].join('-');
  }

  _createUniqueEdgeID(record) {
    const edgeMetaData = [
      this._getInputID(record),
      this._getOutputID(record),
      this._getAPI(record),
      this._getSource(record),
    ];
    // return this._generateHash(edgeMetaData.join('-'));
    return edgeMetaData.join('-');
  }

  _getInputCategory(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$output.obj[0].semanticType
      : record.$input.obj[0].semanticType;
  }

  _getOutputCategory(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$input.obj[0].semanticType
      : record.$output.obj[0].semanticType;
  }

  _getOutputLabel(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$input.obj[0].label
      : record.$output.obj[0].label;
  }

  _getInputLabel(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$output.obj[0].label
      : record.$input.obj[0].label;
  }

  _getInputEquivalentIds(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$output.obj[0].curies
        : record.$input.obj[0].curies;
    } catch (err) {
      return null;
    }
  }

  _getInputAttributes(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$output.obj[0].attributes
        : record.$input.obj[0].attributes;
    } catch (err) {
      return null;
    }
  }

  _getOutputEquivalentIds(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$input.obj[0].curies
        : record.$output.obj[0].curies;
    } catch (err) {
      return null;
    }
  }

  _getOutputAttributes(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$input.obj[0].attributes
        : record.$output.obj[0].attributes;
    } catch (err) {
      return null;
    }
  }

  // from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Set
  _intersection(setA, setB) {
      let _intersection = new Set()
      for (let elem of setB) {
          if (setA.has(elem)) {
              _intersection.add(elem)
          }
      }
      return _intersection
  }

  // see https://stackoverflow.com/a/29585704
  _cartesian(a) { // a = array of arrays
    var i, j, l, m, a1, o = [];
    if (!a || a.length == 0) return a;

    a1 = a.splice(0, 1)[0]; // the first array of a
    a = this._cartesian(a);
    for (i = 0, l = a1.length; i < l; i++) {
      if (a && a.length)
        for (j = 0, m = a.length; j < m; j++)
          o.push([a1[i]].concat(a[j]));
      else
        o.push([a1[i]]);
    }
    return o;
  }
};
