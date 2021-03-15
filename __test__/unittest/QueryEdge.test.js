const qEdge = require("../../src/query_edge");


describe("Test QEdge class", () => {
    describe("Test getPredicate function", () => {

        test("Non reversed edge should return predicates itself", () => {
            const edge = new qEdge('e01', {
                predicate: 'biolink:treats',
                object: {
                    getCurie() {
                        return undefined;
                    }
                },
                subject: {
                    getCurie() {
                        return 'uye'
                    }
                }
            })
            const res = edge.getPredicate();
            expect(res).toEqual(['treats']);
        })

        test("Undefined predicate should return itself", () => {
            const edge = new qEdge('e01', {
            })
            const res = edge.getPredicate();
            expect(res).toBeUndefined;
        })

        test("An array of non-undefined predicates should return itself", () => {
            const edge = new qEdge('e01', {
                predicate: ['biolink:treats', 'biolink:targets'],
                object: {
                    getCurie() {
                        return undefined
                    }
                },
                subject: {
                    getCurie() {
                        return 'yes';
                    }
                }
            })
            const res = edge.getPredicate();
            expect(res).toEqual(['treats', 'targets']);
        })

        test("An array of non-undefined predicates with reverse edge should exclude return value if undefined", () => {

            const edge = new qEdge('e01', {
                predicate: ['biolink:treats', 'biolink:targets'],
                object: {
                    getCurie() {
                        return 'yes'
                    }
                },
                subject: {
                    getCurie() {
                        return undefined;
                    }
                }
            })
            const res = edge.getPredicate();
            expect(res).toEqual(['treated_by']);
        })

        test("An array of non-undefined predicates with reverse edge should return reversed predicates if not undefined", () => {
            const edge = new qEdge('e01', {
                predicate: ['biolink:treats', 'biolink:targets'],
                object: {
                    getCurie() {
                        return 'yes'
                    }
                },
                subject: {
                    getCurie() {
                        return undefined;
                    }
                }
            })
            const res = edge.getPredicate();
            expect(res).toEqual(['treated_by']);
        })
    })
})