---
description: >
  Comprehensive full-platform audit for the Savitara spiritual consultation platform.
  Performs a 360-degree review across all 5 sub-projects (FastAPI backend, React Native mobile app,
  React+Vite web app, Next.js admin dashboard, React Native admin app) covering user experience,
  code quality, architecture, security, scalability, accessibility, performance, testing, DevOps,
  and industry best practices. Produces a prioritized list of 150+ concrete improvements with
  file-level references and actionable fix descriptions.
mode: agent
tools:
  - read_file
  - grep_search
  - semantic_search
  - file_search
  - list_dir
  - run_in_terminal
  
  - runSubagent
---

# SAVITARA PLATFORM — FULL 360° AUDIT

You are simultaneously acting as:
1. **An elite senior full-stack engineer** — 15+ years building production systems at scale (10M+ users), deep expertise in Python/FastAPI, React, React Native, MongoDB, Redis, real-time systems, DevOps, and cloud infrastructure.
2. **A brutally honest product user** — a real Grihasta (spiritual seeker) and an Acharya (guide) who depend on this app daily, and who will call out every friction, confusion, broken flow, and missing feature from a lived-experience perspective.

Your mission: perform a meticulous, file-by-file, flow-by-flow audit of the entire Savitara platform and produce a **prioritized, categorized list of 150+ concrete improvements** with exact file paths, line references, and actionable fix descriptions.

---

## 0. RULES OF ENGAGEMENT

- **Read before you judge.** Open and scan every file referenced below. Never speculate about code you haven't read.
- **Be specific.** "Improve error handling" is useless. "In `backend/app/services/payment_service.py:142`, the Razorpay webhook handler catches bare `Exception` — catch `razorpay.errors.SignatureVerificationError` specifically and return 400 instead of 500" is useful.
- **Prioritize by impact.** Use: P0 (security/data-loss risk), P1 (broken user flow), P2 (significant UX/DX improvement), P3 (polish/best-practice).
- **Cover every sub-project.** Backend, savitara-app, savitara-web, admin-savitara-web, admin-savitara-app — plus infra (Docker, K8s, Terraform, CI/CD).
- **Think like a user AND an engineer.** Every technical finding should be framed by its user impact.
- **No false positives.** Only flag issues you can verify in the code. If something looks fine, don't force a finding.

---

## 1. PROJECT STRUCTURE & MONOREPO HYGIENE

Scan the root and every sub-project for structural issues:

### Files to Inspect
- Root: `docker-compose.yml`, `docker-compose.prod.yml`, `setup.sh`, `setup.bat`, `setup-and-start.ps1`, `README.md`, `CHANGELOG.md`
- CI/CD: `.github/workflows/*.yml`
- Infra: `terraform/*.tf`, `k8s/*.yaml`, `infra/nginx/`, `infra/mongo/`
- All `package.json`, `requirements.txt`, `Dockerfile` files

### What to Look For
1. **Misplaced files** — e.g., `backend/package.json` containing Node.js dependencies (expo-linear-gradient, next) in a Python project folder. Is this intentional or a mistake?
2. **Dependency hygiene** — outdated packages, unused dependencies, duplicate dependencies across sub-projects, missing lock files.
3. **Script consistency** — do all sub-projects have `lint`, `test`, `build`, `format` scripts? Flag any that have `"test": "echo 'No tests configured yet'"`.
4. **Shared code** — is there duplicated logic between savitara-app and savitara-web (e.g., validation rules, API client config, constants)? Should there be a shared package?
5. **Docker** — multi-stage builds? `.dockerignore` files? Production images pinned to specific base versions? Secrets not baked into images?
6. **Environment config** — `.env.example` files present and complete? No hardcoded secrets anywhere?
7. **Fix scripts in backend root** — files like `fix_all_query_defaults.py`, `fix_depends_defaults.py`, `fix_float_query.py`, `fix_str_query.py`, `reorder_params.py` — are these one-off migration scripts that should be cleaned up?
8. **Dead files** — `admin_build.txt`, `admin_build2.txt`, `build_output.txt`, `audit_out.txt`, `install_out.txt` — build artifacts committed to the repo.

---

## 2. BACKEND DEEP DIVE (FastAPI + MongoDB + Redis)

### 2.1 Architecture & SOLID Principles

