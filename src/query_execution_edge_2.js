const helper = require('./helper');
const debug = require('debug')('bte:biothings-explorer-trapi:UpdatedExeEdge');
const utils = require('./utils');
const reverse = require('./biolink');

//This is an edge class based on QExeEdge with more features
module.exports = class UpdatedExeEdge {
  /**
   *
   * @param {string} id - QEdge ID
   * @param {object} info - QEdge info, e.g. subject, object, predicate
   */
  constructor(qEdge, reverse = false, prev_edge = undefined) {
    this.qEdge = qEdge;
    //nodes that make up this edge
    this.connecting_nodes = [];
    this.reverse = reverse;
    this.prev_edge = prev_edge;
    //object and subject aliases
    this.input_equivalent_identifiers = {};
    this.output_equivalent_identifiers = {};
    //instances of query_node
    this.object = qEdge.object;
    this.subject = qEdge.subject;
    //entity counts
    // (object #) ----> ()
    this.object_entity_count = null;
    // () ----> (subject #)
    this.subject_entity_count = null;
    //edge has been fully executed
    this.executed = false;
    //run initial checks
    this.logs = [];
    //this edges results
    this.results = [];
    //edge needs to perform intersection
    this.requires_intersection = false;
    //init state
    this.init();
  }

  init() {
    debug(`(2) Created Edge` +
    ` ${JSON.stringify(this.qEdge.getID())} Reverse = ${this.reverse}`)
    this.checkInitialEntityCount();
    this.checkConnectingNodes();
    this.checkIFResultsNeedIntersection();
  }

  checkConnectingNodes() {
    this.connecting_nodes.push(this.subject.id);
    this.connecting_nodes.push(this.object.id);
    debug(`(2) Connecting nodes -> ${JSON.stringify(this.connecting_nodes)}`);
  }

  checkInitialEntityCount() {
    //if ids found set entity count to number of ids
    //eg. we expect curie: ["PUBCHEM.COMPOUND:2662"]
    //object
    debug(`(2) Updated Edge Initial Entity Counts`);
    this.object_entity_count = this.object.hasInput() ? 
    this.object.curie.length : null;
    //subject
    this.subject_entity_count = this.subject.hasInput() ? 
    this.subject.curie.length : null;
  }

  updateEntityCountByID(node_id, entities) {
    //check subject
    if (this.subject.id == node_id) {
      this.qEdge.subject.curie = entities;
      this.subject_entity_count = entities.length;
      debug(`(7) Updated ${this.qEdge.getID()}` +
      ` Subject entity count from node "${node_id}" = ${entities.length}`);
    }
    //check object
    else if (this.object.id == node_id) {
      this.qEdge.object.curie = entities;
      this.object_entity_count = entities.length;
      debug(`(7) Updated ${this.qEdge.getID()}` +
      ` Object entity count from node "${node_id}" = ${entities.length}`);
    }
    this.checkIFResultsNeedIntersection();
  }

  checkIFResultsNeedIntersection() {
    //if both ends of edge have entity counts this edge will
    //require an extra step when saving results
    this.requires_intersection = this.object_entity_count && this.subject_entity_count ?
    true : false;
  }

  chooseLowerEntityValue() {
    //edge has both subject and object entity counts and must choose lower value
    //to use in query.
    debug(`(8) Choosing lower entity count in edge...`);
    if (this.object_entity_count && this.subject_entity_count) {
      if (this.object_entity_count > this.subject_entity_count) {
        //(#) ---> ()
        this.reverse = false;
        //keep subject curie and delete object curie
        delete this.qEdge.object['curie']
        debug(`(8) Chose lower entity value in subject (${this.subject_entity_count})`);
      } else {
        //() <--- (#)
        this.reverse = true;
        //keep object curie and delete subject curie
        delete this.qEdge.subject['curie']
        debug(`(8) Chose lower entity value in object (${this.object_entity_count})`);
      }
    }else{
      debug(`(8) Error: Edge must have both object and subject entity values.`);
    }
  }

  intersectAndSaveResults(current_results, all_edges) {
    debug(`(8) Performing intersection of ${current_results.length} results...`);
    //check to see if this edge has neighbors and
    //perform intersection with them
    all_edges.forEach((edge, index, array) => {
      //find current edge
      if (edge.getID() == this.qEdge.getID()) {
        //check if neighbor to the LEFT exists if so intersect results
        if (array[index - 1] !== undefined) {
          let neighbor = array[index - 1];
          debug(`(8) Intersection with PREV neighbor "${neighbor.getID()}"<-(${this.qEdge.getID()})`);
          let prev_edge_res = this.intersectResults(neighbor.results, current_results);
        }
        //check if neighbor to the RIGHT exists if so intersect results
        if (array[index + 1] !== undefined) {
          let neighbor = array[index + 1];
          debug(`(8) Intersection with NEXT neighbor (${this.qEdge.getID()})->"${neighbor.getID()}"`);
          let next_edge_res = this.intersectResults(current_results, neighbor.results);
        }
      }
    });
    //save results
    this.results = current_results;
    debug(`(9) Intersection done.`);
  }

  intersectResults(first, second) {
    debug(`(9) Received (${first.length}) & (${second.length}) results...`);
    let results = [];
    let dropped = 0;
    //find semantic type of one edge in the other edge
    //it can be output or input
    //that's the entity connecting them, then compare
    //(G)---((CS)) and ((G))----(D)
    //CS is output in first edge and input on second
    //FIRST
    first.forEach((f) => {
      let first_semantic_types = f.$input.obj;
      first_semantic_types = first_semantic_types.concat(f.$output.obj);

      first_semantic_types.forEach((f_type) => {
        //SECOND
        second.forEach((s) => {
          let second_semantic_types = s.$input.obj;
          second_semantic_types = second_semantic_types.concat(s.$output.obj);

          second_semantic_types.forEach((s_type) => {
            //compare types
            if (f_type._leafSemanticType == s_type._leafSemanticType) {
              //type match 

              //collect first ids
              let f_ids = new Set();
              for (const prefix in f_type._dbIDs) {
                f_ids.add(prefix + ':' + f_type._dbIDs[prefix])
              }
              //collect second ids
              let s_ids = new Set();
              for (const prefix in s_type._dbIDs) {
                s_ids.add(prefix + ':' + s_type._dbIDs[prefix])
              }
              //compare ids and keep if match in both
              f_ids.forEach((f_id) => {
                s_ids.forEach((s_id) => {
                  if (f_id == s_id) {
                    //match, adding to results
                    results.push(f)
                  }
                });
              });
            }
          });
        });
      });
    });
    dropped = (first.length + second.length) - results.length;
    debug(`(9) Kept (${results.length}) / Dropped (${dropped}) results`);
    return results
  }

  storeResults(res) {
    this.results = res;
  }

  getID() {
    return this.qEdge.getID();
  }

  getHashedEdgeRepresentation() {
    const toBeHashed =
      this.getSubject().getCategories() + this.getPredicate() + this.getObject().getCategories() + this.getInputCurie();
    return new helper()._generateHash(toBeHashed);
  }

  expandPredicates(predicates) {
    const reducer = (acc, cur) => [...acc, ...reverse.getDescendantPredicates(cur)];
    return Array.from(new Set(predicates.reduce(reducer, [])));
  }

  getPredicate() {
    if (this.predicate === undefined) {
      return undefined;
    }
    const predicates = utils.toArray(this.predicate).map((item) => utils.removeBioLinkPrefix(item));
    const expandedPredicates = this.expandPredicates(predicates);
    debug(`Expanded edges: ${expandedPredicates}`);
    return expandedPredicates
      .map((predicate) => {
        return this.isReversed() === true ? reverse.reverse(predicate) : predicate;
      })
      .filter((item) => !(typeof item === 'undefined'));
  }

  getSubject() {
    if (this.reverse) {
      return this.qEdge.object;
    }
    return this.qEdge.subject;
  }

  getObject() {
    if (this.reverse) {
      return this.qEdge.subject;
    }
    return this.qEdge.object;
  }

  isReversed() {
    return this.reverse;
  }

  getInputCurie() {
    let curie = this.qEdge.subject.getCurie() || this.qEdge.object.getCurie();
    if (Array.isArray(curie)) {
      return curie;
    }
    return [curie];
  }

  getInputNode() {
    return this.reverse ? this.qEdge.object : this.qEdge.subject;
  }

  getOutputNode() {
    return this.reverse ? this.qEdge.subject : this.qEdge.object;
  }

  hasInputResolved() {
    return !(Object.keys(this.input_equivalent_identifiers).length === 0);
  }

  hasInput() {
    if (this.reverse) {
      return this.qEdge.object.hasInput();
    }
    return this.qEdge.subject.hasInput();
  }
};

