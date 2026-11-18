// public/script.js (Frontend - runs in the browser)
const menuShell = document.getElementById("menu-shell");
const menuToggle = document.getElementById("menu-toggle");
const navigationPanel = document.getElementById("site-navigation");

function setMenuOpen(isOpen) {
    menuShell.classList.toggle("is-open", isOpen);
    menuToggle.setAttribute("aria-expanded", String(isOpen));
    menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
}

menuShell.addEventListener("pointerenter", event => {
    if (event.pointerType === "mouse") {
        setMenuOpen(true);
    }
});

menuShell.addEventListener("pointerleave", event => {
    if (event.pointerType === "mouse" && !navigationPanel.contains(document.activeElement)) {
        setMenuOpen(false);
    }
});

menuToggle.addEventListener("click", () => {
    const hoverAvailable = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setMenuOpen(hoverAvailable || menuToggle.getAttribute("aria-expanded") !== "true");
});

document.addEventListener("pointerdown", event => {
    if (!menuShell.contains(event.target)) {
        setMenuOpen(false);
    }
});

document.addEventListener("keydown", event => {
    if (event.key === "Escape" && menuToggle.getAttribute("aria-expanded") === "true") {
        setMenuOpen(false);
        menuToggle.focus();
    }
});

navigationPanel.addEventListener("click", event => {
    if (event.target.closest("a")) {
        setMenuOpen(false);
    }
});

async function loadCatalog() {
    const container = document.getElementById("catalog-container");
    try {
        const response = await fetch("/api/forms");
        if (!response.ok) {
            throw new Error(`Catalog request failed with status ${response.status}`);
        }
        const items = await response.json();

        if (items.length === 0) {
            container.innerHTML = "<p>No entries yet.</p>";
            return;
        }

        container.replaceChildren();
        for (const item of items) {
            const card = document.createElement("article");
            card.className = "catalog-card";

            if (item.image) {
                const image = document.createElement("img");
                image.src = `/uploads/${encodeURIComponent(String(item.image))}`;
                image.alt = typeof item.name === "string" ? item.name : "Catalog item";
                image.width = 120;
                card.appendChild(image);
            }

            const title = document.createElement("h3");
            title.textContent = typeof item.name === "string" ? item.name : "Untitled";
            card.appendChild(title);

            const category = document.createElement("p");
            category.textContent = `Category: ${String(item.category || "Unknown")}`;
            card.appendChild(category);
            container.appendChild(card);
        }
    } catch (err) {
        console.error("Failed to load items:", err);
        container.innerHTML = "<p>Error loading catalog.</p>";
    }
}

loadCatalog();