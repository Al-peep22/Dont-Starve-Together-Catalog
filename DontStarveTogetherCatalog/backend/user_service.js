const crypto = require("crypto");
const { promisify } = require("util");
const { MongoClient } = require("mongodb");

const scrypt = promisify(crypto.scrypt);
const uri = process.env.MONGO_URI;
const databaseName = process.env.MONGO_DATABASE || "dst_catalog";
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;
const dummySalt = Buffer.alloc(16);
const dummyHash = Buffer.alloc(64);

if (!uri) {
    throw new Error("MONGO_URI must be configured before using account services.");
}

class UserService {
    async #withDatabase(callback) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            return await callback(client.db(databaseName));
        } finally {
            await client.close();
        }
    }

    async ensureIndexes() {
        return this.#withDatabase(async database => {
            await Promise.all([
                database.collection("catalog_accounts").createIndex({ username: 1 }, { unique: true }),
                database.collection("catalog_accounts").createIndex({ email: 1 }, { unique: true }),
                database.collection("sessions").createIndex({ tokenHash: 1 }, { unique: true }),
                database.collection("sessions").createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
            ]);
        });
    }

    async register({ username, email, password }) {
        const salt = crypto.randomBytes(16);
        const passwordHash = await scrypt(password, salt, 64);
        const user = {
            username,
            email,
            passwordSalt: salt.toString("hex"),
            passwordHash: passwordHash.toString("hex"),
            createdAt: new Date(),
            favorites: []
        };

        return this.#withDatabase(async database => {
            const result = await database.collection("catalog_accounts").insertOne(user);
            return { _id: result.insertedId, username: user.username, email: user.email };
        });
    }

    async authenticate(identifier, password) {
        return this.#withDatabase(async database => {
            const user = await database.collection("catalog_accounts").findOne({
                $or: [{ username: identifier }, { email: identifier }]
            });
            const salt = user ? Buffer.from(user.passwordSalt, "hex") : dummySalt;
            const storedHash = user ? Buffer.from(user.passwordHash, "hex") : dummyHash;
            const submittedHash = await scrypt(password, salt, 64);
            if (
                !user ||
                submittedHash.length !== storedHash.length ||
                !crypto.timingSafeEqual(submittedHash, storedHash)
            ) {
                return null;
            }
            return { _id: user._id, username: user.username, email: user.email };
        });
    }

    async createSession(userId) {
        const token = crypto.randomBytes(32).toString("hex");
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        const createdAt = new Date();
        await this.#withDatabase(database => database.collection("sessions").insertOne({
            userId,
            tokenHash,
            createdAt,
            expiresAt: new Date(createdAt.getTime() + sessionLifetimeMs)
        }));
        return token;
    }

    async getSession(token) {
        if (!token) {
            return null;
        }
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        return this.#withDatabase(async database => {
            const session = await database.collection("sessions").findOne({
                tokenHash,
                expiresAt: { $gt: new Date() }
            });
            if (!session) {
                return null;
            }
            return database.collection("catalog_accounts").findOne(
                { _id: session.userId },
                { projection: { username: 1, email: 1, favorites: 1 } }
            );
        });
    }

    async deleteSession(token) {
        if (!token) {
            return;
        }
        const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
        await this.#withDatabase(database => database.collection("sessions").deleteOne({ tokenHash }));
    }

    async addFavorite(userId, favorite) {
        await this.#withDatabase(database => database.collection("catalog_accounts").updateOne(
            {
                _id: userId,
                favorites: { $not: { $elemMatch: { category: favorite.category, id: favorite.id } } }
            },
            { $push: { favorites: favorite } }
        ));
    }

    async removeFavorite(userId, category, id) {
        await this.#withDatabase(database => database.collection("catalog_accounts").updateOne(
            { _id: userId },
            { $pull: { favorites: { category, id } } }
        ));
    }

    async getFavorites(userId) {
        return this.#withDatabase(async database => {
            const user = await database.collection("catalog_accounts").findOne(
                { _id: userId },
                { projection: { favorites: 1 } }
            );
            if (!user) {
                throw new Error("Account no longer exists.");
            }
            return user.favorites || [];
        });
    }
}

module.exports = UserService;
