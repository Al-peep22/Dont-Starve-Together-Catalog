# Don't Starve Together Catalog

## Run on Render
https://dont-starve-together-catalog.onrender.com/

## OR Run locally

Requires Node.js LTS and a MongoDB database. From the repository root:

```powershell
npm ci
npm start
```

For local development, copy `.env.example` to `DontStarveTogetherCatalog/backend/.env` and set `MONGO_URI` there. `MONGO_DATABASE` defaults to `dst_catalog`. Open `http://localhost:3000`. The server uses the hosting provider's `PORT` value when deployed. Never commit `.env` or database credentials.

## Deploy as a Node.js web service

Configure the service with:

- **Build command:** `npm ci`
- **Start command:** `npm start`
- **Environment variable:** `MONGO_URI` set to the connection string for your MongoDB database
- **Database name:** `MONGO_DATABASE=dst_catalog` (the current default)
- **Optional environment variable:** `ADMIN_TOKEN` set to a long, unique secret to enable the protected `/add` form and catalog submissions. Without it, editing is disabled.

Leave Render's Root Directory blank so it uses the repository root. The database must allow connections from the hosting service. The app serves its frontend files and API from the same host. Uploaded images are saved under `DontStarveTogetherCatalog/frontend/uploads`; on hosts with ephemeral filesystems, those uploads may not persist across restarts or redeploys.

## Page links and routes

- Edit the shared navigation links in `DontStarveTogetherCatalog/frontend/html/partials/header.html`. The home-page lore button and individual-page back links are in their respective HTML files.
- `/pages` maps to the `DontStarveTogetherCatalog/frontend/html` folder in `backend/backend.js`. For example, `/pages/Characters/characters.html` serves `frontend/html/Characters/characters.html`. Paths are case-sensitive on Render.
- Change individual detail destinations in both `frontend/js/catalog.js` and `backend/routes/index.js` (`detailPages` in each file). The first creates group-page links; the second saves favorite links. Existing favorites retain their saved URLs when a destination changes.
- Special routes such as `/`, `/add`, and `/api/forms` are defined in `backend/backend.js` and `backend/routes/index.js`. Lore links use `/pages/lore.html?page=0` for the introduction and a different `page` number for other lore pages.

## Lore pages

The lore introduction is page 0. Add subsequent pages to the `lore` MongoDB collection with a unique, positive integer `pageNumber`, a `title`, an array of text `paragraphs`, and a `media` array. Use `media: []` for pages without images or videos:

```json
{
  "pageNumber": 1,
  "title": "A story from the Constant",
  "paragraphs": ["Write your own lore text here."],
  "media": [
    { "type": "image", "url": "/images/example.png", "alt": "Description", "caption": "Optional caption" },
    { "type": "video", "url": "https://example.com/video.mp4", "alt": "Video description", "caption": "Optional caption" }
  ]
}
```

Media must be a same-origin path or HTTPS URL. Videos must be directly playable video files, not video-platform page links. Host media somewhere persistent; MongoDB stores the URLs, not the files. The arrows skip unused page numbers. Create a unique index on `pageNumber` in the `lore` collection to prevent duplicate pages.

## Profiles and favorites

Visitors can register or sign in from the Profile link, then favorite lore pages and individual catalog entries. Accounts and sessions are stored in the `catalog_accounts` and `sessions` collections in the configured MongoDB database; the database user needs permission to create indexes and read and write these collections. Account passwords are stored as salted scrypt hashes. Session cookies are HTTP-only and secure when the app is accessed over HTTPS; Render's proxy is trusted when the `RENDER` environment variable is present.

The basic account system does not currently provide email verification or password recovery. Login and registration rate limiting is per server instance, so deployments with multiple instances need a shared rate-limit store before relying on it for abuse protection.

The database credential previously present in source should be rotated in MongoDB, and the replacement should be set only in the hosting service's environment settings.
