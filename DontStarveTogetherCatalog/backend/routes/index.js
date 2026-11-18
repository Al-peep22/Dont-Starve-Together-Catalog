// routes/index.js (Backend - runs in Node.js)
const express = require("express");
const path = require("path");
const fs = require("fs");
const multer = require("multer");
const { rateLimit } = require("express-rate-limit");
const router = express.Router();
const AppService = require("../app_service");
const UserService = require("../user_service");

const service = new AppService();
const userService = new UserService();
const validCategories = new Set(["Boss", "Character", "Creature", "Item", "Recipe", "World", "Event"]);
const formCategories = new Set(["Boss", "Character", "Creature", "Item", "Recipe"]);
// Match the detail URL mapping in frontend/js/catalog.js when changing routes.
const detailPages = {
    Boss: "/pages/Bosses/individual_boss.html",
    Character: "/pages/Characters/individual_character.html",
    Creature: "/pages/Creatures/individual_creatures.html",
    Item: "/pages/Items/individual_item.html",
    Recipe: "/pages/Recipes/individual_recipe.html",
    World: "/pages/World/individual_world.html",
    Event: "/pages/World/individual_event.html"
};
let indexesPromise;
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

function ensureUserIndexes() {
    if (!indexesPromise) {
        indexesPromise = userService.ensureIndexes().catch(error => {
            indexesPromise = null;
            throw error;
        });
    }
    return indexesPromise;
}

function getCookie(req, name) {
    const cookieHeader = req.get("cookie") || "";
    const entry = cookieHeader.split(";").map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith(`${name}=`));
    const token = entry ? entry.slice(name.length + 1) : null;
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
}

function setSessionCookie(req, res, token) {
    res.cookie("catalog_session", token, {
        httpOnly: true,
        secure: Boolean(process.env.RENDER) || req.secure,
        sameSite: "lax",
        path: "/",
        maxAge: 30 * 24 * 60 * 60 * 1000
    });
}

async function loadOptionalUser(req, res, next) {
    try {
        req.catalogSessionToken = getCookie(req, "catalog_session");
        req.catalogUser = req.catalogSessionToken
            ? await userService.getSession(req.catalogSessionToken)
            : null;
        next();
    } catch (error) {
        next(error);
    }
}

const accountRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many account requests. Try again later." }
});

function requireSameOriginJson(req, res, next) {
    res.set("Cache-Control", "no-store");
    if (req.method === "GET") {
        return next();
    }
    const origin = req.get("origin");
    const expectedOrigin = `${req.protocol}://${req.get("host")}`;
    if (
        req.get("X-Requested-With") !== "XMLHttpRequest" ||
        !req.is("application/json") ||
        (origin && origin !== expectedOrigin)
    ) {
        return res.status(403).json({ error: "Invalid request origin or content type." });
    }
    next();
}

router.use("/api/auth", requireSameOriginJson);
router.use("/api/favorites", requireSameOriginJson);

function requireUser(req, res, next) {
    if (!req.catalogUser) {
        return res.status(401).json({ error: "Sign in to manage favorites." });
    }
    next();
}

function validateAccountInput(username, email, password) {
    return typeof username === "string" &&
        /^[a-zA-Z0-9_]{3,32}$/.test(username) &&
        typeof email === "string" &&
        email.length <= 254 &&
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) &&
        typeof password === "string" &&
        password.length >= 12 &&
        password.length <= 256;
}

router.get("/api/lore/:pageNumber", async (req, res) => {
    const pageNumber = Number(req.params.pageNumber);
    if (!/^(0|[1-9]\d*)$/.test(req.params.pageNumber) || !Number.isSafeInteger(pageNumber)) {
        return res.status(400).json({ error: "Page number must be a non-negative integer." });
    }

    try {
        const result = await service.getLorePage(pageNumber);
        if (pageNumber !== 0 && !result.page) {
            return res.status(404).json({ error: "That lore page was not found." });
        }
        res.json(result);
    } catch (error) {
        console.error("Error loading lore page:", error);
        res.status(500).json({ error: "Failed to load lore page." });
    }
});

