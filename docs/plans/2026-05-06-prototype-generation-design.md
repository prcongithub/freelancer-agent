# Prototype Generation Design

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:writing-plans to create the implementation plan from this design.

**Goal:** When a promising project is discovered, manually trigger generation of a working prototype from the project description, deploy it to S3/CloudFront, review it in the dashboard, and optionally include the live URL in the bid proposal.

**Architecture:** Two Rails services sharing one MongoDB instance. The main API handles prototype generation (via Bedrock/Claude) and S3 upload. A new lightweight `prototype-api` service handles generic CRUD/auth/file-upload for the prototype frontends, namespaced by `proto_id`.

**Tech Stack:** Rails 8 API (main + prototype-api), Mongoid 9, Sidekiq, AWS Bedrock (Claude Haiku), S3, CloudFront, Alpine.js + Tailwind CDN (in generated HTML), Docker Compose.

---

## Architecture

```
Browser (React)
    │
    ├──► Main Rails API :3000  ──► MongoDB: freelancing_agent_dev
    │         │                         (projects, bids, prototypes)
    │         │ queues jobs
    │         ▼
    │      Sidekiq ──► Bedrock (Claude) ──► generates HTML
    │         │
    │         └──► S3: prototypes/{proto_id}/index.html
    │                   │
    │              CloudFront: demo.yourdomain.com/p/{proto_id}/
    │
    └──► Prototype API :3001 ──► MongoDB: freelancing_prototypes
              (generic CRUD/auth/upload, namespaced by proto_id)
```

## Data Model

`Prototype` model in main app (`freelancing_agent_dev` database):

```ruby
field :project_id,    type: String   # links to Project
field :proto_id,      type: String   # short random slug (e.g. x7k2m9) — namespace key
field :status,        type: String   # generating | ready | failed | approved | rejected
field :public_url,    type: String   # CloudFront URL sent to client
field :s3_key,        type: String   # for cleanup
field :approved,      type: Boolean, default: false
field :generated_at,  type: Time
field :approved_at,   type: Time
```

`proto_id` is a 6-character random alphanumeric slug, unique per prototype. It namespaces all Prototype API data and ties the HTML frontend to its backend.

## Job Flow

```
POST /api/v1/projects/:id/prototype
  → create Prototype(status: generating, proto_id: SecureRandom.alphanumeric(6).downcase)
  → enqueue PrototypeGeneratorJob

PrototypeGeneratorJob
  → build prompt from project title, description, analysis scope, skills, category
  → call Bedrock → receive single-file HTML
  → upload to S3: prototypes/{proto_id}/index.html (public-read)
  → Prototype.update!(status: ready, public_url: CloudFront URL, generated_at: now)
  → on failure: retry once with simpler prompt, then status: failed

Frontend polls GET /api/v1/projects/:id/prototype every 3s while status == generating

POST /api/v1/prototypes/:id/approve  → approved: true, approved_at: now
POST /api/v1/prototypes/:id/reject   → status: rejected
```

## Prototype API (separate service, port 3001)

Minimal Rails API-only app. `proto_id` in URL path is the access control — no API keys needed for demo purposes.

MongoDB database: `freelancing_prototypes`. Collections named `{proto_id}_{collection}`.

### Endpoints

**Generic CRUD:**
```
GET    /:proto_id/:collection
POST   /:proto_id/:collection
GET    /:proto_id/:collection/:id
PUT    /:proto_id/:collection/:id
PATCH  /:proto_id/:collection/:id
DELETE /:proto_id/:collection/:id
DELETE /:proto_id                    # wipe all collections for this prototype
```

**Auth (per-prototype user system):**
```
POST /:proto_id/auth/register   → { email, password } → bcrypt, store in {proto_id}_users, return JWT
POST /:proto_id/auth/login      → { email, password } → verify, return JWT
GET  /:proto_id/auth/me         → validate JWT header, return user doc
```

JWT secret: `PROTO_JWT_SECRET` env var. Token payload includes `proto_id` claim to prevent cross-namespace token reuse.

**File uploads:**
```
POST /:proto_id/uploads   → multipart file → S3: proto-uploads/{proto_id}/{uuid}.{ext} → { url }
```

**CORS:** open for `*.cloudfront.net` and the custom demo domain.

## Prototype Generation Prompt

Claude is instructed to return a single HTML file with:
- Tailwind CSS via CDN
- Alpine.js via CDN (no bundler)
- All data calls pointing to `https://proto-api.yourdomain.com/{proto_id}/`
- Realistic sample data seeded on first load (localStorage flag prevents re-seeding)
- A small watermark: "Prototype by Prashant C. — hire me on Freelancer"
- Mobile-responsive layout

Category-specific instructions appended:
- `frontend` / `fullstack`: full UI with working navigation and data
- `ai_automation`: chat interface or workflow UI with streaming-style responses
- `backend` / `aws_devops`: API explorer UI (Swagger-style) showing the endpoints

## Frontend Changes (React)

New "Prototype" panel on Project Detail page, below Analysis panel.

States:
- **No prototype** → "Generate Prototype" button
- **Generating** → spinner + "Building… ~30 seconds"
- **Ready** → iframe preview + "Approve" / "Reject" buttons + "View live ↗" link
- **Approved** → green badge, live URL, note "Will be included in bid proposal"
- **Rejected** → grey badge + "Regenerate" button
- **Failed** → error + "Retry" button

## Proposal Generator Update

When `prototype.approved == true`, append to bid proposal text:

```
I built a working prototype based on your requirements — you can try it right now:
👉 {public_url}

No login needed to explore. The data layer is fully wired — create, edit, and delete records live.
```

## New API Endpoints (main app)

```
POST  /api/v1/projects/:id/prototype    → trigger generation
GET   /api/v1/projects/:id/prototype    → get status (for polling)
POST  /api/v1/prototypes/:id/approve    → approve
POST  /api/v1/prototypes/:id/reject     → reject
```

## Infrastructure

- **S3 bucket:** `freelancing-prototypes` (or sub-prefix of existing bucket)
  - `prototypes/{proto_id}/index.html` — prototype HTML (public-read)
  - `proto-uploads/{proto_id}/{uuid}.ext` — user file uploads from prototypes
- **CloudFront distribution:** `demo.yourdomain.com` pointing to the S3 bucket
- **docker-compose:** new `prototype-api` service, port 3001, same `kong-net` network

## Environment Variables

Main app additions:
```
PROTO_API_BASE_URL=http://prototype-api:3001   # internal Docker URL
PROTO_PUBLIC_BASE_URL=https://demo.yourdomain.com/p
S3_PROTOTYPE_BUCKET=freelancing-prototypes
CLOUDFRONT_PROTOTYPE_URL=https://demo.yourdomain.com
```

Prototype API:
```
MONGODB_URI=mongodb://mongo1:27017,mongo2:27017,mongo3:27017/freelancing_prototypes?replicaSet=my-mongo-set
PROTO_JWT_SECRET=<random 64-char secret>
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_REGION=...
S3_PROTOTYPE_BUCKET=freelancing-prototypes
```

## Error Handling

- Bedrock failure → retry once with simpler prompt → status: failed
- S3 upload failure → job retries (Sidekiq retry: 2)
- Prototype API down → CRUD calls fail gracefully in the prototype UI (show "Service unavailable")
- Malformed HTML from Claude → detected by checking for `</html>` tag, triggers retry
