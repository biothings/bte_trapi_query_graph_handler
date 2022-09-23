const helper = require('./helper');
const debug = require('debug')('bte:biothings-explorer-trapi:QueryExecutionEdge');
const utils = require('./utils');
const biolink = require('./biolink');

module.exports = class QueryExecutionEdge {
  /**
   *
   * @param {string} id - QEdge ID
   * @param {object} info - QEdge info, e.g. subject, object, predicate
   */
  constructor(qEdge, reverse = false, prev_edge = undefined) {
    this.qEdge = qEdge;
    //nodes that make up this edge
    // this.connecting_nodes = [];
    this.reverse = reverse;
    this.prev_edge = prev_edge;
    //object and subject aliases
    this.input_equivalent_identifiers = {};
    this.output_equivalent_identifiers = {};
    //instances of query_node
    //this.object/subject are instances of QNode
    this.object = qEdge.object;
    this.subject = qEdge.subject;
    //edge has been fully executed
    this.executed = false;
    //run initial checks
    this.logs = [];
    //this edges query response records
    this.records = [];
    debug(`(2) Created Edge` +
    ` ${JSON.stringify(this.qEdge.getID())} Reverse = ${this.reverse}`)
  }

  chooseLowerEntityValue() {
    //edge has both subject and object entity counts and must choose lower value
    //to use in query.
    debug(`(8) Choosing lower entity count in edge...`);
    if (this.qEdge.object.entity_count && this.qEdge.subject.entity_count) {
      if (this.qEdge.object.entity_count == this.qEdge.subject.entity_count) {
        // //(#) ---> ()
        this.reverse = false;
        this.qEdge.object.holdCurie();
        debug(`(8) Sub - Obj were same but chose subject (${this.qEdge.subject.entity_count})`);
      }
      else if (this.qEdge.object.entity_count > this.qEdge.subject.entity_count) {
        //(#) ---> ()
        this.reverse = false;
        //tell node to hold curie in a temp field
        this.qEdge.object.holdCurie();
        debug(`(8) Chose lower entity value in subject (${this.qEdge.subject.entity_count})`);
      } else {
        //() <--- (#)
        this.reverse = true;
        //tell node to hold curie in a temp field
        this.qEdge.subject.holdCurie();
        debug(`(8) Chose lower entity value in object (${this.qEdge.object.entity_count})`);
      }
    } else {
      debug(`(8) Error: Edge must have both object and subject entity values.`);
    }
  }

  extractCuriesFromRecords(records, isReversed) {
    //will give you all curies found by semantic type, each type will have
    //a main ID and all of it's aliases
    debug(`(7) Updating Entities in "${this.qEdge.getID()}"`);
    let typesToInclude = isReversed ?
    this.qEdge.subject.getCategories() :
    this.qEdge.object.getCategories();
    debug(`(7) Collecting Types: "${JSON.stringify(typesToInclude)}"`);
    let all = {};
    records.forEach((record) => {

      record.subject.normalizedInfo.forEach((o) => {
        //create semantic type if not included
        let type = o._leafSemanticType;
        if (typesToInclude.includes(type) ||
          typesToInclude.includes('NamedThing') ||
          typesToInclude.toString().includes(type)) {
          if (!Object.hasOwnProperty.call(all, type)) {
            all[type] = {};
          }
          //get original and aliases
          let original = record.subject.original;
          //#1 prefer equivalent ids
          if (Object.hasOwnProperty.call(o, '_dbIDs')) {
            let original_aliases = new Set();
            for (const prefix in o._dbIDs) {
              //check if array
              if (Array.isArray(o._dbIDs[prefix])) {
                o._dbIDs[prefix].forEach((single_alias) => {
                  if (single_alias) {
                    if (single_alias.includes(':')) {
                      //value already has prefix
                      original_aliases.add(single_alias);
                    } else {
                      //concat with prefix
                      original_aliases.add(prefix + ':' + single_alias);
                    }
                  }
                });
              } else {
                if (o._dbIDs[prefix].includes(':')) {
                  //value already has prefix
                  original_aliases.add(o._dbIDs[prefix]);
                } else {
                  //concat with prefix
                  original_aliases.add(prefix + ':' + o._dbIDs[prefix]);
                }
              }
            }
            original_aliases = [...original_aliases];
            //check and add only unique
            let was_found = false;
            original_aliases.forEach((alias) => {
              if (Object.hasOwnProperty.call(all[type], alias)) {
                was_found = true;
              }
            });
            if (!was_found) {
              all[type][original] = original_aliases;
            }
          }
          //else #2 check curie
          else if (Object.hasOwnProperty.call(o, 'curie')) {
            if (Array.isArray( o.curie)) {
              all[type][original] = o.curie;
            } else {
              all[type][original] = [o.curie];
            }
          }
          //#3 last resort check original
          else {
            all[type][original] = [original];
          }
        }
      });

      record.object.normalizedInfo.forEach((o) => {
        //create semantic type if not included
        let type = o._leafSemanticType;
        if (typesToInclude.includes(type) ||
          typesToInclude.includes('NamedThing') ||
          typesToInclude.toString().includes(type))  {
          if (!Object.hasOwnProperty.call(all, type)) {
            all[type] = {};
          }
          //get original and aliases
          let original = record.object.original;

          //#1 prefer equivalent ids
          if (Object.hasOwnProperty.call(o, '_dbIDs')) {
            let original_aliases = new Set();
            for (const prefix in o._dbIDs) {
              //check if array
              if (Array.isArray(o._dbIDs[prefix])) {
                o._dbIDs[prefix].forEach((single_alias) => {
                  if (single_alias) {
                    if (single_alias.includes(':')) {
                      //value already has prefix
                      original_aliases.add(single_alias);
                    } else {
                      //concat with prefix
                      original_aliases.add(prefix + ':' + single_alias);
                    }
                  }
                });
              } else {
                if (o._dbIDs[prefix].includes(':')) {
                  //value already has prefix
                  original_aliases.add(o._dbIDs[prefix]);
                } else {
                  //concat with prefix
                  original_aliases.add(prefix + ':' + o._dbIDs[prefix]);
                }
              }
            }
            original_aliases = [...original_aliases];
            //check and add only unique
            let was_found = false;
            original_aliases.forEach((alias) => {
              if (Object.hasOwnProperty.call(all[type], alias)) {
                was_found = true;
              }
            });
            if (!was_found) {
              all[type][original] = original_aliases;
            }
          }
          //else #2 check curie
          else if (Object.hasOwnProperty.call(o, 'curie')) {
            if (Array.isArray( o.curie)) {
              all[type][original] = o.curie;
            } else {
              all[type][original] = [o.curie];
            }
          }
          //#3 last resort check original
          else {
            all[type][original] = [original];
          }
        }
      });

    });
    // {Gene:{'id': ['alias']}}
    debug(`Collected entity ids in records: ${JSON.stringify(Object.keys(all))}`);
    return all;
  }

  _combineCuries(curies) {
    //combine all curies in case there are
    //multiple categories in this node since
    //they are separated by type
    let combined  = {};
    for (const type in curies) {
      for (const original in curies[type]) {
        combined[original] = curies[type][original];
      }
    }
    return combined;
  }

  updateNodesCuries(records) {
    //update node queried (1) ---> (update)
    let curies_by_semantic_type = this.extractCuriesFromRecords(records, this.reverse);
    let combined_curies = this._combineCuries(curies_by_semantic_type);
    this.reverse ?
    this.qEdge.subject.updateCuries(combined_curies) :
    this.qEdge.object.updateCuries(combined_curies);
    //update node used as input (1 [update]) ---> ()
    let curies_by_semantic_type_2 = this.extractCuriesFromRecords(records, !this.reverse);
    let combined_curies_2 = this._combineCuries(curies_by_semantic_type_2);
    !this.reverse ?
    this.qEdge.subject.updateCuries(combined_curies_2) :
    this.qEdge.object.updateCuries(combined_curies_2);
  }

  applyNodeConstraints() {
    debug(`(6) Applying Node Constraints to ${this.records.length} records.`);
    let kept = [];
    let save_kept = false;
    let sub_constraints = this.subject.constraints;
    if (sub_constraints && sub_constraints.length) {
      let from = this.reverse ? 'object' : 'subject';
      debug(`Node (subject) constraints: ${JSON.stringify(sub_constraints)}`);
      save_kept = true;
      for (let i = 0; i < this.records.length; i++) {
        const res = this.records[i];
        let keep = true;
        //apply constraints
        for (let x = 0; x < sub_constraints.length; x++) {
          const constraint = sub_constraints[x];
          keep = this.meetsConstraint(constraint, res, from)
        }
        //pass or not
        if (keep) {
          kept.push(res);
        }
      }
    }

    let obj_constraints = this.object.constraints;
    if (obj_constraints && obj_constraints.length) {
      let from = this.reverse ? 'subject' : 'object';
      debug(`Node (object) constraints: ${JSON.stringify(obj_constraints)}`);
      save_kept = true;
      for (let i = 0; i < this.records.length; i++) {
        const res = this.records[i];
        let keep = true;
        //apply constraints
        for (let x = 0; x < obj_constraints.length; x++) {
          const constraint = obj_constraints[x];
          keep = this.meetsConstraint(constraint, res, from)
        }
        //pass or not
        if (keep) {
          kept.push(res);
        }
      }
    }
    if (save_kept) {
      //only override recordss if there was any filtering done.
      this.records =  kept;
      debug(`(6) Reduced to (${this.records.length}) records.`);
    } else {
      debug(`(6) No constraints. Skipping...`);
    }
  }

  meetsConstraint(constraint, record, from) {
    //list of attribute ids in node
    let available_attributes = new Set();
    for (const key in record[from].attributes) {
      available_attributes.add(key)
    }
    available_attributes = [...available_attributes];
    // debug(`ATTRS ${JSON.stringify(record[from].normalizedInfo[0]._leafSemanticType)}` +
    // ` ${from} : ${JSON.stringify(available_attributes)}`);
    //determine if node even contains right attributes
    let filters_found = available_attributes.filter((attr) => attr == constraint.id);
    if (!filters_found.length) {
      //node doesn't have the attribute needed
      return false;
    } else {
      //match attr by name, parse only attrs of interest
      let node_attributes = {};
      filters_found.forEach((filter) => {
        node_attributes[filter] = record[from].attributes[filter];
      });
      switch (constraint.operator) {
        case "==":
            for (const key in node_attributes) {
              if (!isNaN(constraint.value)) {
                if (Array.isArray(node_attributes[key])) {
                  if (node_attributes[key].includes(constraint.value) ||
                  node_attributes[key].includes(constraint.value.toString())) {
                    return true;
                  }
                } else {
                  if (node_attributes[key] == constraint.value ||
                    node_attributes[key] == constraint.value.toString() ||
                    node_attributes[key] == parseInt(constraint.value)) {
                    return true;
                  }
                }
              } else {
                if (Array.isArray(node_attributes[key])) {
                  if (node_attributes[key].includes(constraint.value)) {
                    return true;
                  }
                } else {
                  if (node_attributes[key] == constraint.value ||
                    node_attributes[key] == constraint.value.toString() ||
                    node_attributes[key] == parseInt(constraint.value)) {
                    return true;
                  }
                }
              }
            }
            return false;
        case ">":
            for (const key in node_attributes) {
              if (Array.isArray(node_attributes[key])) {
                for (let index = 0; index < node_attributes[key].length; index++) {
                  const element = node_attributes[key][index];
                  if (parseInt(element) > parseInt(constraint.value)) {
                    return true;
                  }
                }
              } else {
                if (parseInt(node_attributes[key]) > parseInt(constraint.value)) {
                  return true;
                }
              }
            }
            return false;
        case ">=":
          for (const key in node_attributes) {
            if (Array.isArray(node_attributes[key])) {
              for (let index = 0; index < node_attributes[key].length; index++) {
                const element = node_attributes[key][index];
                if (parseInt(element) >= parseInt(constraint.value)) {
                  return true;
                }
              }
            } else {
              if (parseInt(node_attributes[key]) >= parseInt(constraint.value)) {
                return true;
              }
            }
          }
          return false;
        case "<":
          for (const key in node_attributes) {
            if (Array.isArray(node_attributes[key])) {
              for (let index = 0; index < node_attributes[key].length; index++) {
                const element = node_attributes[key][index];
                if (parseInt(element) > parseInt(constraint.value)) {
                  return true;
                }
              }
            } else {
              if (parseInt(node_attributes[key]) < parseInt(constraint.value)) {
                return true;
              }
            }
          }
          return false;
        case "<=":
          for (const key in node_attributes) {
            if (Array.isArray(node_attributes[key])) {
              for (let index = 0; index < node_attributes[key].length; index++) {
                const element = node_attributes[key][index];
                if (parseInt(element) <= parseInt(constraint.value)) {
                  return true;
                }
              }
            } else {
              if (parseInt(node_attributes[key]) <= parseInt(constraint.value)) {
                return true;
              }
            }
          }
          return false;
        default:
          debug(`Node operator not handled ${constraint.operator}`);
          return false;
      };
    }
  }

  storeRecords(records) {
    debug(`(6) Storing records...`);
    //store new records in current edge
    this.records = records;
    //will update records if any constraints are found
    this.applyNodeConstraints();
    debug(`(7) Updating nodes based on edge records...`);
    this.updateNodesCuries(records);
  }

  getID() {
    return this.qEdge.getID();
  }

  getHashedEdgeRepresentation() {
    const toBeHashed =
      this.getSubject().getCategories() + this.getPredicate() + this.getObject().getCategories() + this.getInputCurie();
    return helper._generateHash(toBeHashed);
  }

  expandPredicates(predicates) {
    const reducer = (acc, cur) => [...acc, ...biolink.getDescendantPredicates(cur)];
    return Array.from(new Set(predicates.reduce(reducer, [])));
  }

  getPredicate() {
    if (this.qEdge.predicate === undefined || this.qEdge.predicate === null) {
      return undefined;
    }
    const predicates = utils.toArray(this.qEdge.predicate).map((item) => utils.removeBioLinkPrefix(item));
    const expandedPredicates = this.expandPredicates(predicates);
    debug(`Expanded edges: ${expandedPredicates}`);
    return expandedPredicates
      .map((predicate) => {
        return this.isReversed() === true ? biolink.reverse(predicate) : predicate;
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

  getReversedPredicate(predicate) {
    return predicate ? biolink.reverse(predicate) : undefined;
  }
};