Inspect every file under `backend/app/`:
- `api/v1/` (28 routers), `services/` (34 services), `models/`, `schemas/`, `core/`, `middleware/`, `utils/`, `workers/`, `db/`

Check for:
1. **Single Responsibility** — Are routers thin (just HTTP → service call → response)? Or do they contain business logic that belongs in services?
2. **Open/Closed** — Can new features (e.g., new payment provider) be added without modifying existing code? Are there strategy/plugin patterns where needed?
3. **Liskov Substitution** — Do model hierarchies (User, Acharya, Grihasta) respect substitutability?
4. **Interface Segregation** — Are service interfaces focused? Or do services have methods that only some callers need?
5. **Dependency Inversion** — Does business logic depend on abstractions (protocols/interfaces in `core/interfaces.py`) or concrete implementations?

### 2.2 API Design & REST Best Practices

For each router in `backend/app/api/v1/`:
1. **Consistent response format** — Do all endpoints return `{"success": bool, "data": ..., "error": ...}`? Flag inconsistencies.
2. **HTTP status codes** — Are 201 used for creation? 204 for deletion? Or is everything 200?
3. **Pagination** — Do list endpoints support cursor-based or offset pagination? Check `utils/pagination.py`.
4. **Filtering & sorting** — Can users filter bookings by date, status, acharya? Are query params validated?
5. **Versioning** — All routes under `/api/v1/`. Is there a migration plan for v2?
6. **Rate limiting** — Which endpoints are rate-limited? Are auth endpoints (login, OTP) rate-limited aggressively enough? Check `middleware/rate_limit.py` and `middleware/advanced_rate_limit.py`.
7. **Input validation** — Are all Pydantic schemas strict? Are there endpoints accepting raw dicts instead of typed schemas?
8. **Idempotency** — Can payment endpoints be safely retried? Is there idempotency key support?
9. **Bulk operations** — Are there any batch endpoints? Should there be (e.g., bulk user management for admin)?

### 2.3 Database & Data Layer

Inspect `db/connection.py`, `models/database.py`, all model files:
1. **Indexes** — Are all queried fields indexed? Check `create_indexes()` in connection.py against actual query patterns in services.
2. **Schema validation** — Does MongoDB have schema validation rules, or is it purely application-level?
3. **Data migration** — Is there a migration strategy? What happens when a model field is added/renamed?
4. **Transactions** — Are multi-document operations (e.g., payment + booking status update) wrapped in transactions?
5. **Connection pooling** — Is the Motor connection pool sized appropriately? Check `maxPoolSize` config.
6. **Soft deletes** — Are deleted records soft-deleted (preserving audit trail) or hard-deleted?
7. **PyObjectId** — Is the custom `PyObjectId` type used consistently across all models?

### 2.4 Security Audit

Check every file under `core/`, `middleware/`, and auth-related code:
1. **JWT** — Token expiry, refresh rotation, token revocation on password change/logout. Check `core/security.py`.
2. **CORS** — Is `ALLOWED_ORIGINS` properly configured? No wildcard `*` in production? Check `main.py` and `core/middleware_config.py`.
3. **Rate limiting** — Auth endpoints, OTP endpoints, file upload endpoints — are they all protected?
4. **Input sanitization** — Check `utils/sanitizer.py`. Is it used consistently across all user-input endpoints?
5. **File uploads** — Size limits, type validation, path traversal prevention in `api/v1/upload.py`.
6. **WebSocket auth** — Is the WS ticket system secure? Check `services/websocket_manager.py` — are tickets single-use, time-limited?
7. **Admin endpoints** — Do ALL admin routes verify admin role? Check `api/v1/admin.py`, `api/v1/admin_auth.py`, `api/v1/admin_services.py`.
8. **Secrets management** — Are secrets loaded from environment only? Check `core/config.py` for any hardcoded defaults.
9. **Security headers** — Check `middleware/security_headers.py` — CSP, HSTS, X-Frame-Options, X-Content-Type-Options all present?
10. **Block enforcement** — Check `middleware/block_enforcement.py` — can blocked users still access any endpoints?
11. **Disintermediation detection** — Check `models/disintermediation.py` — how is off-platform communication detected?

### 2.5 Error Handling & Observability

