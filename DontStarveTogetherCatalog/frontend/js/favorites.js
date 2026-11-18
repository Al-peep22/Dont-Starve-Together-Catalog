async function setupFavorite(container, category, id, name) {
    container.replaceChildren();
    const status = document.createElement("p");
    status.className = "favorite-status";
    status.setAttribute("role", "status");
    const button = document.createElement("button");
    button.type = "button";
    button.className = "favorite-button";
    button.disabled = true;
    button.textContent = "\u2661";
    button.setAttribute("aria-label", "Loading favorite");
    container.append(button, status);

    try {
        const accountResponse = await fetch("/api/auth/me");
        if (!accountResponse.ok) {
            throw new Error("Unable to check your account.");
        }
        const { user } = await accountResponse.json();
        if (!user) {
            button.setAttribute("aria-label", "Sign in to add to favorites");
            button.disabled = false;
            button.addEventListener("click", () => {
                window.location.assign("/pages/profile.html");
            });
            return;
        }

        const response = await fetch("/api/favorites");
        if (!response.ok) {
            throw new Error("Unable to load your favorites.");
        }
        const favorites = await response.json();
        let isFavorite = favorites.some(favorite => favorite.category === category && favorite.id === id);
        function updateButton() {
            button.textContent = isFavorite ? "\u2665" : "\u2661";
            button.setAttribute("aria-label", isFavorite ? "Remove from favorites" : "Add to favorites");
            button.setAttribute("aria-pressed", String(isFavorite));
        }
        updateButton();
        button.disabled = false;
        button.addEventListener("click", async () => {
            button.disabled = true;
            status.textContent = "";
            try {
                const result = await fetch("/api/favorites", {
                    method: isFavorite ? "DELETE" : "POST",
                    headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
                    body: JSON.stringify({ category, id, name })
                });
                if (!result.ok) {
                    const error = await result.json();
                    throw new Error(error.error || "Unable to update your favorites.");
                }
                isFavorite = !isFavorite;
                updateButton();
                status.textContent = isFavorite ? "Added to favorites." : "Removed from favorites.";
            } catch (error) {
                console.error("Failed to update favorite:", error);
                status.textContent = error.message;
            } finally {
                button.disabled = false;
            }
        });
    } catch (error) {
        console.error("Failed to load favorite:", error);
        button.setAttribute("aria-label", "Favorites unavailable");
        status.textContent = "Unable to load favorites. Please try again later.";
    }
}
