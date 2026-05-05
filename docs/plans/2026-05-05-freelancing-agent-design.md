# Freelancing Agent Platform - Design Document

## Overview

An agentic platform that automates the freelancing workflow on Freelancer.com: project discovery, intelligent bidding, autonomous project execution via Claude Code, and delivery tracking.

## Goals

- Phase 1: Cherry-pick high-value projects, automate discovery and bidding
- Phase 2: Automate project building and staging deployment
- Phase 3: Full autonomy — agent handles everything end-to-end

## User Profile & Skillset

Full Stack Developer and AWS/DevOps consultant. Core skills:
- Cloud & DevOps: AWS (EC2, S3, Lambda, RDS, ECS, EKS, etc.), Docker, Kubernetes, Terraform, CI/CD
- Backend: Ruby on Rails, Node.js, Express.js, Python APIs, microservices
- Frontend: React, Angular, TypeScript
- Databases: PostgreSQL, MySQL, MongoDB, Redis
- AI/Automation: Agentic AI, RAG systems, OpenAI/Claude/Bedrock, n8n workflows

## Architecture

Modular monolith — single Rails 8 app with clearly separated modules, React dashboard served via S3+CloudFront.

```
+---------------------------------------------------+
|                React Dashboard                     |
| (Pipeline view, bid tracking, project status, PRDs)|
+------------------------+---------------------------+
                         | API (JWT auth)
+------------------------v---------------------------+
|            Rails 8 API (Modular Monolith)          |
+----------+----------+-----------+-----------------+
| Scanner  |  Bidder  |  Builder  |    Tracker      |
| Module   |  Module  |  Module   |    Module       |
+----------+----------+-----------+-----------------+
       |         |          |              |
       v         v          v              v
+---------------------------------------------------+
|          Sidekiq (Background Jobs)                 |
| Queues: scanning, bidding, building, deploying     |
+---------+---------+-------------+-----------------+
          |         |             |
    +-----+    +----+----+   +---+---+
    v          v         v   v       v
Freelancer  Claude     AWS    MongoDB  Redis
  API       Code CLI  (ECS)   Atlas
```

## Modules

### Scanner Module

Finds and scores projects matching the skillset.

- Polls Freelancer API every 5-10 minutes with keyword groups per category
- Scores each project (0-100) on: skill match, budget range, scope clarity, agent-buildable potential, client quality
- Configurable threshold (default 60) — below is discarded
- Deduplicates by Freelancer project ID

### Bidder Module

Generates and submits personalized bids.

- Auto-bid for score 80+ (no approval needed)
- Queue for approval: score 60-79
- Pricing engine:
  - Category floors: AWS/DevOps $75-100/hr, AI $100-120/hr, Full-stack $60-80/hr, Frontend $40-60/hr
  - Value-based ceiling for enterprise/funded clients
  - Agent-buildable discount: 20-30% lower for fully automatable projects
- Claude generates personalized proposal (150-250 words) referencing specific project requirements
- Submits via Freelancer API

### Builder Module

Takes a PRD and produces a deployed application.

- PRD Input (Phase 1): Paste call notes -> Claude generates structured PRD -> user reviews/edits/approves
- PRD Input (Phase 3): Call transcription via Whisper/Deepgram -> auto-generates PRD
- On approval:
  - Creates Git repo
  - Claude Code builds project following PRD
  - Breaks into phases: scaffold -> backend -> frontend -> tests
  - Runs tests after each phase
  - Logs progress to dashboard in real-time
  - Pauses on unresolvable failures
- Staging deployment:
  - Dockerizes the app
  - Deploys to AWS ECS
  - Provisions subdomain: project-name.staging.yourdomain.com
- Handoff: packages artifacts (Docker image, IaC, docs) for client

### Tracker Module

Pipeline management and status tracking.

- Pipeline states: Discovered -> Bid Sent -> Shortlisted -> Won -> In Call -> PRD Ready -> Building -> Deployed -> Delivered (or Lost)
- Dashboard views: Pipeline (Kanban), Active Projects, Bid History, Stats
- Notifications: high-score discoveries, approval needed, shortlisted/won, build failures, client messages
- Background sync with Freelancer API for status updates

## Data Models (MongoDB Collections)

### projects
- freelancer_id (unique)
- title, description, budget_range, skills_required
- client: { id, name, rating, payment_verified, country }
- fit_score: { total, skill_match, budget, scope_clarity, agent_buildable, client_quality }
- status: discovered | bid_sent | shortlisted | won | in_call | prd_ready | building | deployed | delivered | lost
- category: aws_devops | backend | frontend | fullstack | ai_automation
- timestamps: discovered_at, bid_at, won_at, delivered_at

### bids
- project_id (ref)
- amount, currency
- proposal_text
- pricing_breakdown: { hourly_rate, estimated_hours, discount_applied }
- status: submitted | viewed | shortlisted | won | lost
- submitted_at

### builds
- project_id (ref)
- prd: { raw_notes, generated_prd, approved_at }
- repo_url
- progress: [{ phase, status, started_at, completed_at, logs }]
- staging_url
- deploy_status: pending | building | deployed | failed | handed_off
- artifacts: { docker_image, iac_scripts, docs_url }

### settings
- skill_keywords: { category: [keywords] }
- pricing_floors: { category: { min, max } }
- auto_bid_threshold, approval_threshold
- notifications: { email, dashboard }
- freelancer_api_credentials
- aws_staging_config

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Rails 8 (API mode), ruby:3.4-slim-bookworm |
| Frontend | React (Vite) + TailwindCSS |
| Database | MongoDB Atlas (free tier) |
| Cache/Queues | Redis (AWS ElastiCache) |
| Background Jobs | Sidekiq |
| Coding Agent | Claude Code CLI |
| Platform Deploy | AWS ECS Fargate |
| Frontend Hosting | S3 + CloudFront |
| Client Staging | ECS per project, Route53 wildcard |
| Freelancer Integration | Official API |

## Infrastructure

```
AWS Account
+-- ECS Cluster
|   +-- Service: rails-api (2 tasks)
|   +-- Service: sidekiq-workers (2-4 tasks)
|
+-- S3 + CloudFront -> React SPA
+-- ElastiCache (Redis)
+-- ALB -> rails-api
+-- Route53 wildcard: *.staging.yourdomain.com
+-- Per-client staging (ECS tasks)
```

External:
- MongoDB Atlas (managed)
- Freelancer.com API
- Claude Code CLI (inside Sidekiq containers)
- GitHub (repos per client project)

## Phased Rollout

### Phase 1 (MVP)
- Scanner module: discover and score projects
- Dashboard: pipeline view, manual bid approval
- Bidder module: generate proposals, submit bids
- Basic tracker: status sync from Freelancer API
- Deploy platform on ECS

### Phase 2 (Builder)
- PRD generation from pasted call notes
- Claude Code integration: build projects from PRDs
- Staging deployment automation (Docker + ECS per project)
- Build progress monitoring in dashboard

### Phase 3 (Full Autonomy)
- Auto-bidding for high-score projects without approval
- Call transcription -> auto PRD (Whisper/Deepgram)
- Agent handles client messaging post-call
- Bid optimization from win/loss history
- Multi-project parallel execution

## Human-in-the-Loop Boundaries

| Phase | Human Does | Agent Does |
|-------|-----------|-----------|
| Phase 1 | Approves bids (60-79 score), handles all client interaction | Discovers, scores, generates proposals, submits approved bids |
| Phase 2 | Initial client call, reviews PRD, reviews final build | Generates PRD, builds, deploys, tracks |
| Phase 3 | Exception handling only | Everything |
