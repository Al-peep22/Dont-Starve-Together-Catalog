// public/script.js (Frontend - runs in the browser)
async function loadCatalog() {
    const container = document.getElementById("catalog-container");
    try {
        const response = await fetch("/api/forms");
        const items = await response.json();

        if (items.length === 0) {
            container.innerHTML = "<p>No entries yet.</p>";
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="catalog-card">
                ${item.image ? `<img src="/uploads/${item.image}" alt="${item.name}" width="120">` : ""}
                <h3>${item.name}</h3>
                <p>Category: ${item.category}</p>
            </div>
        `).join("");
    } catch (err) {
        console.error("Failed to load items:", err);
        container.innerHTML = "<p>Error loading catalog.</p>";
    }
}

loadCatalog();