const detailPages = {
    Boss: "/pages/Bosses/individual_boss.html",
    Character: "/pages/Characters/individual_character.html",
    Creature: "/pages/Creatures/individual_creatures.html",
    Item: "/pages/Items/individual_item.html",
    Recipe: "/pages/Recipes/individual_recipe.html",
    World: "/pages/World/individual_world.html",
    Event: "/pages/World/individual_event.html"
};

function showMessage(container, message) {
    container.replaceChildren();
    const text = document.createElement("p");
    text.textContent = message;
    container.appendChild(text);
}

function addImage(container, item) {
    if (typeof item.image !== "string" || !item.image) {
        return;
    }

    const imagePath = item.image.replace(/\\/g, "/");
    const encodedPath = imagePath.split("/").map(encodeURIComponent).join("/");
    const image = document.createElement("img");
    image.alt = item.name || "Catalog entry";
    image.src = imagePath.startsWith("/") || /^https?:\/\//i.test(imagePath)
        ? imagePath
        : imagePath.startsWith("images/") || imagePath.startsWith("uploads/")
            ? `/${encodedPath}`
            : `/uploads/${encodeURIComponent(imagePath)}`;
    image.addEventListener("error", () => {
        if (!image.dataset.fallback) {
            image.dataset.fallback = "true";
            image.src = `/images/${encodedPath}`;
        } else {
            image.remove();
        }
    });
    container.appendChild(image);
}

async function getCategoryItems(category) {
    const response = await fetch(`/api/forms?category=${encodeURIComponent(category)}`);
    if (!response.ok) {
        throw new Error(`Catalog request failed with status ${response.status}`);
    }
    return response.json();
}

async function loadListPage(page) {
    const list = page.querySelector("[data-record-list]");
    const categories = page.dataset.categories.split(",").map(category => category.trim());

    try {
        const groups = await Promise.all(categories.map(async category => ({
            category,
            items: await getCategoryItems(category)
        })));
        const items = groups.flatMap(group => group.items.map(item => ({
            ...item,
            category: group.category
        })));

        if (items.length === 0) {
            showMessage(list, "No entries in this group yet.");
            return;
        }

        items.sort((left, right) => String(left.name || "").localeCompare(String(right.name || "")));
        list.replaceChildren();

        for (const item of items) {
            const detailPage = detailPages[item.category];
            if (!detailPage || item._id === undefined || item._id === null) {
                continue;
            }

            const card = document.createElement("a");
            card.className = "record-card";
            card.href = `${detailPage}?id=${encodeURIComponent(String(item._id))}`;
            addImage(card, item);

            const title = document.createElement("h2");
            title.textContent = typeof item.name === "string" ? item.name : "Untitled";
            card.appendChild(title);

            if (typeof item.description === "string" && item.description) {
                const description = document.createElement("p");
                description.textContent = item.description;
                card.appendChild(description);
            }

            list.appendChild(card);
        }

        if (!list.childElementCount) {
            showMessage(list, "No entries in this group yet.");
        }
    } catch (error) {
        console.error("Failed to load group:", error);
        showMessage(list, "Unable to load this group right now.");
    }
}

function formatLabel(key) {
    return key.replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/^./, character => character.toUpperCase());
}

async function loadDetailPage(page) {
    const detail = page.querySelector("[data-record-detail]");
    const category = page.dataset.category;
    const id = new URLSearchParams(window.location.search).get("id");

    if (!id) {
        showMessage(detail, "Choose an entry from its group page to view its details.");
        return;
    }

    try {
        const items = await getCategoryItems(category);
        const item = items.find(entry => String(entry._id) === id);
        if (!item) {
            showMessage(detail, "This entry could not be found.");
            return;
        }

        detail.replaceChildren();
        addImage(detail, item);

        const fields = document.createElement("dl");
        fields.className = "record-details";
        for (const [key, value] of Object.entries(item)) {
            if (key === "_id" || key === "image" || key === "name" || key === "category" || value == null) {
                continue;
            }

            const term = document.createElement("dt");
            term.textContent = formatLabel(key);
            const description = document.createElement("dd");
            description.textContent = typeof value === "object"
                ? JSON.stringify(value, null, 2)
                : String(value);
            fields.append(term, description);
        }

        const title = page.querySelector("[data-record-title]");
        title.textContent = typeof item.name === "string" ? item.name : "Untitled";
        document.title = `${title.textContent} | Don't Starve Together Catalog`;
        detail.appendChild(fields);
    } catch (error) {
        console.error("Failed to load entry:", error);
        showMessage(detail, "Unable to load this entry right now.");
    }
}

const catalogPage = document.querySelector("[data-catalog-page]");
if (catalogPage?.dataset.catalogPage === "list") {
    loadListPage(catalogPage);
} else if (catalogPage?.dataset.catalogPage === "detail") {
    loadDetailPage(catalogPage);
}
