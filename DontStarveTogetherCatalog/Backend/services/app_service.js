const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
if (!uri) {
    throw new Error("MONGO_URI must be configured before using the catalog service.");
}

const VALID_COLLECTIONS = {
    Boss: "Boss",
    Character: "Character",
    Creature: "Creature",
    Item: "Item",
    Recipe: "Recipe"
};

class AppService {
    async #getCollection(client, category) {
        const collectionName = VALID_COLLECTIONS[category];
        if (!collectionName) {
            throw new Error("Invalid catalog category.");
        }
        return client.db("DontStarveTogetherCatalog").collection(collectionName);
    }

    async addForm(newForm) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const collection = await this.#getCollection(client, newForm.category);
            await collection.insertOne(newForm);
        } finally {
            await client.close();
        }
    }

    async getForms(category) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const database = client.db("DontStarveTogetherCatalog");

            if (category) {
                const collection = await this.#getCollection(client, category);
                return await collection.find().toArray();
            }

            const documents = [];
            for (const collectionName of Object.values(VALID_COLLECTIONS)) {
                const items = await database.collection(collectionName).find().toArray();
                documents.push(...items);
            }
            return documents;
        } finally {
            await client.close();
        }
    }
}

module.exports = AppService;
