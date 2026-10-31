# Prestige Inmedia — Node.js edition

The approved blue-and-glass agency website with a Node.js backend and MySQL persistence.

## Hostinger deployment settings

| Setting | Value |
| --- | --- |
| Repository | prestigebatamid-spec/prestige-inmedia |
| Branch | main |
| Node.js | 24.x |
| Framework | Other / Node.js |
| Root directory | . (repository root) |
| Install | npm ci |
| Build | npm run build |
| Start | npm start |
| Entry file | server.js |
| Output directory | Leave blank for this server application |

Keep the whole repository together. The server serves only public_html and protects application source/configuration by never exposing the repository root. No manual folder movement is needed.

## Environment variables

You can leave all custom environment fields blank for the first deployment. The public website will load; client accounts and enquiry storage remain closed until configured. See ENVIRONMENT.md for the exact values to add later.

To activate the backend, set:

- NODE_ENV=production
- APP_URL=https://your-domain.com
- APP_SECRET: unique random value with at least 32 characters
- SETUP_TOKEN: a different unique random value with at least 32 characters
- DB_HOST, DB_PORT (3306), DB_NAME, DB_USER, DB_PASSWORD: your Hostinger MySQL credentials

The platform supplies PORT. No API keys or passwords belong in GitHub. See .env.example for the full variable list. Variables are read from process.env; a local .env file is not loaded automatically.

Create an empty MySQL database and user in Hostinger. On first startup the application creates its tables. Visit /#setup to create your administrator account using SETUP_TOKEN. After setup, client registration and agency access are available from Client login.

The public website starts with empty settings, including an empty NODE_ENV or APP_SECRET. Production backend access requires a valid APP_SECRET and MySQL connection. Database configuration failures leave the public pages available and are reported in server logs.

## Features

Client accounts and server-side sessions; isolated brand profiles; design, social, video and ads requests; enquiry inbox; manual agency delivery; client approval and revisions; signed automation dispatch and protected callbacks. Passwords use scrypt and sessions are persisted in the database. Requests require CSRF tokens; production cookies are Secure and HttpOnly.

## Automatic production

Set AUTOMATION_WEBHOOK_URL, AUTOMATION_WEBHOOK_SECRET and AUTOMATION_CALLBACK_SECRET to connect your own Claude/Canva production service. Secrets must be at least 32 characters and endpoint URLs must be HTTPS. A worker inside the running Node application checks the queue every minute; no PHP cron job is needed. Failed requests require explicit agency retry.

AUTOMATION.md describes the payload contract. The callback route is /api?action=callback. Review is required before approval. This website does not itself provide a running Claude/Canva service, video renderer, social publishing or ad execution.

## Local development and checks

Node 24 recommended. Run npm ci, then NODE_ENV=development DB_DRIVER=sqlite npm start for local development with a local SQLite database in data/. Production uses MySQL so state survives redeploys. Run npm test and npm run build.

Use a new database when moving from the earlier PHP prototype: PHP password hashes cannot be used by this Node release. Existing populated PHP databases require a separate migration; do not point this release at one without a migration plan.

Keep database backups. Enquiries are stored in the admin inbox; email notifications and email password recovery are not configured. Administrative password recovery can be arranged through a controlled database maintenance process; no public reset endpoint is supplied.

Icons: Lucide, ISC license included in public_html/assets/LUCIDE-LICENSE.txt. Gallery content is illustrative.