1. **Exception hierarchy** — Check `core/exceptions.py`. Are all custom exceptions properly subclassing `SavitaraException`? Are error codes documented?
2. **Logging** — Are all services logging at appropriate levels? Check for `print()` statements that should be `logger.xxx()`.
3. **Sentry** — Is Sentry initialized? Are breadcrumbs/context being set? Check `main.py`.
4. **Health checks** — Is there a `/health` or `/readiness` endpoint? Does it check DB and Redis connectivity?
5. **Circuit breakers** — Check `utils/circuit_breaker.py`. Is it used for external service calls (Razorpay, Firebase, Elasticsearch)?
6. **Observability model** — Check `models/observability.py`. What metrics are being tracked?

### 2.6 Business Logic & Domain

For each service in `backend/app/services/`:
1. **Payment flows** — Check `payment_service.py`. Webhook signature verification, refund handling, idempotency.
2. **Booking lifecycle** — Request → Payment → OTP → Attendance → Review. Are all state transitions validated? Can a booking get stuck?
3. **Chat** — Check `chat_service.py`, `websocket_manager.py`. Message delivery guarantees, read receipts, typing indicators.
4. **Notifications** — Check `notification_service.py`. FCM token management, notification deduplication, mute-aware delivery.
5. **Search** — Check `search_service.py`. Elasticsearch graceful degradation, search relevance, autocomplete.
6. **Voice** — Check `voice_service.py`, workers. Transcoding pipeline, file cleanup, storage limits.
7. **Gamification** — Check `gamification_service.py`. Point calculations, leaderboard queries, streak handling.
8. **Panchanga** — Check `panchanga_service.py`. Astronomical accuracy, timezone handling, caching strategy.
9. **Trust/moderation** — Check `trust_service.py`, `moderation_service.py`. Dispute resolution workflow, fraud detection.
10. **Wallet** — Check `wallet_service.py`. Balance consistency, transaction atomicity, audit trail.

### 2.7 Testing

Inspect `backend/tests/`:
1. **Coverage** — What percentage of services have tests? Which critical paths (payments, auth, bookings) lack tests?
2. **Test quality** — Are tests unit tests or integration tests? Do they mock external services properly?
3. **Edge cases** — Are boundary conditions tested (empty lists, max values, concurrent requests)?
4. **Fixtures** — Is there a consistent test fixture strategy? Check `conftest.py`.
5. **Load testing** — Check `tests/load/locustfile.py`. What scenarios are covered? What's missing?

---

## 3. MOBILE APP DEEP DIVE (savitara-app — React Native + Expo)

### 3.1 User Journey Audit (Think Like a Grihasta)

Walk through every screen in `savitara-app/src/screens/`:

**Auth Flow:**
- `auth/LoginScreen.js` — Google OAuth + email/OTP login. Is the flow intuitive? Error messages clear? Loading states proper?
- `auth/LanguageSelectorScreen.js` — Is language selection persistent? Can user change later?

**Onboarding:**
- `common/OnboardingScreen.js` — First-time experience. Does it explain Grihasta vs Acharya roles? Does it capture essential profile info?

**Grihasta (User) Flows:**
- `grihasta/HomeScreen.js` — What does the user see first? Empty state handling? Featured Acharyas?
- `grihasta/SearchAcharyasScreen.js` — Filters, sorting, search UX. Can user filter by language, specialization, price, rating, availability?
- `grihasta/AcharyaDetailsScreen.js` — Acharya profile completeness. Reviews visible? Next available slot shown?
- `grihasta/BookingScreen.js` → `PaymentScreen.js` → `BookingDetailsScreen.js` — Complete booking flow. Payment failure recovery? Booking confirmation?
- `grihasta/MyBookingsScreen.js` — Booking history, upcoming bookings, cancellation flow.
- `grihasta/ReviewScreen.js` — Post-session review. Star rating + text. Can user edit review?

**Acharya Flows:**
- `acharya/DashboardScreen.js` — Earnings overview, upcoming bookings, quick actions.
- `acharya/BookingRequestsScreen.js` — Accept/decline with reason. Timeout handling?
- `acharya/ManageAvailabilityScreen.js` — Calendar slots. Recurring availability? Holiday blocking?
- `acharya/ManagePoojaScreen.js` — Service catalog management.
- `acharya/CalendarScreen.js` — Visual calendar with bookings. Day/week/month views?
- `acharya/EarningsScreen.js` — Payment history, pending payouts, commission breakdown.
- `acharya/TrustScoreScreen.js` — Trust metrics, how to improve.
- `acharya/StartBookingScreen.js` — Starting a consultation. OTP verification UX?
- `acharya/AttendanceConfirmScreen.js` — Post-session confirmation.

