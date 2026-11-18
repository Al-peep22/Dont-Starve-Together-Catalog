const test = require("node:test");
const assert = require("node:assert/strict");
const { MongoClient } = require("mongodb");

process.env.MONGO_URI = "mongodb://127.0.0.1:27017";
const UserService = require("../DontStarveTogetherCatalog/backend/user_service");

test("accounts authenticate and keep separate, removable favorites", async t => {
    const accounts = [];
    const sessions = [];
    const collections = {
        catalog_accounts: {
            async insertOne(user) {
                user._id = `user-${accounts.length}`;
                accounts.push(user);
                return { insertedId: user._id };
            },
            async findOne(query) {
                if (query.$or) {
                    return accounts.find(user => query.$or.some(condition =>
                        Object.entries(condition).every(([key, value]) => user[key] === value)
                    )) || null;
                }
                return accounts.find(user => user._id === query._id) || null;
            },
            async updateOne(query, update) {
                const user = accounts.find(account => account._id === query._id);
                if (update.$push) {
                    const favorite = update.$push.favorites;
                    if (!user.favorites.some(item => item.category === favorite.category && item.id === favorite.id)) {
                        user.favorites.push(favorite);
                    }
                } else {
                    const { category, id } = update.$pull.favorites;
                    user.favorites = user.favorites.filter(item => item.category !== category || item.id !== id);
                }
            }
        },
        sessions: {
            async insertOne(session) {
                sessions.push(session);
            },
            async findOne(query) {
                return sessions.find(session =>
                    session.tokenHash === query.tokenHash && session.expiresAt > query.expiresAt.$gt
                ) || null;
            },
            async deleteOne(query) {
                const index = sessions.findIndex(session => session.tokenHash === query.tokenHash);
                if (index >= 0) sessions.splice(index, 1);
            }
        }
    };
    t.mock.method(MongoClient.prototype, "connect", async function () { return this; });
    t.mock.method(MongoClient.prototype, "db", () => ({
        collection(name) { return collections[name]; }
    }));
    t.mock.method(MongoClient.prototype, "close", async () => {});

    const service = new UserService();
    const password = "a long test password";
    const first = await service.register({ username: "first", email: "first@example.test", password });
    const second = await service.register({ username: "second", email: "second@example.test", password });
    assert.notEqual(accounts[0].passwordHash, password);
    assert.notEqual(accounts[0].passwordHash, accounts[1].passwordHash);
    assert.equal((await service.authenticate("first", password)).username, "first");
    assert.equal(await service.authenticate("first", "wrong password"), null);
    assert.equal(await service.authenticate("missing", password), null);

    const token = await service.createSession(first._id);
    assert.notEqual(sessions[0].tokenHash, token);
    assert.equal((await service.getSession(token)).username, "first");

    const favorite = { category: "Lore", id: "2", name: "Story", url: "/pages/lore.html?page=2" };
    await service.addFavorite(first._id, favorite);
    await service.addFavorite(first._id, favorite);
    assert.equal((await service.getFavorites(first._id)).length, 1);
    assert.deepEqual(await service.getFavorites(second._id), []);
    await service.removeFavorite(first._id, "Lore", "2");
    assert.deepEqual(await service.getFavorites(first._id), []);

    await service.deleteSession(token);
    assert.equal(await service.getSession(token), null);
});
