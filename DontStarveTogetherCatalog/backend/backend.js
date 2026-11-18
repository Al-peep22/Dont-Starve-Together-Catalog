const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const express = require("express");
const multer = require("multer");

if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI must be configured before starting the server.");
}

const app = express();
if (process.env.RENDER) {
    app.set("trust proxy", 1);
}
const projectDirectory = path.join(__dirname, "..");
const frontendDirectory = path.join(projectDirectory, "frontend");
const htmlDirectory = path.join(frontendDirectory, "html");
const uploadDirectory = path.join(frontendDirectory, "uploads");

fs.mkdirSync(uploadDirectory, { recursive: true });

app.use(express.urlencoded({ extended: true }));
app.use(express.json({ limit: "1mb" }));
app.use("/css", express.static(path.join(frontendDirectory, "css")));
app.use("/font", express.static(path.join(frontendDirectory, "font")));
app.use("/images", express.static(path.join(frontendDirectory, "images")));
app.use("/js", express.static(path.join(frontendDirectory, "js")));
app.use("/uploads", express.static(uploadDirectory));

function requireAdmin(req, res, next) {
    const expectedToken = process.env.ADMIN_TOKEN;
    if (!expectedToken) {
        return res.status(404).send("Not found.");
    }

    const authorization = req.get("authorization") || "";
    const match = authorization.match(/^Basic\s+(.+)$/i);
    if (match) {
        const credentials = Buffer.from(match[1], "base64").toString("utf8");
        const separator = credentials.indexOf(":");
        const username = separator >= 0 ? credentials.slice(0, separator) : "";
        const submittedToken = Buffer.from(separator >= 0 ? credentials.slice(separator + 1) : "");
        const expected = Buffer.from(expectedToken);
        if (
            username === "admin" &&
            submittedToken.length === expected.length &&
            crypto.timingSafeEqual(submittedToken, expected)
        ) {
            return next();
        }
    }

    res.set("WWW-Authenticate", 'Basic realm="Catalog admin", charset="UTF-8"');
    return res.status(401).send("Administrator authentication required.");
}

app.get("/healthz", (req, res) => {
    res.status(200).json({ status: "ok" });
});

app.get("/", (req, res) => {
    res.sendFile(path.join(frontendDirectory, "html", "index.html"));
});

app.get("/add", requireAdmin, (req, res) => {
    res.sendFile(path.join(htmlDirectory, "add_form.html"));
});

app.get("/pages/add_form.html", requireAdmin, (req, res) => {
    res.sendFile(path.join(htmlDirectory, "add_form.html"));
});

// /pages mirrors frontend/html; the protected add form is handled above first.
app.use("/pages", express.static(htmlDirectory, { index: false }));
app.use("/create-form", requireAdmin);
app.use("/", require("./routes"));

app.use((err, req, res, next) => {
    if (err instanceof multer.MulterError) {
        const status = err.code === "LIMIT_FILE_SIZE" ? 413 : 400;
        return res.status(status).json({ error: err.message });
    }

    if (err.message === "Only image files are allowed.") {
        return res.status(400).json({ error: err.message });
    }

    console.error(err);
    return res.status(500).json({ error: "Internal server error." });
});

const port = Number(process.env.PORT) || 3000;
app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
});