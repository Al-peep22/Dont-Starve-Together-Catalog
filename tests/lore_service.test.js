const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient } = require("mongodb");

process.env.MONGO_URI = "mongodb://127.0.0.1:27017";
const AppService = require("../DontStarveTogetherCatalog/backend/app_service");

test("lore pages navigate over gaps and return to the introduction", async t => {
    const pages = [
        { pageNumber: 2, title: "First", paragraphs: ["One"], media: [] },
        { pageNumber: 5, title: "Second", paragraphs: ["Two"], media: [] }
    ];
    const collection = {
        async findOne(query) {
            return pages.find(page => page.pageNumber === query.pageNumber) || null;
        },
        find(query) {
            const range = query.pageNumber;
            let candidates = pages.filter(page =>
                page.pageNumber > range.$gt && (range.$lt === undefined || page.pageNumber < range.$lt)
            );
            return {
                sort(order) {
                    candidates.sort((a, b) => (a.pageNumber - b.pageNumber) * order.pageNumber);
                    return this;
                },
                project() { return this; },
                limit() { return this; },
                async next() { return candidates[0] || null; }
            };
        }
    };
    t.mock.method(MongoClient.prototype, "connect", async function () { return this; });
    t.mock.method(MongoClient.prototype, "db", () => ({
        collection(name) {
            assert.equal(name, "lore");
            return collection;
        }
    }));
    t.mock.method(MongoClient.prototype, "close", async () => {});

    const service = new AppService();
    assert.deepEqual(await service.getLorePage(0), { page: null, previousPage: null, nextPage: 2 });
    const first = await service.getLorePage(2);
    assert.equal(first.page.title, "First");
    assert.equal(first.previousPage, 0);
    assert.equal(first.nextPage, 5);
    const last = await service.getLorePage(5);
    assert.equal(last.previousPage, 2);
    assert.equal(last.nextPage, null);
    assert.equal((await service.getLorePage(3)).page, null);
});
