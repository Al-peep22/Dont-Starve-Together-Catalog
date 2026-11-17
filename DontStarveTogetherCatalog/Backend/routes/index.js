// routes/index.js (Backend - runs in Node.js)
const express = require("express");
const path = require("path");
const multer = require("multer");
const router = express.Router();
const AppService = require("../services/app_service");

const service = new AppService();

// Use diskStorage so Multer keeps the original .png / .jpg extension
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, "public/uploads/");
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname); // e.g., '.png'
        const baseName = path.basename(file.originalname, ext).replace(/\s+/g, "_");
        cb(null, `${Date.now()}-${baseName}${ext}`);
    }
});

const upload = multer({ storage });

// POST: Save form and redirect back home
router.post("/create-form", upload.single("image"), async (req, res) => {
    try {
        const newForm = {
            ...req.body,
            // Saves as "1731865000-meatballs.png"
            image: req.file ? req.file.filename : undefined
        };

        await service.addForm(newForm);
        res.redirect("/");
    } catch (err) {
        console.error("Error saving form:", err);
        res.status(500).send("Failed to create product.");
    }
});

// GET: Send catalog data as JSON to the frontend
router.get("/api/forms", async (req, res) => {
    try {
        const items = await service.getForms(req.query.category);
        res.json(items);
    } catch (err) {
        console.error("Error loading forms:", err);
        res.status(500).json({ error: "Failed to load catalog." });
    }
});

module.exports = router;