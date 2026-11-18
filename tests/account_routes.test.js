const test = require("node:test");
const assert = require("node:assert/strict");
const express = require("express");

test("account routes require sessions and persist favorites through sign-in", async t => {
    const accounts = new Map();
    const sessions = new Map();
    let sequence = 0;
    class FakeUserService {
        async ensureIndexes() {}
        async register(user) {
            const account = { ...user, _id: user.username, favorites: [] };
            accounts.set(user.username, account);
            return account;
        }
        async authenticate(identifier, password) {
            return [...accounts.values()].find(user =>
                (user.username === identifier || user.email === identifier) && user.password === password
            ) || null;
        }
        async createSession(userId) {
            const token = (++sequence).toString(16).padStart(64, "0");
            sessions.set(token, userId);
            return token;
        }
        async getSession(token) {
            return accounts.get(sessions.get(token)) || null;
        }
        async deleteSession(token) {
            sessions.delete(token);
        }
        async getFavorites(userId) {
            return accounts.get(userId).favorites;
        }
        async addFavorite(userId, favorite) {
            accounts.get(userId).favorites.push(favorite);
        }
        async removeFavorite(userId, category, id) {
            const account = accounts.get(userId);
            account.favorites = account.favorites.filter(item => item.category !== category || item.id !== id);
        }
    }

    const userServicePath = require.resolve("../DontStarveTogetherCatalog/backend/user_service");
    const appServicePath = require.resolve("../DontStarveTogetherCatalog/backend/app_service");
    const routerPath = require.resolve("../DontStarveTogetherCatalog/backend/routes/index");
    require.cache[userServicePath] = { id: userServicePath, filename: userServicePath, loaded: true, exports: FakeUserService };
    require.cache[appServicePath] = { id: appServicePath, filename: appServicePath, loaded: true, exports: class {} };
    t.after(() => {
        delete require.cache[userServicePath];
        delete require.cache[appServicePath];
        delete require.cache[routerPath];
    });

    const app = express();
    app.use(express.json());
    app.use(require(routerPath));
    const server = await new Promise(resolve => {
        const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
    });
    t.after(() => new Promise(resolve => server.close(resolve)));
    const base = `http://127.0.0.1:${server.address().port}`;
    const headers = { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" };
    const post = (url, body, cookie) => fetch(base + url, {
        method: "POST",
        headers: cookie ? { ...headers, Cookie: cookie } : headers,
        body: JSON.stringify(body)
    });

    const anonymous = await post("/api/favorites", { category: "Lore", id: "2", name: "Story" });
    assert.equal(anonymous.status, 401);
    const blocked = await fetch(base + "/api/auth/login", {
        method: "POST",
        headers: { ...headers, Origin: "https://other.example" },
        body: "{}"
    });
    assert.equal(blocked.status, 403);

    const password = "a long test password";
    const registration = await post("/api/auth/register", {
        username: "MixedCase", email: "test@example.test", password
    });
    assert.equal(registration.status, 201);
    const cookie = registration.headers.get("set-cookie").split(";")[0];
    assert.match(registration.headers.get("set-cookie"), /HttpOnly/);
    assert.match(registration.headers.get("set-cookie"), /SameSite=Lax/);
    assert.equal((await registration.json()).user.username, "mixedcase");

    const favoriteResponse = await post("/api/favorites", { category: "Lore", id: "2", name: "Story" }, cookie);
    assert.equal(favoriteResponse.status, 200);
    assert.equal((await favoriteResponse.json())[0].url, "/pages/lore.html?page=2");
    assert.equal((await post("/api/auth/logout", {}, cookie)).status, 204);
    assert.equal((await fetch(base + "/api/favorites", { headers: { Cookie: cookie } })).status, 401);

    const login = await post("/api/auth/login", { identifier: "MIXEDCASE", password });
    assert.equal(login.status, 200);
    const newCookie = login.headers.get("set-cookie").split(";")[0];
    const favorites = await fetch(base + "/api/favorites", { headers: { Cookie: newCookie } });
    assert.equal((await favorites.json())[0].name, "Story");
    const removal = await fetch(base + "/api/favorites", {
        method: "DELETE",
        headers: { ...headers, Cookie: newCookie },
        body: JSON.stringify({ category: "Lore", id: "2" })
    });
    assert.deepEqual(await removal.json(), []);
});
