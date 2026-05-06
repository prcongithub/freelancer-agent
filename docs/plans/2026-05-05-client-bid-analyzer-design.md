# Client Bid Analyzer — Design Document

## Overview

Extend the freelancing agent platform to support **client users** who can log in via Freelancer.com OAuth and use an AI agent to analyze bids on their posted projects. Both freelancers and clients are first-class users on the platform, authenticated via Freelancer.com OAuth and routed to role-specific dashboards.

## Goals

- Add multi-user support with roles: `freelancer`, `client`, `super_admin`
- Freelancer.com OAuth as the single login method (Upwork added later)
- Clients see their active projects and receive a Claude-powered ranked shortlist of top 3-5 bidders
- Super admin (platform operator) manages users and views platform stats
- Minimal disruption to existing freelancer functionality

## Architecture

Modular monolith — same Rails 8 app, same deployment. New modules follow existing patterns (`Analyzer`, `Scanner`, etc.).

```
+---------------------------------------------------+
|                React SPA                          |
| /login  /dashboard/* (freelancer)                 |
| /client/* (client)   /admin/* (super_admin)       |
+------------------------+---------------------------+
                         | JWT (role-scoped)
+------------------------v---------------------------+
|            Rails 8 API                            |
+----------+----------+---------------+-------------+
| Scanner  |  Bidder  | ClientPortal  |    Auth     |
| Module   |  Module  |   Module      |   Module    |
+----------+----------+---------------+-------------+
                             |
                    Freelancer API (client OAuth token)
                    AWS Bedrock (Claude Haiku)
                    MongoDB Atlas
```

## Data Model

### users (new collection)

```
provider:             "freelancer"
provider_uid:         String   # Freelancer.com user ID
oauth_token:          String
oauth_token_secret:   String
role:                 String   # "freelancer" | "client" | "super_admin"
name:                 String
email:                String
avatar_url:           String
created_at, updated_at
```

### client_analyses (new collection)

```
project_freelancer_id:  String
client_user_id:         String (ref → users)
shortlist: [
  {
    rank:          Integer
    bidder_id:     String
    bidder_name:   String
    bid_amount:    Float
    score:         Integer (0-100)
    strengths:     [String]
    concerns:      [String]
    summary:       String
  }
]
analyzed_at: Time
```

## Auth Flow

1. User visits `/login` — chooses "Login as Freelancer" or "Login as Client"
2. Redirected to `GET /api/v1/auth/freelancer?role=client` (role stored in session)
3. Freelancer.com OAuth completes → callback to `/api/v1/auth/freelancer/callback`
4. Find-or-create `User` by `provider_uid`; set role on first login
5. Issue signed JWT `{ user_id, role, exp: 7.days }`
6. Redirect to `/dashboard` (freelancer), `/client` (client), or `/admin` (super_admin)
7. Super admin: role set manually in MongoDB — no self-signup path

JWT middleware applied to all API routes. Role guards per namespace:
- `/api/v1/client/*` → `require_role!(:client)`
- `/api/v1/admin/*` → `require_role!(:super_admin)`
- `/api/v1/*` (existing) → `require_role!(:freelancer)`

## New Modules

### Auth Module (`app/modules/auth/`)

- `freelancer_oauth.rb` — wraps OmniAuth Freelancer strategy, token exchange
- `token_service.rb` — JWT encode/decode, expiry

### ClientPortal Module (`app/modules/client_portal/`)

- `freelancer_client.rb` — Freelancer API calls using the client's OAuth token
  - `list_projects` — client's active posted projects
  - `list_bids(project_id)` — all bids on a project
- `bid_analyzer.rb` — builds Claude prompt, calls Bedrock, parses response
- `analyze_bids_job.rb` — Sidekiq job (queue: `:default`, retry: 2)

### New Controllers

```
app/controllers/api/v1/auth/
  freelancer_controller.rb     # OAuth initiate + callback

app/controllers/api/v1/client/
  projects_controller.rb       # list projects, show project + bids
  analyses_controller.rb       # trigger analysis, return shortlist

app/controllers/api/v1/admin/
  users_controller.rb          # list users, update roles, revoke
  stats_controller.rb          # platform-wide stats
```

## Claude Analysis

The `BidAnalyzer` fetches all bids on a project and sends them to Claude (Bedrock, same model as `ProjectAnalyzer`). Output is a ranked shortlist of top 3-5 bidders.

**Prompt inputs:**
- Project title, description, budget, required skills
- Each bid: bidder name, rating, payment verified, bid amount, delivery time, proposal text, review count

**Claude output (JSON):**
```json
{
  "shortlist": [
    {
      "rank": 1,
      "bidder_id": "12345",
      "bidder_name": "Jane Doe",
      "bid_amount": 450,
      "score": 87,
      "strengths": ["directly addresses requirements", "strong portfolio match"],
      "concerns": ["slightly above budget"],
      "summary": "Best fit — proposal is specific and demonstrates clear understanding of the project."
    }
  ]
}
```

Results stored in `client_analyses`. Re-analysis available on demand.

## Frontend Routes

```
/login                          role selector + Freelancer OAuth button
/client/projects                list client's active Freelancer.com projects
/client/projects/:id            project detail + bid list + "Analyze Bids" button
/client/projects/:id/analysis   ranked shortlist with scores, strengths, concerns
/admin/users                    list all users, edit roles, revoke access
/admin/stats                    platform-wide metrics
```

Existing `/dashboard/*` routes unchanged.

## Error Handling

| Scenario | Handling |
|---|---|
| OAuth failure | Redirect to `/login?error=oauth_failed` |
| No bids on project | Show "No bids yet" — analysis not triggered |
| Bedrock error | Job retries 2x; surface error state in UI |
| Expired OAuth token | 401 → frontend redirects to re-auth |
| Role mismatch | 403 Forbidden |

## Testing

- OAuth callback: creates user with correct role, issues scoped JWT
- `BidAnalyzer`: unit test with stubbed Bedrock response
- Client API endpoints: role-gating (freelancer → 403 on `/client/` routes)
- Admin endpoints: only super_admin can access
- Frontend: role-based redirect after login

## Phasing

This feature is additive to Phase 1 (MVP). It can ship alongside or immediately after the freelancer MVP since it shares the same deployment and infrastructure. No existing functionality is removed or changed — only new routes, models, and modules are added.
