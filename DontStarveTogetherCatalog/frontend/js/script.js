function showCatalogMessage(container, message) {
    const text = document.createElement("p");
    text.textContent = message;
    container.replaceChildren(text);
}

function addCatalogImage(container, item) {
    if (typeof item.image !== "string" || !item.image) {
        return;
    }

    const imagePath = item.image.replace(/\\/g, "/");
    const isRemoteImage = imagePath.startsWith("http://") || imagePath.startsWith("https://");
    const isServedImage = imagePath.startsWith("/") ||
        imagePath.startsWith("images/") ||
        imagePath.startsWith("uploads/");
    if (!isRemoteImage && !isServedImage) {
        return;
    }

    const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
    const image = document.createElement("img");
    image.alt = typeof item.name === "string" ? item.name : "Catalog item";
    image.loading = "lazy";
    image.src = isRemoteImage || imagePath.startsWith("/") ? imagePath : `/${encodedPath}`;
    image.addEventListener("error", () => image.remove(), { once: true });
    container.appendChild(image);
}

function formatCatalogLabel(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, character => character.toUpperCase());
}

async function loadCatalog() {
    const container = document.getElementById("catalog-container");
    try {
        const response = await fetch("/api/forms");
        if (!response.ok) {
            throw new Error(`Catalog request failed with status ${response.status}`);
        }
        const items = await response.json();

        if (items.length === 0) {
            showCatalogMessage(container, "No entries in the MongoDB catalog yet.");
            return;
        }

        items.sort((left, right) => {
            const categoryOrder = String(left.catalogCategory || "")
                .localeCompare(String(right.catalogCategory || ""));
            return categoryOrder || String(left.name || "").localeCompare(String(right.name || ""));
        });
        container.replaceChildren();
        for (const item of items) {
            const card = document.createElement("article");
            card.className = "catalog-card";
            addCatalogImage(card, item);

            const title = document.createElement("h3");
            title.textContent = typeof item.name === "string" ? item.name : "Untitled";
            card.appendChild(title);

            const category = document.createElement("p");
            category.textContent = `Catalog group: ${String(item.catalogCategory || "Unknown")}`;
            card.appendChild(category);

            const fields = document.createElement("dl");
            fields.className = "record-details";
            for (const [key, value] of Object.entries(item)) {
                if (key === "_id" || key === "name" || key === "catalogCategory" || value == null) {
                    continue;
                }

                const label = document.createElement("dt");
                label.textContent = formatCatalogLabel(key);

                const detail = document.createElement("dd");
                detail.textContent = typeof value === "object"
                    ? JSON.stringify(value, null, 2)
                    : String(value);
                fields.append(label, detail);
            }
            card.appendChild(fields);
            container.appendChild(card);
        }
    } catch (err) {
        console.error("Failed to load items:", err);
        showCatalogMessage(container, "Unable to load the MongoDB catalog right now.");
    }
}

loadCatalog();