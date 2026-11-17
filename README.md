# Don't Starve Together Catalog

## Run locally

Requires Node.js LTS and a MongoDB database. From the repository root:

```powershell
npm ci
$env:MONGO_URI = "<your MongoDB connection string>"
npm start
```

Open `http://localhost:3000`. The server uses the hosting provider's `PORT` value when deployed. Do not commit database credentials or put them in source files.

## Deploy as a Node.js web service

Configure the service with:

- **Build command:** `npm ci`
- **Start command:** `npm start`
- **Environment variable:** `MONGO_URI` set to the connection string for your MongoDB database
- **Optional environment variable:** `ADMIN_TOKEN` set to a long, unique secret to enable the protected `/add` form and catalog submissions. Without it, editing is disabled.

The database must allow connections from the hosting service. The app serves its public files and API from the same host. Uploaded images are saved under `DontStarveTogetherCatalog/public/uploads`; on hosts with ephemeral filesystems, those uploads may not persist across restarts or redeploys.

The database credential previously present in source should be rotated in MongoDB, and the replacement should be set only in the hosting service's environment settings.