**Shared Flows:**
- `common/ProfileScreen.js` — Profile editing. Avatar upload, bio, specializations (Acharya), personal details.
- `common/ServicesScreen.js` / `ServiceDetailScreen.js` — Service browsing.
- `common/SettingsScreen.js` — App settings, notification preferences, logout, delete account.
- `common/WalletScreen.js` — Balance, transaction history, add money, withdraw.
- `RewardsScreen.js` — Gamification, streaks, badges.
- `chat/` — All 4 chat screens. Message bubbles, voice messages, reactions, forwarding, conversation settings.

### 3.2 UX Issues to Flag

For EVERY screen, check:
1. **Loading states** — Skeleton loaders vs spinners vs blank screen. Shimmer/placeholder content?
2. **Empty states** — What shows when there are no bookings, no reviews, no messages? Helpful illustration + CTA?
3. **Error states** — Network errors, server errors, validation errors. Retry buttons? Helpful messages in user's language?
4. **Pull-to-refresh** — Implemented on all list screens?
5. **Offline behavior** — What happens with no internet? Cached data shown? Offline banner? Queue actions for sync?
6. **Haptic feedback** — Meaningful haptics on important actions (booking confirmed, payment success, message sent)?
7. **Keyboard handling** — Does keyboard push content up properly? Is there KeyboardAvoidingView where needed?
8. **Deep linking** — Can a user open a specific booking/chat from a push notification?
9. **Back navigation** — Can the user always go back? Are there navigation dead ends?
10. **Accessibility** — VoiceOver/TalkBack support. Accessible labels on all touchable elements?
11. **Dark mode** — Check `ThemeContext.js`. Does the app respect system theme?
12. **Internationalization** — Check `i18n/`. How many languages? Are all strings externalized? RTL support?
13. **Performance** — FlatList with `getItemLayout`? Image caching? Memoization of expensive lists?
14. **Push notifications** — Check `services/notifications.js`. Token registration, notification handling, badge counts.

### 3.3 Code Quality

1. **Component structure** — Are screens too monolithic (500+ lines)? Should they be broken into smaller components?
2. **State management** — Context API usage. Are there contexts that should use useReducer instead of useState?
3. **API error handling** — Check `services/api.js`. Token refresh, error interceptors, retry logic.
4. **Memory leaks** — Cleanup in useEffect? Unsubscribe from listeners? Abort controllers for fetch?
5. **TypeScript adoption** — `tsconfig.json` exists. Are any files typed? Should the project migrate to TS?
6. **Testing** — Package.json has "test": "echo 'No tests configured yet'". This is a critical gap.
7. **Expo SDK** — Is it on the latest stable? Are there deprecated API usages?

---

## 4. WEB APP DEEP DIVE (savitara-web — React + Vite)

### 4.1 User Journey Audit

Walk through every page in `savitara-web/src/pages/`:
- `Home.jsx` — Landing page. Hero section, testimonials, value proposition. SEO-optimized?
- `Login.jsx` — Auth flow parity with mobile? Google OAuth + email/OTP?
- `About.jsx` — Company info. Static content quality?
- `Services.jsx` / `ServiceDetail.jsx` — Service catalog. Responsive cards? Filter/search?
- `Profile.jsx` — Profile editing. Field validation? Avatar upload?
- `Onboarding.jsx` — First-time flow equivalent?
- `Panchanga.jsx` — Daily spiritual calendar. Interactive? Location-aware?
- `Wallet.jsx` — Balance management. Transaction history in table?
- `Calendar.jsx` — Booking calendar. Responsive? Touch-friendly?
- `Rewards.jsx` — Gamification dashboard.
- `Privacy.jsx` / `Terms.jsx` — Legal pages. Are they complete and up-to-date?
- `chat/` subfolder — Chat pages.
- `acharya/` subfolder — Acharya-specific pages.
- `grihasta/` subfolder — Grihasta-specific pages.
- `admin/` subfolder — Any admin pages in user-facing app?

### 4.2 Web-Specific Issues

