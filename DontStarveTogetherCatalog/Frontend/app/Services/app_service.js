const { MongoClient, ObjectId } = require("mongodb");
const { Product } = require("../");


const uri = process.env.MONGO_URI || "mongodb+srv://dst-dev:S0rry@dstdatabase.v7nzjfd.mongodb.net/DontStarveTogetherCatalog?retryWrites=true&w=majority";


const VALID_COLLECTIONS = {
    Boss: "Boss",           
    Character: "Character", 
    Creature: "Creature",  
    Item: "Item",           
    Recipe: "Recipe"       
};


class app_service {
    async #getCollection(client, category) {
        const db = client.db("DontStarveTogetherCatalog");
        
       
        const collectionName = VALID_COLLECTIONS[category] || "stuff";
        return db.collection(collectionName);
    }

    async addForm(newForm) {
        const client = new MongoClient(uri);
        try {
            await client.connect();
            const coll = await this.#getCollection(client, newForm.category);
            await coll.insertOne(newForm);
        } finally {
            await client.close();
        }
    }

   
    async getForms(category) {
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

            return unfilteredForms;
        } finally {
            await client.close();
        }
    }
}

module.exports = app_service;
