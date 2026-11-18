const headerMount = document.querySelector("[data-site-header]");

async function loadSiteHeader() {
    if (!headerMount) {
        return;
    }

    try {
        const response = await fetch("/pages/partials/header.html");
        if (!response.ok) {
            throw new Error(`Header request failed with status ${response.status}`);
        }

        headerMount.innerHTML = await response.text();

        const menuShell = headerMount.querySelector("#menu-shell");
        const menuToggle = headerMount.querySelector("#menu-toggle");
        const navigationPanel = headerMount.querySelector("#site-navigation");
        const title = headerMount.querySelector("[data-page-title]");

        function setMenuOpen(isOpen) {
            menuShell.classList.toggle("is-open", isOpen);
            menuToggle.setAttribute("aria-expanded", String(isOpen));
            menuToggle.setAttribute("aria-label", isOpen ? "Close navigation menu" : "Open navigation menu");
        }

        function updateTitle() {
            const pageTitle = headerMount.dataset.pageTitle || "Catalog";
            title.textContent = pageTitle;
            document.title = `${pageTitle} | Don't Starve Together Catalog`;
        }

        updateTitle();

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
    } catch (error) {
        console.error("Failed to load site header:", error);
        headerMount.textContent = "Navigation could not be loaded.";
    }
}

loadSiteHeader();
