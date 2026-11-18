const params = new URLSearchParams(window.location.search);
const requestedPage = params.get("page") || "0";
const status = document.querySelector("[data-lore-status]");
const content = document.querySelector("[data-lore-content]");
const pageInput = document.querySelector("#lore-page-number");
const previous = document.querySelector("[data-previous-page]");
const next = document.querySelector("[data-next-page]");

function setPageButton(button, pageNumber) {
    button.disabled = pageNumber === null;
    button.dataset.page = pageNumber === null ? "" : String(pageNumber);
}

// The API returns the nearest stored page, so navigation can skip missing page numbers.
for (const button of [previous, next]) {
    button.addEventListener("click", () => {
        window.location.assign(`/pages/lore.html?page=${encodeURIComponent(button.dataset.page)}`);
    });
}

function addMedia(media) {
    if (!media || !["image", "video"].includes(media.type) || typeof media.url !== "string") {
        console.error("Invalid lore media entry:", media);
        return;
    }
    let url;
    try {
        url = new URL(media.url, window.location.origin);
    } catch (error) {
        console.error("Invalid lore media URL:", error);
        return;
    }
    if (url.protocol !== "https:" && url.origin !== window.location.origin) {
        console.error("Lore media must use HTTPS or a same-origin URL.");
        return;
    }
    const figure = document.createElement("figure");
    const element = document.createElement(media.type === "image" ? "img" : "video");
    element.src = url.href;
    if (media.type === "image") {
        element.alt = typeof media.alt === "string" ? media.alt : "";
        element.loading = "lazy";
    } else {
        element.controls = true;
        element.preload = "metadata";
        element.setAttribute("aria-label", typeof media.alt === "string" ? media.alt : "Lore video");
    }
    element.addEventListener("error", () => {
        const message = document.createElement("p");
        message.textContent = `Unable to load this ${media.type}.`;
        figure.append(message);
    }, { once: true });
    figure.append(element);
    if (typeof media.caption === "string" && media.caption) {
        const caption = document.createElement("figcaption");
        caption.textContent = media.caption;
        figure.append(caption);
    }
    content.append(figure);
}

function showLorePage(page, number) {
    content.replaceChildren();
    const titleRow = document.createElement("div");
    titleRow.className = "title-with-favorite";
    const heading = document.createElement("h1");
    heading.textContent = page.title;
    const favorite = document.createElement("div");
    favorite.className = "favorite-control";
    titleRow.append(heading, favorite);
    content.append(titleRow);
    for (const paragraph of page.paragraphs) {
        const text = document.createElement("p");
        text.textContent = paragraph;
        content.append(text);
    }
    for (const media of page.media) {
        addMedia(media);
    }
    setupFavorite(favorite, "Lore", String(number), page.title);
}

async function loadLore() {
    if (!/^(0|[1-9]\d*)$/.test(requestedPage) || !Number.isSafeInteger(Number(requestedPage))) {
        status.textContent = "Enter a non-negative whole page number.";
        return;
    }
    const number = Number(requestedPage);
    pageInput.value = String(number);
    document.querySelector("[data-current-page]").textContent = `Page ${number}`;
    if (number === 0) {
        showLorePage({
            title: "Explore the lore",
            paragraphs: [
                "Explore the stories of the Constant, its survivors, and the world around them. Use the arrows or enter a page number to browse."
            ],
            media: [{
                type: "image",
                url: "/images/backgrounds/background_desk.png",
                alt: "Books and notes from the world of Don't Starve Together"
            }]
        }, number);
    }

    try {
        const response = await fetch(`/api/lore/${number}`);
        if (response.status === 404) {
            status.textContent = "This lore page does not exist. Enter another page number.";
            setPageButton(previous, 0);
            return;
        }
        if (!response.ok) {
            throw new Error(`Lore request failed with status ${response.status}`);
        }
        const result = await response.json();
        setPageButton(previous, result.previousPage);
        setPageButton(next, result.nextPage);
        if (number !== 0) {
            const page = result.page;
            if (
                !page ||
                typeof page.title !== "string" ||
                !Array.isArray(page.paragraphs) ||
                !page.paragraphs.every(paragraph => typeof paragraph === "string") ||
                !Array.isArray(page.media)
            ) {
                throw new Error("Lore document does not match the expected schema.");
            }
            showLorePage(page, number);
        } else if (result.nextPage === null) {
            status.textContent = "No lore pages have been added yet.";
        }
    } catch (error) {
        console.error("Failed to load lore:", error);
        status.textContent = "Unable to load lore pages right now.";
    }
}

loadLore();