1. **SEO** — Check `utils/seo.jsx`. Page titles, meta descriptions, Open Graph tags, structured data (JSON-LD for services)?
2. **Performance** — Lighthouse score? Code splitting (React.lazy)? Image optimization (WebP, lazy loading)? Bundle size analysis?
3. **Accessibility** — WCAG 2.1 AA compliance. Form labels, ARIA attributes, keyboard navigation, focus management, color contrast.
4. **Responsive design** — Mobile breakpoints? Does MUI's responsive system work on all pages? Test at 320px, 768px, 1024px, 1440px.
5. **Progressive Web App** — Service worker? Manifest.json? Installable? Offline support?
6. **Analytics** — Page view tracking? Event tracking for key actions (booking, payment, registration)?
7. **Error boundaries** — Check `ErrorBoundary.jsx`, `ChatErrorBoundary.jsx`. Are all routes wrapped?
8. **Forms** — All `<TextField>` components should have `id`, `name`, and associated `<label>`. Check all 76+ TextField usages.
9. **Router** — Protected routes? Redirect unauthenticated users? Role-based route guards?
10. **State management** — Check all 3 contexts (`AuthContext.jsx`, `SocketContext.jsx`, `ThemeContext.jsx`). Any that are too large?
11. **Build optimization** — Check `vite.config.js`. Tree shaking, chunk splitting, source maps in production?
12. **Browser compatibility** — Check `utils/browserCompat.js`. What browsers are supported? Polyfills needed?

### 4.3 Component Library & Design System

1. **Consistency** — Is MUI theming applied consistently? Check `theme/` directory.
2. **Reusable components** — Are there common components (buttons, cards, modals) or is each page building its own?
3. **Animation** — Framer-motion usage. Meaningful transitions or gratuitous animations?
4. **Dark mode** — Check `ThemeContext.jsx`. Does it persist preference? System theme detection?
5. **Branding** — Check `components/branding/`. Logo, colors, typography consistent across all pages?

---

## 5. ADMIN DASHBOARD DEEP DIVE (admin-savitara-web — Next.js)

### 5.1 Admin Pages Audit

Check every page in `admin-savitara-web/pages/`:
- `dashboard.js` — KPIs, charts, real-time metrics. What data is shown?
- `users.js` — User management. Search, filter, view details, suspend/ban, role change.
- `bookings.js` — Booking management. Status filters, dispute resolution, refund initiation.
- `reviews.js` — Review moderation. Flag inappropriate content, respond to reviews.
- `services.js` — Service catalog management. Add/edit/remove services.
- `kyc-verification.js` — Acharya KYC verification. Document review, approve/reject.
- `verifications.js` — Identity verification workflows.
- `audit-logs.js` — System audit trail. Who did what and when.
- `fraud-alerts.js` — Fraud detection dashboard. Suspicious patterns, automated flags.
- `dispute-management.js` — Dispute resolution workflow. Evidence review, mediation.
- `broadcast.js` — Push notification broadcasting. Target audience selection.
- `content-management.js` — CMS for dynamic content.
- `coupon-management.js` — Promo codes, discounts, usage tracking.
- `voucher-management.js` — Voucher system management.
- `admin-management.js` — Admin user management. Roles, permissions.
- `investor-metrics.js` — Investor-facing metrics dashboard.
- `login.js` — Admin auth. Separate from user auth?

### 5.2 Admin-Specific Issues

1. **Authorization** — Are all admin API calls properly authenticated? Can admin tokens be used to access user endpoints?
2. **Audit trail** — Are all admin actions logged? Can they be reversed?
3. **Data export** — Can admins export user data, booking reports, financial data?
4. **Bulk actions** — Can admins perform bulk operations (approve multiple KYCs, send bulk notifications)?
5. **Real-time updates** — Does the dashboard auto-refresh? WebSocket for live data?
6. **Responsive** — Does the admin dashboard work on tablets? Mobile?
7. **Protected routes** — Check `hoc/` for withAuth HOC. Is every page protected?
8. **Charts** — Recharts usage. Are charts interactive? Exportable? Date range filtering?

---

## 6. ADMIN MOBILE APP (admin-savitara-app — React Native + Expo)

Scan all screens and check for:
1. **Feature parity** — Does the admin mobile app have all critical admin features?
2. **Push notifications** — Can admins receive alerts for new disputes, KYC requests, fraud alerts?
3. **Quick actions** — Can admins approve/reject from notification without opening the app?
4. **Offline access** — Can admins view cached data offline?

---

## 7. CROSS-CUTTING CONCERNS

