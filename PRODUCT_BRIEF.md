# Product Brief: EnGenius ShortLink

## Overview

EnGenius ShortLink is an internal marketing URL shortener and campaign tracking platform built for marketing teams. It enables marketers to create branded short links with UTM tracking parameters, organize them into campaigns, and analyze click performance across multiple dimensions — all within a collaborative, multi-workspace environment.

---

## Problem Statement

Marketing teams run dozens of campaigns simultaneously across multiple channels (social media, email, paid ads, KOL partnerships). Each campaign requires unique tracking URLs to measure performance. Without a centralized tool, teams face:

- **Scattered tracking** — UTM parameters are manually constructed, error-prone, and inconsistent
- **No visibility** — Click data is siloed in Google Analytics with no campaign-level overview
- **Collaboration gaps** — No shared workspace for team members to manage links and view reports
- **Slow iteration** — Creating multiple link variants (e.g., per-KOL tracking) is tedious and repetitive

---

## Solution

A self-hosted, internal-use URL shortener that combines **link creation**, **campaign management**, and **click analytics** into a single platform with team collaboration features.

---

## Target Users

| Persona | Use Case |
|---------|----------|
| **Marketing Manager** | Plan campaigns, review overall performance, manage team access |
| **Marketing Specialist** | Create short links with UTM params, track daily campaign metrics |
| **Content / Social Media Manager** | Generate per-channel and per-KOL tracking URLs quickly |
| **External Stakeholders** | View shared, password-protected campaign reports |

---

## Core Capabilities

### 1. Short Link Management

Create short links with auto-generated or custom codes. Each link supports:
- Custom short code (e.g., `/spring-sale`)
- UTM parameters (source, medium, campaign, content, term)
- Expiration date and maximum click limit
- Status lifecycle (Active / Paused / Archived)
- QR code generation
- Tags for organization

**Batch creation** allows generating multiple link variants at once — ideal for creating per-KOL or per-channel tracking URLs from a single base URL.

### 2. Campaign Management

Group related links under a Campaign entity with:
- Campaign name (used as `utm_campaign` value)
- Display name and description
- Default UTM source and medium (auto-applied to new links)
- Status lifecycle: Draft → Active → Completed → Archived
- Campaign-level tags for categorization

Campaign acts as the **primary organizational unit** — users can filter links, analytics, and dashboard metrics by campaign across all pages.

### 3. Analytics & Reporting

Real-time click tracking captures:
- **Time series** — Clicks over time (24h / 7d / 30d / 90d / custom range)
- **Device breakdown** — Mobile, Tablet, Desktop
- **Browser & OS distribution** — Chrome, Safari, Firefox; iOS, Android, Windows, macOS
- **Geographic data** — Country and city-level via GeoIP
- **Referrer tracking** — Where traffic originates
- **Hourly heatmap** — Peak click times within a day
- **UTM cross-analysis** — Campaign x Source, Campaign x Content breakdowns

All analytics support **campaign-level and link-level filtering** for drill-down analysis.

**Export**: Links list and raw click data can be exported as CSV.

**Public sharing**: Generate password-protected, time-limited share links for external stakeholders to view specific link analytics without logging in.

### 4. UTM Template System

Save frequently used UTM parameter combinations as templates. When creating a new link, apply a template to auto-fill source, medium, campaign, content, and term — reducing setup time and ensuring consistency.

### 5. Team Collaboration

**Multi-workspace architecture** — Each team or business unit gets its own workspace with isolated links, campaigns, and member management.

**Role-based access control** at two levels:
- **System roles**: Admin, Manager, Member, Viewer
- **Workspace roles**: Owner, Admin, Member, Viewer

**Invitation system** — Invite team members via email with token-based acceptance flow and role assignment.

**Audit logging** — Every action (create, update, delete, share, invite) is recorded with user, timestamp, and metadata for compliance and accountability.

---

## Key Differentiators

| Feature | vs. Bitly / Rebrandly | vs. Manual UTM Spreadsheets |
|---------|----------------------|-----------------------------|
| Self-hosted, data stays internal | Cloud-hosted, data on third-party servers | N/A |
| Campaign-centric organization | Link-centric only | No organization |
| Batch creation for KOL/channel variants | One-by-one creation | Error-prone copy-paste |
| UTM templates with validation | No UTM workflow | Manual construction |
| Workspace-level team isolation | Single team account | No collaboration |
| Full click analytics with UTM cross-analysis | Basic click counts | Requires GA setup |
| Bilingual (EN / ZH-TW) | English only | N/A |

---

## Technical Architecture

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 16 (App Router), React, Tailwind CSS 4 |
| Backend | Next.js API Routes (serverless) |
| Database | PostgreSQL + Prisma ORM |
| Authentication | NextAuth.js v5 with Google OAuth |
| Charts | Recharts |
| Internationalization | next-intl (English + Traditional Chinese) |
| Validation | Zod |
| Geolocation | geoip-lite |

**Deployment**: Supports Zeabur (recommended), Vercel, Railway, Docker, or any Node.js hosting platform.

---

## Information Architecture

```
Dashboard
├── Stats overview (clicks, visitors, links, active links)
├── Top Campaigns (by clicks)
├── Top Links (by clicks)
└── Recent Links

Links
├── Search + filter (status, campaign, tag, sort)
├── Batch actions (activate, pause, archive, delete)
├── Create new link (with UTM builder + campaign association)
└── Batch create (multi-content variant generation)

Campaigns
├── Campaign list with stats (links, clicks, CTR)
└── Click-through to filtered Links view

Analytics
├── Date range selector (24h / 7d / 30d / 90d / custom)
├── Campaign filter → Link filter (cascading)
├── Summary cards (clicks, unique visitors, trend)
├── Clicks over time chart
├── Distribution charts (device, browser, OS, country)
├── Referrer & hourly heatmap
├── UTM breakdown (campaign, source, medium, cross-tables)
└── Top performing links

Templates
├── Template list
└── Create / edit templates

Settings
├── Profile management
├── Workspace settings
└── Member management & invitations
```

---

## Data Model (Simplified)

```
Workspace ──┬── WorkspaceMember ── User
            ├── ShortLink ──┬── Click
            │               ├── Tag (many-to-many)
            │               └── ShareToken
            ├── Campaign ──── CampaignTag
            ├── UTMTemplate
            └── AuditLog
```

---

## Security & Privacy

- **Google OAuth** — Only authorized email domains can log in (configurable)
- **IP anonymization** — Click tracking uses salted hashing, no raw IPs stored
- **Rate limiting** — Redirect and share endpoints are rate-limited
- **Bot detection** — Known bot user agents are filtered from click analytics
- **Click deduplication** — Same visitor clicks are deduplicated within a time window
- **Soft delete** — Deleted links are retained for audit purposes
- **Password-protected sharing** — Public reports require password verification
- **Role-based access** — Strict permission checks on all API endpoints

---

## Localization

Full bilingual support (English and Traditional Chinese) covering all UI elements, form labels, error messages, and navigation. Language can be switched at any time via the settings page.

---

## Status

**Production-ready** — Actively deployed and used internally.
