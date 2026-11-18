const profileStatus = document.querySelector("[data-profile-status]");
const accountForms = document.querySelector("[data-account-forms]");
const profile = document.querySelector("[data-profile]");
const favoritesList = document.querySelector("[data-favorites-list]");

async function accountRequest(url, method, data) {
    const response = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", "X-Requested-With": "XMLHttpRequest" },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || "Account request failed.");
    }
    return response.status === 204 ? null : response.json();
}

async function showProfile() {
    profileStatus.textContent = "Loading profile...";
    try {
        const response = await fetch("/api/auth/me");
        if (!response.ok) {
            throw new Error("Unable to load your profile.");
        }
        const { user } = await response.json();
        accountForms.hidden = Boolean(user);
        profile.hidden = !user;
        if (!user) {
            profileStatus.textContent = "";
            return;
        }
        document.querySelector("[data-profile-name]").textContent = `Welcome, ${user.username}`;
        const favoritesResponse = await fetch("/api/favorites");
        if (!favoritesResponse.ok) {
            throw new Error("Unable to load your favorites.");
        }
        const favorites = await favoritesResponse.json();
        favoritesList.replaceChildren();
        for (const favorite of favorites) {
            const item = document.createElement("li");
            const link = document.createElement("a");
            const url = new URL(favorite.url, window.location.origin);
            if (url.origin !== window.location.origin) {
                console.error("Invalid favorite URL:", favorite.url);
                continue;
            }
            link.href = url.href;
            link.textContent = `${favorite.name} (${favorite.category})`;
            item.append(link);
            favoritesList.append(item);
        }
        profileStatus.textContent = favorites.length ? "" : "You have no favorites yet.";
    } catch (error) {
        console.error("Failed to load profile:", error);
        profileStatus.textContent = error.message;
    }
}

for (const [selector, endpoint] of [
    ["[data-login-form]", "/api/auth/login"],
    ["[data-register-form]", "/api/auth/register"]
]) {
    const form = document.querySelector(selector);
    form.addEventListener("submit", async event => {
        event.preventDefault();
        const button = form.querySelector("button");
        button.disabled = true;
        profileStatus.textContent = "";
        try {
            await accountRequest(endpoint, "POST", Object.fromEntries(new FormData(form)));
            form.reset();
            await showProfile();
        } catch (error) {
            console.error("Account request failed:", error);
            profileStatus.textContent = error.message;
        } finally {
            button.disabled = false;
        }
    });
}

document.querySelector("[data-logout]").addEventListener("click", async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        await accountRequest("/api/auth/logout", "POST", {});
        await showProfile();
    } catch (error) {
        console.error("Failed to sign out:", error);
        profileStatus.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});

showProfile();