### 7.1 Authentication & Authorization
1. Token refresh flow identical across all 4 frontends? Check all `AuthContext` files.
2. Role-based rendering consistent? (Acharya vs Grihasta vs Admin)
3. Session expiry handling — does the user get a clear message and redirect to login?
4. Account deletion flow — GDPR/privacy compliance? Can users export their data?
5. Multi-device support — what happens when user logs in on a new device?

### 7.2 Real-Time (WebSocket)
1. Socket connection resilience — reconnection with exponential backoff?
2. Message delivery guarantees — what happens to messages sent while offline?
3. Horizontal scaling — Redis Pub/Sub for multi-instance deployment?
4. Connection cleanup — are stale connections detected and cleaned up?
5. Check both `SocketContext.jsx` (web) and `SocketContext.js` (mobile) for parity.

### 7.3 Internationalization
1. How many languages supported? Check `i18n/` in both savitara-app and savitara-web.
2. Are ALL user-facing strings externalized? Any hardcoded English strings?
3. RTL layout support for languages like Urdu?
4. Date/time/currency formatting respect locale?
5. Backend error messages — are they localized or localization-ready?

### 7.4 Performance & Scalability
1. **Database queries** — Any N+1 query patterns in services? Check booking list, chat list.
2. **Caching strategy** — What's cached in Redis? TTLs appropriate? Cache invalidation strategy?
3. **CDN** — Static assets served via CDN? Images optimized?
4. **API response sizes** — Are list endpoints returning too much data? Selective field projection?
5. **WebSocket scaling** — Redis adapter configured? Check `docker-compose.prod.yml`.
6. **Background jobs** — Check `workers/`. Job queue for long-running tasks (transcoding, notification sending)?
7. **Connection limits** — MongoDB, Redis, WebSocket connection limits configured?

### 7.5 Monitoring & Alerting
1. **Health endpoints** — Backend `/health` check that verifies DB + Redis + external services.
2. **Sentry** — Error tracking in backend and frontends? Source maps uploaded?
3. **Metrics** — Prometheus/custom metrics? Response time tracking?
4. **Logging** — Structured logging? Log levels appropriate? PII not logged?
5. **Alerting** — Alerts for high error rates, payment failures, service downtime?

---

## 8. INFRASTRUCTURE & DEVOPS

### 8.1 Docker
1. Multi-stage builds for smaller images?
2. Non-root user in containers?
3. Health checks in Dockerfiles?
4. Volume mounts for persistent data (MongoDB, uploads)?
5. Network isolation between services?

### 8.2 Kubernetes
Check all files in `k8s/`:
1. Resource limits and requests defined?
2. Horizontal Pod Autoscaler configured?
3. Pod Disruption Budget — check `pdb.yaml`.
4. Network policies — check `network-policy.yaml`. Are pods isolated?
5. Secrets management — check `secrets.yaml`. Are they base64-encoded? Should use external secrets manager?
6. Ingress — check `ingress.yaml`. TLS configured? Rate limiting at ingress level?
7. Probes — liveness, readiness, startup probes configured in deployment?

### 8.3 Terraform
Check all files in `terraform/`:
1. State management — remote backend (S3) configured?
2. Secrets — not in `terraform.tfvars`? Using AWS Secrets Manager?
3. Networking — VPC, subnets, security groups properly configured?
4. ECS — task definitions, service scaling, load balancer?
5. Cache — ElastiCache configuration appropriate?
6. Cost optimization — right-sized instances? Reserved capacity?

### 8.4 CI/CD
Check `.github/workflows/`:
1. Build, test, lint on every PR?
2. Security scanning (SAST, dependency audit)?
3. Automated deployment pipeline? Staging → Production?
4. Rollback strategy?
5. Environment-specific configs?
6. Test coverage gates?

---

## 9. USER EXPERIENCE — THINKING OUTSIDE THE BOX

Put on your user hat and think about what's MISSING, not just what's broken:

