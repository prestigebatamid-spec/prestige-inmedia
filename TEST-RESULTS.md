# Verification results

## Passed

- PHP 8.2 syntax checks for all application PHP files.
- JavaScript syntax check for the client application.
- Backend regression test through a native PHP 8.2 CGI runtime and an isolated SQLite database.
- One-time administrator setup and installer lockout.
- Client registration, role protection, login, logout and subsequent login.
- CSRF rejection for invalid state-changing requests.
- Cross-client brand, request and event access restrictions.
- Enquiry persistence and administrator-only enquiry updates.
- Saved brand profiles, creative request creation and request ownership when created by the agency.
- Manual delivery, HTTPS deliverable validation, creative approval and revision feedback.
- Callback authentication, stale-token rejection and duplicate callback protection.
- Desktop browser rendering of the approved design, with white text on blue backgrounds.
- Mobile layout check at a 320px frame width (305px content width after browser scrollbar), without horizontal overflow.
- Public enquiry dialog and client access interface.

## Deployment checks still required

- Live Hostinger MySQL connection, PHP extensions, SSL, filesystem permissions and .htaccess behavior.
- Live session behavior and full frontend-to-PHP flow on the actual domain. The browser preview environment served static files; backend flows were tested separately with PHP CGI.
- Cron delivery to a real automation endpoint and an end-to-end Claude/Canva result. No provider credentials or workflow endpoint were supplied.
- Social account connections, publishing, campaign execution and video rendering are external workflow responsibilities, not active features of this release.

## Running the regression test

Requires Python 3, php-cgi and PHP PDO SQLite extensions in a local development environment:

```bash
PHP_CGI=/path/to/php-cgi python3 tests/api-regression.py
```

For a nonstandard extension location, also set `PHP_EXTENSION_DIR`. The test uses temporary accounts and a temporary database; it does not contact production services.
