const TRAPIQueryHandler = require("../../src/index");
const fs = require("fs");
var path = require('path');

describe("Testing TRAPIQueryHandler Module", () => {
    const example_foler = path.resolve(__dirname, '../data');

    test("When looking for chemicals affected by Phenotype Increased Urinary Glycerol, Glycerol should pop up", async () => {
        const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler({}, undefined, undefined, true);
        const query = JSON.parse(fs.readFileSync(path.join(example_foler, 'increased_urinary_glycerol_affects_glycerol.json')));
        queryHandler.setQueryGraph(query.message.query_graph);
        await queryHandler.query();
        const res = queryHandler.getResponse();
        expect(res.message.knowledge_graph.nodes).toHaveProperty('CHEBI:17754');
    })

    test("When looking for genes related to Disease DYSKINESIA, FAMILIAL, WITH FACIAL MYOKYMIA, ACDY5 should pop up", async () => {
        const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler({}, undefined, undefined, true);
        const query = JSON.parse(fs.readFileSync(path.join(example_foler, 'FDFM_caused_by_ACDY5.json')));
        queryHandler.setQueryGraph(query.message.query_graph);
        await queryHandler.query();
        const res = queryHandler.getResponse();
        expect(res.message.knowledge_graph.nodes).toHaveProperty('NCBIGENE:111');
    })

    test("When looking for chemicals targeting IL1 Signaling patway, curcumin should pop up", async () => {
        const queryHandler = new TRAPIQueryHandler.TRAPIQueryHandler({}, undefined, undefined, true);
        const query = JSON.parse(fs.readFileSync(path.join(example_foler, 'chemicals_targeting_IL1_Signaling_Pathway.json')));
        queryHandler.setQueryGraph(query.message.query_graph);
        await queryHandler.query();
        const res = queryHandler.getResponse();
        expect(res.message.knowledge_graph.nodes).toHaveProperty('CHEBI:3962');
    })


})