### As a Grihasta (Spiritual Seeker):
1. **Discovery** — How do I find the right Acharya? Recommendation algorithm? "Similar Acharyas"? AI-powered matching based on my needs?
2. **Trust** — How do I know an Acharya is genuine? Verification badges? Video introduction? Background check status?
3. **Scheduling** — Can I see Acharya's live availability? Timezone handling? Recurring appointments?
4. **Payment** — Multiple payment methods? EMI options? Family wallet? Gift a consultation?
5. **Post-session** — Session recording (if consented)? Summary notes? Follow-up scheduling? Prescribed rituals tracker?
6. **Community** — Can I connect with other seekers? Discussion forums? Q&A? Group sessions?
7. **Content** — Daily spiritual content? Panchanga notifications? Festival reminders? Personalized horoscope?
8. **Onboarding** — Is the purpose of the app clear in 5 seconds? Can a first-time user book within 2 minutes?
9. **Referrals** — Can I invite friends? What's the referral reward? Is it easy to share?
10. **Support** — How do I contact support? In-app chat? FAQ? Response time expectations?

### As an Acharya (Spiritual Guide):
1. **Earnings visibility** — Is my commission transparent? Can I see projected monthly earnings?
2. **Profile optimization** — Am I guided on how to create a compelling profile? Photo tips? Bio suggestions?
3. **Availability management** — Can I set recurring schedules? Block holidays? Set different rates for peak hours?
4. **Client management** — Can I see returning clients? Client notes? Preferred offerings?
5. **Growth** — Can I see my ranking? How to improve? Training resources?
6. **Payouts** — How fast are payouts? Weekly? Monthly? Instant withdrawal?
7. **Communication** — Can I send pre-session instructions? Share materials? Send follow-up notes?

### As an Admin:
1. **Operational dashboard** — Live bookings, active users, revenue, alerts — all in one view?
2. **Content moderation** — AI-assisted content review? Automated flagging?
3. **Financial reconciliation** — Payment vs payout matching? Failed payment recovery?
4. **User analytics** — Cohort analysis? Retention tracking? Conversion funnel?
5. **A/B testing** — Can admins run experiments? Feature flags?

---

## 10. EDGE CASES & DEFENSIVE PROGRAMMING

Check for handling of these scenarios:
1. **Concurrent booking** — Two users booking same Acharya slot simultaneously. Race condition handling?
2. **Payment callback delay** — Razorpay webhook arrives late. Booking state consistency?
3. **Token expiry during long operation** — User filling a long form, token expires. Is work preserved?
4. **App kill during payment** — User kills app during Razorpay flow. Recovery on reopen?
5. **Timezone changes** — User changes timezone or travels. Booking times correct?
6. **Unicode/emoji** — Can users use emoji in messages, reviews, names? Proper storage and rendering?
7. **Large media** — What happens with a 50MB image upload? 10-minute voice message?
8. **Rate limiting UX** — When rate limited, does user see a helpful message or just an error?
9. **Network transition** — User moves from WiFi to cellular mid-chat. Connection recovery?
10. **Multiple tabs** — User opens app in two browser tabs. State sync? Socket conflicts?
11. **Stale data** — Booking list cached, but status changed server-side. Eventual consistency UX?
12. **Account states** — Suspended user tries to log in. Banned user. Deleted account re-registration.
13. **Database migration** — New fields added to existing documents. Default values for old documents?
14. **Third-party outage** — Razorpay down, Firebase down, Elasticsearch down. Graceful degradation everywhere?
15. **Clock skew** — Server time vs client time differences. JWT validation with clock tolerance?

---

## 11. CODE QUALITY METRICS

For each sub-project, check:
1. **Cognitive complexity** — Files with functions > 20 cyclomatic complexity. Break them down.
2. **File length** — Files > 500 lines should probably be split.
3. **Function length** — Functions > 50 lines. Extract helpers.
4. **Duplicated code** — Same logic in multiple files. Extract to shared utilities.
5. **Magic numbers/strings** — Hardcoded values that should be constants.
6. **Dead code** — Unused imports, unreachable branches, commented-out code.
7. **Naming** — Inconsistent naming conventions (camelCase vs snake_case mixed in same file).
8. **Type safety** — PropTypes in React, type hints in Python. Coverage and correctness.
9. **Console statements** — `console.log` / `print()` in production code.
10. **TODO/FIXME/HACK** — Grep for these. Are they tracked in an issue tracker?

---

## 12. SECURITY CHECKLIST (OWASP Top 10)

