const { MongoClient, ObjectId } = require("mongodb");
const { Product } = require("../");

// Best practice: store this in a .env file as process.env.MONGO_URI
const uri = "mongodb+srv://dst-dev:S0rry@dstdatabase.v7nzjfd.mongodb.net/DontStarveTogetherCatalog?retryWrites=true&w=majority";

// Map dropdown values to exact MongoDB collection names
const VALID_COLLECTIONS = {
    Boss: "Boss",           // Change to "Bosses" if your collections are plural
    Character: "Character", // or "Characters"
    Creature: "Creature",   // or "Creatures"
    Item: "Item",           // or "Items"
    Recipe: "Recipe"        // or "Recipes"
};


class app_service {
    async #getCollection(client, category) {
        const db = client.db("DontStarveTogetherCatalog");
        
        // Use the mapped collection name, or fall back to "stuff" if none/invalid
        const collectionName = VALID_COLLECTIONS[category] || "stuff";
        return db.collection(collectionName);
    }

    async addForm(newForm) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            // Pass the selected category from the form to get the right collection
            const coll = await this.#getCollection(client, newForm.category);
            await coll.insertOne(newForm);
        } finally {
            await client.close();
        }
    }

    // Retrieve forms from a specific category, or across ALL categories if none is specified
    async getForms(OldestYear, category) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            let unfilteredForms = [];

            if (category && VALID_COLLECTIONS[category]) {
                // Fetch from a single specific category collection
                const coll = await this.#getCollection(client, category);
                unfilteredForms = await coll.find().toArray();
            } else {
                // Fetch from all category collections and combine them
                const db = client.db("DontStarveTogetherCatalog");
                for (const collName of Object.values(VALID_COLLECTIONS)) {
                    const items = await db.collection(collName).find().toArray();
                    unfilteredForms.push(...items);
                }
            }

            if (OldestYear === undefined) {
                return unfilteredForms;
            } else {
                return unfilteredForms.filter((item) => {
                    return Number(item.year) >= Number(OldestYear);
                });
            }
        } finally {
            await client.close();
        }
    }
}

module.exports = app_service;