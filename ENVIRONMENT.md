# Environment setup

## First deployment: leave the environment fields blank

You can deploy the public website with no custom environment variables. Hostinger supplies the port. The server treats an empty NODE_ENV as production, serves the public pages, and keeps client accounts, enquiries and database features closed until configured. It does not silently create a temporary production database.

Use Node 24, root `.`, build `npm run build`, start `npm start`, entry `server.js`. Redeploy the latest `main` branch.

## Activate client accounts and saved requests later

In Hostinger's application environment settings, enter:

| Name | Value |
| --- | --- |
| NODE_ENV | production |
| APP_URL | Your full live website URL beginning with https:// |
| APP_SECRET | A unique random secret, at least 32 characters |
| SETUP_TOKEN | A different unique random secret, at least 32 characters |
| DB_HOST | The hostname provided for your MySQL database |
| DB_PORT | 3306, unless your database settings specify a different port |
| DB_NAME | Full database name from Hostinger |
| DB_USER | Full database username from Hostinger |
| DB_PASSWORD | Password you set for that database user |

Database credentials and the final website URL cannot be prefilled because they are specific to your hosting account. Do not use the words shown in this table as real credentials. Do not put actual secrets in GitHub.

Generate APP_SECRET and SETUP_TOKEN locally with:

```bash
node --input-type=module -e "import {randomBytes} from 'node:crypto'; for (const name of ['APP_SECRET','SETUP_TOKEN']) console.log(name+'='+randomBytes(32).toString('hex'))"
```

Copy each value into Hostinger, save the variables, and redeploy/restart the application. Then open `/#setup` and use SETUP_TOKEN to create the first administrator. The public website remains available if the database settings are missing or incorrect; review the server logs to fix the backend connection.

## Optional automation connection

Keep these empty until your Claude/Canva workflow is ready:

- AUTOMATION_WEBHOOK_URL: your workflow's HTTPS receiver.
- AUTOMATION_WEBHOOK_SECRET: secret shared with that receiver, at least 32 random characters.
- AUTOMATION_CALLBACK_SECRET: separate callback secret, at least 32 random characters.

APP_URL must be a valid HTTPS website address before automation starts. Leaving the automation settings blank does not prevent configured client accounts or manual agency delivery from working.

## Local development

Use `NODE_ENV=development DB_DRIVER=sqlite npm start` for an isolated local database. SQLite mode is disabled in production. Do not set NODE_ENV=development on Hostinger.
