module.exports = class KGNode {
  constructor(id, info) {
    this.id = id;
    this._primaryCurie = info.primaryCurie;
    this._qNodeID = info.qNodeID;
    this._curies = info.equivalentCuries;
    this._names = info.names;
    this._semanticType = info.category;
    this._nodeAttributes = info.nodeAttributes;
    this._label = info.label;
    this._sourceNodes = new Set();
    this._targetNodes = new Set();
    this._sourceQNodeIDs = new Set();
    this._targetQNodeIDs = new Set();
  }

  addSourceNode(kgNode) {
    this._sourceNodes.add(kgNode);
  }

  addTargetNode(kgNode) {
    this._targetNodes.add(kgNode);
  }

  addSourceQNodeID(qNodeID) {
    this._sourceQNodeIDs.add(qNodeID);
  }

  addTargetQNodeID(qNodeID) {
    this._targetQNodeIDs.add(qNodeID);
  }
};
