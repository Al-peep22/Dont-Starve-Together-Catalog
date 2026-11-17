const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const AppService = require('./app_service');

const app = express();
const service = new AppService();

// Ensure 'public/uploads' exists so Multer doesn't throw an error
const uploadDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure Multer storage
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const safeName = file.originalname.replace(/\s+/g, '_');
        cb(null, `${Date.now()}-${safeName}`);
    }
});
const upload = multer({ storage });

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// POST: Create a new catalog entry from add_form.html
app.post('/create-form', upload.single('image'), async (req, res) => {
    try {
        const newForm = {
            name: req.body.name,
            category: req.body.category,
            // Store relative web path so <img src="..."> works in the browser
            imagePath: req.file ? `/uploads/${req.file.filename}` : null
        };

        // Convert numeric fields from strings to numbers based on category
        if (req.body.hunger !== undefined) newForm.hunger = Number(req.body.hunger);
        if (req.body.sanity !== undefined) newForm.sanity = Number(req.body.sanity);
        if (req.body.health !== undefined) newForm.health = Number(req.body.health);
        if (req.body.durability !== undefined) newForm.durability = Number(req.body.durability);

        await service.addForm(newForm);
        res.redirect('/');
    } catch (err) {
        console.error('Error saving form:', err);
        res.status(500).send('Error saving entry to database.');
    }
});

// GET: Fetch catalog items (supports optional ?category=Boss query parameter)
app.get('/api/forms', async (req, res) => {
    try {
        const category = req.query.category; // e.g., /api/forms?category=Recipe
        const items = await service.getForms(category);
        res.json(items);
    } catch (err) {
        console.error('Error fetching forms:', err);
        res.status(500).json({ error: 'Failed to fetch catalog items.' });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});