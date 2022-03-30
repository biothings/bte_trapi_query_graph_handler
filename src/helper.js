const crypto = require('crypto');
const biolink = require('./biolink');
const config = require('./config.js');

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

  _getInputIsSet(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$edge_metadata.trapi_qEdge_obj.getObject().isSet()
      : record.$edge_metadata.trapi_qEdge_obj.getSubject().isSet();
  }

  _getOutputIsSet(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$edge_metadata.trapi_qEdge_obj.getSubject().isSet()
      : record.$edge_metadata.trapi_qEdge_obj.getObject().isSet();
  }

  _getOutputCurie(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$input.obj[0].primaryID
      : record.$output.obj[0].primaryID;
  }

  _getInputCurie(record) {
    return record.$edge_metadata.trapi_qEdge_obj.isReversed()
      ? record.$output.obj[0].primaryID
      : record.$input.obj[0].primaryID;
  }

  _getAPI(record) {
    return record.$edge_metadata.api_name || undefined;
  }

  _getInforesCurie(record) {
    if (record.$edge_metadata['x-translator']) {
      return record.$edge_metadata['x-translator']['infores'] || undefined;
    }
    return undefined;
  }

  _getSource(record) {
    return record.$edge_metadata.source || undefined;
  }

  _getPublication(record) {
    return record.publications || undefined;
  }

  _getRecordHash(record) {
    const edgeMetaData = [
      this._getInputCurie(record),
      this._getPredicate(record),
      this._getOutputCurie(record),
      this._getAPI(record),
      this._getSource(record),
      this._getConfiguredEdgeAttributesForHash(record),
    ];
    return this._generateHash(edgeMetaData.join('-'));
  }

  _getConfiguredEdgeAttributesForHash(record) {
    return this._getEdgeAttributes(record)
      .filter((attribute) => {
        return config.EDGE_ATTRIBUTES_USED_IN_RECORD_HASH.includes(attribute.attribute_type_id);
      })
      .reduce((acc, attribute) => {
        return [...acc, `${attribute.attribute_type_id}:${attribute.value}`];
      }, [])
      .join(',');
  }

  _getEdgeAttributes(record) {
    return record['edge-attributes']
      ? record['edge-attributes'].reduce((arr, attribute) => {
          attribute.attributes
            ? arr.push(attribute, ...this._getEdgeAttributes(attribute))
            : arr.push(attribute);
          return arr;
        }, [])
      : [];
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

  _getInputEquivalentCuries(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$output.obj[0].curies
        : record.$input.obj[0].curies;
    } catch (err) {
      return null;
    }
  }

  _getInputNames(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$output.obj[0].dbIDs.name
        : record.$input.obj[0].dbIDs.name;
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

  _getOutputNames(record) {
    try {
      return record.$edge_metadata.trapi_qEdge_obj.isReversed()
        ? record.$input.obj[0].dbIDs.name
        : record.$output.obj[0].dbIDs.name;
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
};
