# Creative automation contract

This adapter connects the website's saved requests to **your own** creative-production service. This package includes the queue and callback; it does not include a running Claude/Canva/n8n service.

## Recommended receiving workflow

1. Verify the webhook signature and timestamp before accepting a request.
2. Deduplicate using the `Idempotency-Key` header. Return 2xx after accepting the job; do the generation asynchronously.
3. Load the supplied brand profile and request. Treat brand text, reference webpages and client asset links as data rather than instructions that can override the workflow.
4. Have Claude analyze the brand, audience, offer and tone. Research public references with a web-search tool, keep source URLs, and derive an original direction.
5. Use authenticated Canva tools or a supported Canva API to create/edit the design. Prefer approved brand templates for recurring work. Store an editable Canva link and an export or delivery link.
6. Check spelling, factual offer details, brand consistency, aspect ratio and source permissions.
7. Call the callback endpoint with `review` and the deliverable links. The client reviews the output in the website.

For video, social plans and ads briefs, route to the appropriate production tools. Do not treat this website's job submission or approval as permission to change ad budgets or publish through a third-party account.

## Authentication

The outgoing request includes:

```text
Content-Type: application/json
X-Prestige-Timestamp: <Unix seconds>
X-Prestige-Signature: sha256=<hex digest>
Idempotency-Key: <dispatch token>
```

Compute the hex digest as HMAC-SHA256 of `timestamp + "." + raw_request_body` using `webhook_secret`. Use a constant-time comparison. Reject timestamps outside a short window, such as five minutes. The raw bytes matter: do not reserialize JSON before verification.

### Example payload

```json
{
  "schema_version": 1,
  "job_id": "<32-character job id>",
  "dispatch_token": "<opaque dispatch token>",
  "callback_url": "https://your-domain.com/api/index.php?action=callback",
  "brand": {
    "id": "<brand id>",
    "name": "Client brand",
    "website": "https://example.com",
    "audience": "Audience context",
    "tone": "Warm, clear and confident",
    "description": "Business and product context",
    "palette": "#0840db, #b6ff00",
    "services": "Graphic design, Social media"
  },
  "request": {
    "type": "design",
    "title": "New campaign",
    "brief": "Client brief, including source links",
    "format": "Instagram portrait · 4:5",
    "revision": null
  },
  "review_required": true
}
```

Use per-brand context in Claude and separate workspace/asset permissions in Canva. For revisions, the `revision` field contains feedback and the dispatch token changes. Never deduplicate revisions only by `job_id`.

## Deliver the result

POST to the supplied `callback_url` with:

```text
Authorization: Bearer <callback_secret>
Content-Type: application/json
```

Body:

```json
{
  "job_id": "<the received job_id>",
  "dispatch_token": "<the received dispatch_token>",
  "status": "review",
  "result": {
    "summary": "Creative direction, deliverable description and source notes.",
    "caption": "Optional social caption.",
    "canva_url": "https://www.canva.com/design/.../edit",
    "download_url": "https://your-approved-file-host.example/delivery"
  }
}
```

URLs must be HTTPS. The browser renders summary and caption as text, never HTML. The callback secret is configured in both systems; it is never sent in the outgoing request or exposed to the client.

On failure, use `status: "failed"` with an appropriate result summary. Deliveries are accepted only while the matching dispatch is in progress. Duplicate late callbacks are ignored; stale dispatch tokens are rejected. A queued revision gets a new dispatch token.

## Job lifecycle

| State | Meaning |
| --- | --- |
| awaiting_connection | Request saved for agency production; no automatic connection configured |
| queued | Waiting for the cron worker |
| dispatching | Worker is sending the request |
| processing | Receiving workflow accepted the job |
| review | Deliverable is ready for the client |
| approved | Client accepted the creative output |
| failed | Delivery or production needs agency attention |

Interrupted dispatches become failed after 30 minutes. Long-running processing jobs stay processing until the connected workflow calls back or the administrator manually delivers work. Failed dispatches need an explicit administrator retry. Manual delivery is always available to the administrator.