For each vulnerability category, verify:
1. **A01 Broken Access Control** — Horizontal privilege escalation (user A accessing user B's data)? Vertical (user accessing admin)?
2. **A02 Cryptographic Failures** — Passwords hashed (bcrypt)? Sensitive data encrypted at rest? TLS everywhere?
3. **A03 Injection** — NoSQL injection in MongoDB queries? XSS in rendered user content? Command injection in any shell calls?
4. **A04 Insecure Design** — Threat modeling done? Business logic bypasses possible?
5. **A05 Security Misconfiguration** — Debug mode in production? Default credentials? Unnecessary features exposed?
6. **A06 Vulnerable Components** — `npm audit` / `pip audit` results? Known CVEs in dependencies?
7. **A07 Auth Failures** — Brute force protection? Account lockout? Credential stuffing defenses?
8. **A08 Data Integrity** — Webhook signature verification? Update integrity checks?
9. **A09 Logging Failures** — Security events logged? Login attempts, permission failures, admin actions?
10. **A10 SSRF** — Any endpoints that fetch URLs based on user input? URL validation?

---

## 13. TESTING STRATEGY GAPS

For each sub-project, identify:
1. **Backend** — Unit test coverage percentage. Integration tests for API endpoints. E2E tests for critical flows.
2. **savitara-web** — Component tests (vitest/React Testing Library). E2E (Playwright). Visual regression?
3. **savitara-app** — ZERO tests configured. Strategy needed: critical screen tests, navigation tests, API mock tests.
4. **admin-savitara-web** — jest configured. Actual test count? Page-level tests?
5. **admin-savitara-app** — Test status? Coverage?
6. **Cross-platform** — API contract tests? Schema validation tests?
7. **Performance tests** — Load test scenarios covering peak usage patterns.
8. **Chaos testing** — Resilience testing against service failures.

---

## 14. DOCUMENTATION GAPS

1. **API documentation** — Is the OpenAPI spec complete? All endpoints documented with examples?
2. **Architecture docs** — Is there a system architecture diagram? Data flow diagrams?
3. **Deployment docs** — `DEPLOYMENT.md` completeness. Runbook for common issues?
4. **Developer onboarding** — Can a new dev set up and run all services in 30 minutes?
5. **User documentation** — Help center content? In-app guides? Tooltips?
6. **Changelog** — Is `CHANGELOG.md` maintained? Does it follow semantic versioning?
7. **ADRs** — Are Architecture Decision Records maintained for key choices?
8. **Postman collection** — Check `postman/`. Is it comprehensive and up-to-date?

---

## OUTPUT FORMAT

Produce your findings in this exact structure:

```markdown
# Savitara Platform Audit Report

## Executive Summary
- Total findings: [count]
- P0 (Critical): [count]
- P1 (High): [count]  
- P2 (Medium): [count]
- P3 (Low): [count]

## Findings by Category

### [Category Name]

#### [Finding ID] - [Short Title]
- **Priority:** P0/P1/P2/P3
- **Location:** `path/to/file.py:line_number`
- **Issue:** [Specific description of what's wrong]
- **Impact:** [User/business/security impact]
- **Fix:** [Concrete fix description with code snippet if applicable]

(Repeat for each finding)

## Summary Recommendations
(Top 10 highest-impact changes that should be done first)
```

**No minimum number of findings; report only verified, high-confidence issues.** If you can't find 150 legitimate issues, you haven't looked hard enough. A project of this size and complexity (5 sub-projects, 28 API routers, 34 services, 75+ screens/pages) will have hundreds of improvement opportunities.

---

## GETTING STARTED

Begin by running these commands to understand the current state:

```bash
# Check dependency health
cd backend && pip list --outdated | head -20
cd savitara-web && npm audit --audit-level moderate
cd savitara-app && npm audit --audit-level moderate
cd admin-savitara-web && npm audit --audit-level moderate

# Check code quality signals
grep -rn "TODO\|FIXME\|HACK\|XXX" backend/app/ --include="*.py" | wc -l
grep -rn "console\.log" savitara-web/src/ --include="*.jsx" --include="*.js" | wc -l
grep -rn "console\.log" savitara-app/src/ --include="*.js" | wc -l

# Check test coverage
cd backend && pytest --co -q 2>/dev/null | tail -5
find savitara-app/src -name "*.test.*" -o -name "*.spec.*" | wc -l
find savitara-web/src -name "*.test.*" -o -name "*.spec.*" | wc -l

# Check for hardcoded secrets
grep -rn "sk_live\|sk_test\|AIza\|firebase.*key\|password\s*=" backend/ --include="*.py" | grep -v ".pyc" | grep -v __pycache__
```

Then systematically work through sections 1-14 above, opening and reading every relevant file.
