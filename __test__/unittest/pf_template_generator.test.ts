import generateTemplates from '../../src/inferred_mode/pf_template_generator';

describe('Test Pathfinder Template Generator', () => {
  test('Should generate correct templates', async () => {
    const sub = {
      categories: ['biolink:Drug']
    };
    const un = {
      categories: ['biolink:Gene']
    };
    const obj = {
      categories: ['biolink:Disease']
    };

    const templatesWithUnCat = await generateTemplates(sub, un, obj);
    const templatesWithoutUnCat = await generateTemplates(sub, {}, obj);

    // Template A
    expect(templatesWithUnCat[0]).toEqual({
      "nodes": {
        "creativeQuerySubject": {
          "categories": [
            "biolink:Drug"
          ]
        },
        "creativeQueryObject": {
          "categories": [
            "biolink:Disease"
          ]
        },
        "un": {
          "categories": [
            "biolink:Gene"
          ]
        }
      },
      "edges": {
        "sub_un": {
          "subject": "creativeQuerySubject",
          "object": "un",
          "predicates": [
            "biolink:regulates",
            "biolink:regulated_by",
            "biolink:affects",
            "biolink:affected_by",
            "biolink:interacts_with",
            "biolink:associated_with"
          ]
        },
        "un_obj": {
          "subject": "un",
          "object": "creativeQueryObject",
          "predicates": [
            "biolink:gene_associated_with_condition",
            "biolink:biomarker_for",
            "biolink:affects",
            "biolink:contributes_to"
          ]
        }
      }
    });
    expect(templatesWithoutUnCat[0]).toEqual(templatesWithUnCat[0]);

    // Template B
    expect(templatesWithUnCat[1]).toEqual({
      "nodes": {
        "creativeQuerySubject": {
          "categories": [
            "biolink:Drug"
          ]
        },
        "creativeQueryObject": {
          "categories": [
            "biolink:Disease"
          ]
        },
        "un": {
          "categories": [
            "biolink:Gene"
          ]
        },
        "nb": {
          "categories": [
            "biolink:AnatomicalEntity",
            "biolink:BiologicalProcessOrActivity",
            "biolink:ChemicalEntity"
          ]
        }
      },
      "edges": {
        "sub_un": {
          "subject": "creativeQuerySubject",
          "object": "un",
          "predicates": [
            "biolink:regulates",
            "biolink:regulated_by",
            "biolink:affects",
            "biolink:affected_by",
            "biolink:interacts_with",
            "biolink:associated_with"
          ]
        },
        "un_b": {
          "subject": "un",
          "object": "nb",
          "predicates": [
            "biolink:related_to_at_instance_level",
            "biolink:affects",
            "biolink:contributes_to",
            "biolink:participates_in",
            "biolink:regulates",
            "biolink:regulated_by",
            "biolink:affected_by",
            "biolink:interacts_with",
            "biolink:correlated_with"
          ]
        },
        "b_obj": {
          "subject": "nb",
          "object": "creativeQueryObject",
          "predicates": [
            "biolink:related_to_at_instance_level",
            "biolink:affects",
            "biolink:affected_by",
            "biolink:occurs_in"
          ]
        }
      }
    });
    expect(templatesWithoutUnCat[1]).toEqual(templatesWithUnCat[1]);

    // Template C
    expect(templatesWithUnCat[2]).toEqual({
      "nodes": {
        "creativeQuerySubject": {
          "categories": [
            "biolink:Drug"
          ]
        },
        "creativeQueryObject": {
          "categories": [
            "biolink:Disease"
          ]
        },
        "un": {
          "categories": [
            "biolink:Gene"
          ]
        },
        "nc": {
          "categories": [
            "biolink:Gene"
          ]
        }
      },
      "edges": {
        "sub_c": {
          "subject": "creativeQuerySubject",
          "object": "nc",
          "predicates": [
            "biolink:regulates",
            "biolink:regulated_by",
            "biolink:affects",
            "biolink:affected_by",
            "biolink:interacts_with",
            "biolink:associated_with"
          ]
        },
        "c_un": {
          "subject": "nc",
          "object": "un",
          "predicates": [
            "biolink:regulates",
            "biolink:regulated_by",
            "biolink:affects",
            "biolink:affected_by",
            "biolink:interacts_with"
          ]
        },
        "un_obj": {
          "subject": "un",
          "object": "creativeQueryObject",
          "predicates": [
            "biolink:gene_associated_with_condition",
            "biolink:biomarker_for",
            "biolink:affects",
            "biolink:contributes_to"
          ]
        }
      }
    });
    expect(templatesWithoutUnCat[2]).toEqual(templatesWithUnCat[2]);
  });

  test('template with no predicates should not have predicate property', async () => {
    const sub = {
      categories: ['biolink:Drug']
    };
    const un = {
      categories: ['biolink:Dummy']
    };
    const obj = {
      categories: ['biolink:Drug']
    };

    const templates = await generateTemplates(sub, un, obj);
    expect(templates[0].edges.sub_un).not.toHaveProperty('predicates');
    expect(templates[0].edges.un_obj).not.toHaveProperty('predicates');
  });
});
