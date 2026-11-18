// routes/index.js (Backend - runs in Node.js)
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const router = express.Router();
const AppService = require("../app_service");

const service = new AppService();
const validCategories = new Set(["Boss", "Character", "Creature", "Item", "Recipe", "World", "Event"]);
const formCategories = new Set(["Boss", "Character", "Creature", "Item", "Recipe"]);
const uploadDirectory = path.join(__dirname, "..", "..", "frontend", "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDirectory);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, "_");
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});

const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (!["image/jpeg", "image/png", "image/gif", "image/webp"].includes(file.mimetype)) {
            return cb(new Error("Only image files are allowed."));
        }
        cb(null, true);
    }
});

router.post("/create-form", upload.single("image"), async (req, res) => {
    try {
        const name = typeof req.body.name === "string" ? req.body.name.trim() : "";
        const category = req.body.category;
        if (!name || name.length > 120 || !formCategories.has(category)) {
            return res.status(400).send("A name and valid category are required.");
        }

        const newForm = {
            name,
            category,
            image: req.file ? req.file.filename : null
        };

        for (const field of ["hunger", "sanity", "health", "durability"]) {
            if (req.body[field] !== undefined && req.body[field] !== "") {
                const value = Number(req.body[field]);
                if (!Number.isFinite(value)) {
                    return res.status(400).send(`${field} must be a number.`);
                }
                newForm[field] = value;
            }
        }

        await service.addForm(newForm);
        res.redirect("/");
    } catch (err) {
        console.error("Error saving form:", err);
        res.status(500).send("Failed to create product.");
    }
});

router.get("/api/forms", async (req, res) => {
    try {
        const category = req.query.category;
        if (category !== undefined && (typeof category !== "string" || !validCategories.has(category))) {
            return res.status(400).json({ error: "Invalid category." });
        }

        const items = await service.getForms(category);
        res.json(items);
    } catch (err) {
        console.error("Error loading forms:", err);
        res.status(500).json({ error: "Failed to load catalog." });
    }
});

module.exports = router;