router.post("/api/auth/register", accountRateLimit, async (req, res) => {
    const body = req.body || {};
    const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = body.password;
    if (!validateAccountInput(username, email, password)) {
        return res.status(400).json({
            error: "Use a 3-32 character username, a valid email address, and a password of at least 12 characters."
        });
    }

    try {
        await ensureUserIndexes();
        const user = await userService.register({ username, email, password });
        const token = await userService.createSession(user._id);
        setSessionCookie(req, res, token);
        res.status(201).json({ user: { username: user.username, email: user.email } });
    } catch (error) {
        if (error.code === 11000) {
            return res.status(409).json({ error: "That username or email address is already registered." });
        }
        console.error("Error registering account:", error);
        res.status(500).json({ error: "Failed to create account." });
    }
});

router.post("/api/auth/login", accountRateLimit, async (req, res) => {
    const body = req.body || {};
    const identifier = typeof body.identifier === "string" ? body.identifier.trim().toLowerCase() : "";
    const password = body.password;
    if (!identifier || identifier.length > 254 || typeof password !== "string" || password.length > 256) {
        return res.status(400).json({ error: "Enter a valid username or email and password." });
    }

    try {
        await ensureUserIndexes();
        const user = await userService.authenticate(identifier, password);
        if (!user) {
            return res.status(401).json({ error: "The username/email or password is incorrect." });
        }
        const token = await userService.createSession(user._id);
        setSessionCookie(req, res, token);
        res.json({ user: { username: user.username, email: user.email } });
    } catch (error) {
        console.error("Error signing in:", error);
        res.status(500).json({ error: "Failed to sign in." });
    }
});

router.post("/api/auth/logout", loadOptionalUser, async (req, res, next) => {
    try {
        await userService.deleteSession(req.catalogSessionToken);
        res.clearCookie("catalog_session", {
            httpOnly: true,
            secure: Boolean(process.env.RENDER) || req.secure,
            sameSite: "lax",
            path: "/"
        });
        res.status(204).end();
    } catch (error) {
        next(error);
    }
});

router.get("/api/auth/me", loadOptionalUser, (req, res) => {
    if (!req.catalogUser) {
        return res.json({ user: null });
    }
    res.json({
        user: {
            username: req.catalogUser.username,
            email: req.catalogUser.email
        }
    });
});

router.get("/api/favorites", loadOptionalUser, requireUser, async (req, res, next) => {
    try {
        res.json(await userService.getFavorites(req.catalogUser._id));
    } catch (error) {
        next(error);
    }
});

router.post("/api/favorites", loadOptionalUser, requireUser, async (req, res, next) => {
    const { category, id, name } = req.body || {};
    if (
        (category !== "Lore" && !Object.hasOwn(detailPages, category)) ||
        typeof id !== "string" ||
        !id ||
        id.length > 200 ||
        typeof name !== "string" ||
        !name.trim() ||
        name.length > 200
    ) {
        return res.status(400).json({ error: "A valid content category, id, and name are required." });
    }

    let url;
    if (category === "Lore") {
        const pageNumber = Number(id);
        if (!/^(0|[1-9]\d*)$/.test(id) || !Number.isSafeInteger(pageNumber)) {
            return res.status(400).json({ error: "Lore favorite id must be a page number." });
        }
        url = `/pages/lore.html?page=${pageNumber}`;
    } else {
        url = `${detailPages[category]}?id=${encodeURIComponent(id)}`;
    }

    try {
        await userService.addFavorite(req.catalogUser._id, {
            category,
            id,
            name: name.trim(),
            url,
            createdAt: new Date()
        });
        res.json(await userService.getFavorites(req.catalogUser._id));
    } catch (error) {
        next(error);
    }
});

router.delete("/api/favorites", loadOptionalUser, requireUser, async (req, res, next) => {
    const { category, id } = req.body || {};
    if (
        (category !== "Lore" && !Object.hasOwn(detailPages, category)) ||
        typeof id !== "string" ||
        !id ||
        id.length > 200
    ) {
        return res.status(400).json({ error: "A valid content category and id are required." });
    }

    try {
        await userService.removeFavorite(req.catalogUser._id, category, id);
        res.json(await userService.getFavorites(req.catalogUser._id));
    } catch (error) {
        next(error);
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
            image: req.file ? `uploads/${req.file.filename}` : null
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