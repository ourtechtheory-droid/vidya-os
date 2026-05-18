# VidyaOS — AI School Operating System (PRD)

> **Status:** MVP shipped · Iteration 1 · 09 Feb 2026
> **Stack:** React 19 + FastAPI + MongoDB · GPT-5.2 via Emergent Universal LLM Key

---

## 1. Original Problem Statement
Build a complete next-generation **AI-powered School Operating System** (ERP + Intelligence Platform) for the Indian education ecosystem (CBSE / ICSE / State boards / Junior Colleges). Apple-level UI/UX, enterprise-grade ERP, modern AI infrastructure. 25 modules requested, multi-role, multilingual.

User chose defaults via `/proceed`:
- Stack: React + FastAPI + MongoDB
- MVP modules: Auth + Dashboards + Student Profile + Attendance + Exams/Report Cards + Fees + AI Teacher + AI Parent Chatbot + Insights + Circulars
- AI: GPT-5.2 with Emergent Universal LLM Key
- Auth: JWT-based custom auth (5 roles)
- Integrations: Payments / WhatsApp / SMS — **MOCKED** for MVP

## 2. Personas
| Role | Capabilities |
|---|---|
| Super Admin | Full platform access, multi-school view (architecturally ready) |
| School Admin | Manage school: students, fees, exams, circulars, AI insights |
| Teacher | Mark attendance, enter marks, AI lesson plans / question papers, post circulars |
| Student | View own attendance, marks, fees, circulars, AI Saathi chat |
| Parent | View child's attendance/marks/fees, pay fees, AI Saathi chat |

## 3. Architecture
- **Backend** `/app/backend/server.py` — FastAPI; `/api/*` prefix; JWT bearer auth; bcrypt; Motor (async Mongo); idempotent auto-seed on startup
- **Frontend** `/app/frontend/src/` — React 19 + react-router-dom v7 + Tailwind 3 + Shadcn UI + Recharts + sonner
- **Design system** Outfit + Manrope fonts; palette = Terracotta `#E05236`, Navy `#0A1128`, Sage `#4A7C59`; "Tetris bento" landing + "Control Room grid" dashboard

## 4. What's Implemented (Feb 9, 2026)
### Backend (`/api`)
- `auth/register`, `auth/login`, `auth/me` (5 roles, bcrypt+JWT)
- `students` CRUD + `students/{id}` profile (attendance%, marks, fees joined)
- `attendance/mark` (idempotent), `attendance` (filterable)
- `exams`, `marks` (CRUD + upsert)
- `fees`, `fees/pay` (mock gateway returning receipt_no)
- `circulars` (audience-scoped)
- `dashboard/stats` (KPI counts, 14-day attendance trend, subject performance aggregate)
- `ai/teacher` (lesson plan / question paper / assignment / report comment)
- `ai/parent-chat` (context-aware: pulls children's attendance & fees)
- `ai/insights` (executive brief from live stats)
- `seed` (idempotent demo data: 5 users + 30 students + 14d attendance + 150 marks + 90 fees + 3 circulars)

### Frontend
- Landing page (Tetris-bento, glass nav, KPI tiles, modules grid, AI engine, CTA)
- Login (split-screen, 5 demo one-click accounts)
- Dashboard (role-aware KPIs, attendance area chart, subject bar chart, circulars, quick actions)
- Students list + filter + Student Profile (radar chart of subject mastery, family panel, fee ledger)
- Attendance (per-class roster, present/late/absent toggles, date picker, save)
- Exams & Report Cards (exam selector, top-5 leaderboard, ranks table with grades)
- Fees (KPI cards, paginated ledger, Pay-now modal with method selection)
- Circulars (cards grid, new-circular modal with audience targeting)
- AI Teacher Copilot (4-task selector, form, output panel with copy)
- AI Saathi Chatbot (parent/student conversational UI, suggested prompts, context-aware replies)
- AI Insights (one-click executive brief)

### Verified
27/27 backend tests · 9/9 critical frontend flows · 100% pass.

## 5. Mocked Integrations (highlight)
- **Payments**: `/api/fees/pay` returns a fake `receipt_no` — replace with Razorpay/Stripe webhook for production.
- **WhatsApp / SMS / Email**: not yet wired — circular module is in-app only.

## 6. Backlog (P0 → P2)
### P0 — production blockers when going live
- Real Razorpay/UPI payment gateway integration
- WhatsApp Business API + SMS provider for circulars/alerts
- Multi-school tenancy enforcement everywhere (query scoping by school_id)
- Audit logs + role-based access mid-tier (currently endpoint-level)

### P1 — feature breadth
- Timetable generator (AI-optimized)
- Transport (routes, GPS mock, route optimization)
- Hostel (room allocation, leave management)
- Library (issue/return, AI book recommendations)
- Biometric / RFID / face attendance adapters
- Hall ticket + ID card PDF generation
- Multilingual UI (i18n: Hindi, Telugu, Tamil, Kannada, Marathi, Bengali, Malayalam)
- Voice alerts + push notifications

### P2 — intelligence layer
- Dropout-risk ML model (currently rule-based / LLM-summary only)
- Mental-stress signal detection
- Cheating-pattern analysis on online exams
- Smart classroom + AR/VR module hooks
- Object storage for assignments/photos (use Emergent object-storage playbook)
- Mobile React Native app shells (Parent / Teacher / Student / Driver)

### Tech debt (from test report)
- Split `server.py` (731 lines) into per-module routers under `/app/backend/routes/`
- Replace native HTML date picker on Attendance page with Shadcn Calendar
- Set minHeight on Recharts containers to silence init warnings
- Make seed deterministic via `random.seed(42)` so test snapshots are stable

## 7. Demo Accounts
See `/app/memory/test_credentials.md` (all `Pass@1234`).
