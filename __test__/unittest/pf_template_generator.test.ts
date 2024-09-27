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
            "biolink:affects",
            "biolink:interacts_with",
            "biolink:occurs_together_in_literature_with"
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
            "biolink:Cell"
          ]
        }
      },
      "edges": {
        "sub_un": {
          "subject": "creativeQuerySubject",
          "object": "un",
          "predicates": [
            "biolink:affects",
            "biolink:interacts_with",
            "biolink:occurs_together_in_literature_with"
          ]
        },
        "un_b": {
          "subject": "un",
          "object": "nb",
          "predicates": [
            "biolink:affects",
            "biolink:produced_by",
            "biolink:located_in",
            "biolink:part_of",
            "biolink:interacts_with"
          ]
        },
        "b_obj": {
          "subject": "nb",
          "object": "creativeQueryObject",
          "predicates": [
            "biolink:location_of",
            "biolink:affected_by",
            "biolink:interacts_with"
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
            "biolink:affects",
            "biolink:interacts_with",
            "biolink:occurs_together_in_literature_with"
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
            "biolink:interacts_with",
            "biolink:occurs_together_in_literature_with"
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
