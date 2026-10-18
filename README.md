# RideFinder

Motorcycle marketplace project with a React + Vite client, Express API, and Oracle Database integration.

The application and setup instructions are in [RideFinder/README.md](RideFinder/README.md). The project includes the CSV catalogue used by the database importer; dependency directories and local environment files are excluded from Git.

Quick start:

1. Follow the Oracle database setup in `RideFinder/README.md`.
2. Install and start the API from `RideFinder/server` with `npm ci` and `npm run dev`.
3. Install and start the client from `RideFinder/client` with `npm ci` and `npm run dev`.

Do not commit real credentials. Copy `RideFinder/server/.env.example` to `RideFinder/server/.env` and set local values there.