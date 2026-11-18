const { MongoClient } = require("mongodb");

const uri = process.env.MONGO_URI;
if (!uri) {
    throw new Error("MONGO_URI must be configured before using the catalog service.");
}
const databaseName = process.env.MONGO_DATABASE || "dst_catalog";

const VALID_COLLECTIONS = {
    Boss: "bosses",
    Character: "characters",
    Creature: "creatures",
    Item: "items",
    Recipe: "recipes",
    World: "world",
    Event: "world"
};

function belongsToCategory(item, category) {
    const isEvent = "activeSeasons" in item ||
        "specialItems" in item ||
        "specialRecipes" in item;
    return category === "Event" ? isEvent : category === "World" ? !isEvent : true;
}

class AppService {
    async #getCollection(client, category) {
        const collectionName = VALID_COLLECTIONS[category];
        if (!collectionName) {
            throw new Error("Invalid catalog category.");
        }
        return client.db(databaseName).collection(collectionName);
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
            const database = client.db(databaseName);

            if (category) {
                const collection = await this.#getCollection(client, category);
                const items = await collection.find().toArray();
                return items
                    .filter(item => belongsToCategory(item, category))
                    .map(item => ({ ...item, catalogCategory: category }));
            }

            const documents = [];
            const itemsByCollection = new Map();
            for (const [categoryName, collectionName] of Object.entries(VALID_COLLECTIONS)) {
                if (!itemsByCollection.has(collectionName)) {
                    const items = await database.collection(collectionName).find().toArray();
                    itemsByCollection.set(collectionName, items);
                }
                const items = itemsByCollection.get(collectionName);
                documents.push(...items
                    .filter(item => belongsToCategory(item, categoryName))
                    .map(item => ({ ...item, catalogCategory: categoryName })));
            }
            return documents;
        } finally {
            await client.close();
        }
    }

    async getLorePage(pageNumber) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const collection = client.db(databaseName).collection("lore");
            const projection = { _id: 0, pageNumber: 1, title: 1, paragraphs: 1, media: 1 };
            const [page, previous, next] = await Promise.all([
                pageNumber === 0 ? null : collection.findOne({ pageNumber }, { projection }),
                collection.find({ pageNumber: { $gt: 0, $lt: pageNumber } })
                    .sort({ pageNumber: -1 }).project({ pageNumber: 1 }).limit(1).next(),
                collection.find({ pageNumber: { $gt: pageNumber } })
                    .sort({ pageNumber: 1 }).project({ pageNumber: 1 }).limit(1).next()
            ]);
            return {
                page,
                previousPage: pageNumber === 0 ? null : previous ? previous.pageNumber : 0,
                nextPage: next ? next.pageNumber : null
            };
        } finally {
            await client.close();
        }
    }
}

module.exports = AppService;
