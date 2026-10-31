# Prestige Inmedia — Hostinger edition

The approved electric-blue website, with white text, lime accents, glass graphics and local Lucide icons. Built with HTML, CSS, JavaScript and PHP 8.2+ / MySQL. No Node.js build or VPS is required on the hosting account.

## What works

- Responsive public website, service selector, concept gallery and service enquiry forms.
- Client registration, sign in and sign out using server sessions.
- Persistent brand profiles and separate client workspaces.
- Graphic design, social media, video and ads production requests.
- Request status, delivery links, approval and revision feedback.
- Agency administrator: manage all brands, requests and incoming enquiries; deliver creative work manually.
- Signed automation webhook dispatcher, protected result callback and PHP cron worker.

## Deploy on Hostinger

Use **Custom PHP/HTML hosting**. This package does not run inside Hostinger Website Builder.

1. Add your domain or temporary domain as a PHP/HTML website in hPanel. Enable SSL and select PHP **8.2 or newer** with `pdo_mysql` and `curl`.
2. Create an **empty MySQL database and user** in Databases → Management. Keep the full database name, username and password.
3. Upload the contents of `public_html/` into your website's `public_html/` directory. `index.html` must sit directly inside it. Back up any existing website before replacing its files. Remove a competing default index file only on the new, empty website.
4. Put the `prestige-private/` folder **beside** `public_html/`, at the same directory level. Use File Manager → Access all files if needed. Do not place it inside `public_html`.
5. Copy `prestige-private/config.example.php` to `prestige-private/config.php`. Fill in your domain and database values. Replace both `CHANGE_...` strings with **different, random secrets of at least 32 characters**. Keep the automation values blank for now.
6. Visit your domain with `/#setup` at the end. Enter your setup token, administrator name, email and a password of at least 12 characters. The database tables are created automatically. The installer locks after the first administrator is created.
7. Sign out and create a test client account. Add a brand, submit a request, then sign in as the administrator to deliver it. Confirm the client can review and approve it.

Example directory layout:

```text
domains/your-domain.com/
  public_html/
    index.html
    .htaccess
    assets/
    api/index.php
  prestige-private/
    config.php             (you create this)
    bootstrap.php
    worker.php
    admin-cli.php
    config.example.php
    .htaccess
```

The same layout works with Hostinger's `/home/USER/public_html` directory structure. If a provider requires a different location, set the `PRESTIGE_PRIVATE` environment variable to the private directory path.

## Administrator access

Use the email and password you created at `/#setup`. No default credentials are included.

In **Client login**, the administrator sees Brand profiles, All requests, New request, Enquiries and Connections. A normal client only sees their own brands and requests.

If an administrator needs to reset a password, use SSH:

```bash
php /absolute/path/prestige-private/admin-cli.php reset-password person@example.com
```

The password is entered privately; do not put it in the command itself.

## Connect automatic production

The website is ready to hand off jobs, but **Claude, Canva, social publishing, paid ad execution and video rendering are not connected by default**. The host website does not pretend to generate designs or publish posts.

1. Set up a server workflow (for example your own agent service or n8n) with Claude and authenticated Canva access. Use the contract in `AUTOMATION.md`.
2. Set `automation.webhook_url` to its HTTPS endpoint. Set distinct random `webhook_secret` and `callback_secret` values of at least 32 characters. Store the matching secrets in the workflow.
3. In hPanel → Advanced → Cron Jobs, choose **PHP**, point to the full path of `prestige-private/worker.php` and run it every five minutes. A five-minute schedule is `*/5 * * * *` in a custom cron interface.
4. Sign in as administrator. Open existing **Saved for production** requests and choose **Queue for workflow**. New requests are queued automatically when a connection is configured.
5. Confirm a test request moves from Queued → In production → Ready for review.

Enabling the connection is configuration, not a guarantee that the receiving workflow is healthy. Check cron output and each request's timeline. The worker sends up to five requests per run. It does not automatically retry failed jobs, avoiding duplicate paid generations.

## Current boundaries

- Enquiries are stored in the agency dashboard. This release does not send email notifications.
- Production assets are shared as links, not uploaded to the web server.
- Publishing and campaign spend require separate connected platform credentials and workflow implementation. Approval here means creative approval; it does not launch an ad or publish a post.
- AI generation charges, Canva plans, ad spend and other provider subscriptions are separate.
- Password recovery is managed by the agency through the CLI, rather than an email reset service.
- The first release loads up to 200 recent requests and enquiries in the dashboard.
- Screenshots and sample campaign graphics are illustrative; they are not represented as past client work.

## Maintenance

Back up the MySQL database and private configuration. Use HTTPS. Keep PHP current. When updating, replace the public source and private application code while preserving `config.php` and your database. Test an update on a temporary domain first.

## Package source

- `public_html/`: deployable public files.
- `prestige-private/`: server code and private configuration template.
- `AUTOMATION.md`: production workflow and callback contract.
- `DEPLOY-CHECKLIST.md`: quick deployment check.
- `tests/`: local regression tests; never upload this directory into `public_html`.

Icons: Lucide, ISC license, included in `public_html/assets/LUCIDE-LICENSE.txt`. Google Fonts are loaded from their font CDN; all UI logic and icons are hosted locally.

Hostinger references: https://www.hostinger.com/support/4548688-basic-actions-in-the-file-manager-in-hostinger/ and https://www.hostinger.com/support/1583465-how-to-set-up-a-cron-job-at-hostinger/
