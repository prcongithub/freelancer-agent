# Admin Agent Configuration UI — Design

**Date:** 2026-05-06

## Goal

Expose all 6 agent modules (Scanner, Analyzer, Bidder, Prototyper, Tracker, Client Portal) in an admin-only UI where a `super_admin` can view and edit every agent's prompts, rates, thresholds, and settings. Changes take effect on the next job run with no restart required.

---

## Architecture

### Backend: `AgentConfig` model

A new Mongoid model with one document per agent:

```ruby
{ agent: "analyzer", config: { model_id: "...", skill_profile: "...", ... } }
```

- `agent` field is unique-indexed
- `config` is a free-form Hash (no fixed schema — each agent owns its own shape)
- A seed script populates all 6 documents from current hardcoded defaults on first boot
- Each agent module reads via `AgentConfig.for("analyzer").config` with fallback to hardcoded defaults if the document is missing
- All write paths go through `AgentConfig` — hardcoded constants become fallback-only

### API endpoints (all require `super_admin` role)

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/admin/agents` | List all 6 agent configs |
| GET | `/api/v1/admin/agents/:agent` | Single agent config |
| PATCH | `/api/v1/admin/agents/:agent` | Update config (full replace of `config` hash) |

### Frontend routes

| Path | Component |
|------|-----------|
| `/admin/agents` | Redirect to `/admin/agents/scanner` |
| `/admin/agents/:agent` | `AdminAgentConfig` page |

Existing `/admin/users` and `/admin/stats` get folded into a shared `AdminLayout` sidebar for consistency.

---

## Agent Config Fields

### Scanner
| Field | Type | Default |
|-------|------|---------|
| `threshold` | integer (0–100) | 65 |
| `skill_match_minimum` | integer (0–100) | 25 |
| `keyword_groups` | JSON object | `{ aws_devops: [...], backend: [...], ... }` |

### Analyzer
| Field | Type | Default |
|-------|------|---------|
| `skill_profile` | markdown | Current hardcoded developer profile |
| `model_id` | string | `global.anthropic.claude-haiku-4-5-20251001-v1:0` |
| `max_tokens` | integer | 1024 |
| `temperature` | float (0–1) | 0.3 |

### Bidder
| Field | Type | Default |
|-------|------|---------|
| `category_rates` | JSON object | `{ aws_devops: {min:75, max:100}, ... }` |
| `agent_discount_threshold` | integer (0–100) | 70 |
| `proposal_system_prompt` | markdown | Current hardcoded system prompt |

### Prototyper
| Field | Type | Default |
|-------|------|---------|
| `category_hints` | JSON object | `{ frontend: "...", ai_automation: "...", ... }` |
| `system_prompt` | markdown | Current hardcoded generation prompt |
| `max_tokens` | integer | 8000 |
| `temperature` | float (0–1) | 0.5 |

### Tracker
| Field | Type | Default |
|-------|------|---------|
| `auto_bid_threshold` | integer (0–100) | 80 |

### Client Portal
| Field | Type | Default |
|-------|------|---------|
| `system_prompt` | markdown | Current hardcoded bid-ranking prompt |
| `max_tokens` | integer | 2048 |

---

## UI Design

### Layout

Shared `AdminLayout` component: left sidebar + main content area. Sidebar sections:
- Users (`/admin/users`)
- Stats (`/admin/stats`)
- Agents (expandable) → Scanner, Analyzer, Bidder, Prototyper, Tracker, Client Portal

### Field rendering

| Field type | UI control |
|------------|------------|
| Markdown (prompts) | `@uiw/react-md-editor` — split edit/preview, full width, ~300px tall |
| JSON (keyword_groups, category_rates, category_hints) | `<textarea>` monospace, validated on save |
| Integer / float | `<input type="number">` with min/max hint |
| String (model_id) | `<input type="text">` |

### Save behavior

- "Save Changes" button at the bottom of each agent page
- On success: green toast notification
- On JSON parse error: inline error under the offending field
- On out-of-range number: inline validation error
- Navigation guard: `beforeunload` warning if unsaved changes exist

### Access control

- All `/admin/*` routes gated by `super_admin` role via existing `ProtectedRoute` wrapper
- Backend enforces `require_role!(:super_admin)` on all agent config endpoints

---

## Data Migration

On first boot, a Rails initializer (or explicit seed task) creates `AgentConfig` documents from current hardcoded defaults if they don't already exist. This is idempotent — existing documents are not overwritten. Production deployments run `rails db:seed` or `bundle exec rails runner 'AgentConfig.seed_defaults'` once.

---

## What Is Not Changing

- ENV vars (AWS keys, Freelancer token, S3 bucket, etc.) remain in `.env` — not in the admin UI
- The existing `Setting` model continues to handle `approval_threshold`, `notifications`, and `skill_keywords` for non-admin users
- `Tracker.auto_bid_threshold` will read from `AgentConfig` going forward; the `Setting.auto_bid_threshold` field is deprecated (not removed)
