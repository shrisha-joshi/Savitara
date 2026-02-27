# Savitara Platform — Comprehensive Code Review & Change Report

> **Generated**: 2025-01-XX  
> **Scope**: Full-stack audit — Backend (FastAPI), Web (React/Vite), Mobile (React Native/Expo), Infrastructure (Docker/K8s/Terraform)  
> **Standards Applied**: OWASP Top 10, SOLID Principles, SonarQube Rules, CWE/SANS, NIST SP 800-53

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Findings by Severity](#2-findings-by-severity)
3. [Backend — Core & Config](#3-backend--core--config)
4. [Backend — API Routes & Services](#4-backend--api-routes--services)
5. [Frontend Web (savitara-web)](#5-frontend-web-savitara-web)
6. [Mobile App (savitara-app)](#6-mobile-app-savitara-app)
7. [Infrastructure & DevOps](#7-infrastructure--devops)  
8. [Test Coverage Analysis](#8-test-coverage-analysis)
9. [Plan of Action](#9-plan-of-action)
10. [SonarQube Rule Mapping](#10-sonarqube-rule-mapping)

---

## 1. Executive Summary

| Metric | Value |
|--------|-------|
| Total Findings | **165+** |
| Blockers | **8** |
| Critical | **27** |
| Major | **64** |
| Minor | **66+** |
| Modules Scanned | Backend (24 API + 25 services + 5 middleware + 8 utils), Web (17 pages + components), Mobile (15+ screens + services), Infra (Docker, K8s, Terraform, Nginx) |
| Test Coverage (API) | 50% modules have _any_ test; 0% have adequate happy-path coverage |
| Security Test Coverage | **0%** — no security-specific test suite exists |

### Risk Heat Map

| Area | Risk Level | Key Issues |
|------|-----------|------------|
| **Payments/Wallet** | 🔴 CRITICAL | Double paise conversion, unverified wallet credits, missing ownership checks, floating-point currency |
| **Authentication** | 🔴 CRITICAL | Admin self-assignment, blocker TypeError, event-loop-blocking Google verify |
| **File Upload** | 🔴 CRITICAL | Unauthenticated endpoints, MIME spoofing, no rate limits |
| **Token Storage** | 🔴 CRITICAL | localStorage (web) / AsyncStorage (mobile) — plaintext, XSS-accessible |
| **WebSocket** | 🟠 HIGH | JWT in URL query string, no WSS enforcement, duplicate connections (mobile) |
| **Infrastructure** | 🟠 HIGH | Hardcoded secrets, Redis without auth, missing K8s security contexts |
| **CSP/XSS** | 🟠 HIGH | unsafe-inline + unsafe-eval in CSP, source maps in production |
| **Testing** | 🟠 HIGH | 50% untested API modules, most tests are 401-only stubs, 4 empty test methods |
| **IDOR** | 🟠 HIGH | OTP generation, payment verification, missing ownership checks |
| **Input Validation** | 🟡 MEDIUM | Regex injection in admin search, unvalidated query params, missing sanitization |
| **Performance** | 🟡 MEDIUM | 10MB+ chunks, missing memoization, unbounded message lists |

---

## 2. Findings by Severity

### 🔴 BLOCKERS (8)

| # | Layer | File | Issue | SonarQube Rule |
|---|-------|------|-------|----------------|
| B1 | Backend | `app/api/v1/auth.py` L95 | `InvalidInputError(field="role")` — `field` is not a valid param; **TypeError at runtime** | S2583 (dead code / always-fails) |
| B2 | Backend | `app/api/v1/upload.py` L93-106 | **No authentication on `upload_documents`** — anyone can upload unlimited files | S5122 (missing auth) |
| B3 | Backend | `app/api/v1/upload.py` L109-121 | **No authentication on `delete_document`** — anyone can delete any file by UUID | S5122 |
| B4 | Backend | `app/api/v1/bookings.py` L626 | **Double paise conversion** — refund of ₹500 becomes ₹50,000 | S2185 (silly math) |
| B5 | Backend | `app/api/v1/payments.py` L103-127 | **No ownership check on `verify_payment`** — any user can capture any payment | S5122 |
| B6 | Backend | `app/api/v1/wallet.py` L255 | **ObjectId/string mismatch** — `update_one` never matches → unlimited referral abuse | S2159 (condition always false) |
| B7 | Mobile | `src/services/api.js` L5-16 | **All tokens in AsyncStorage (plaintext)** — readable by any app on rooted device | android:S2077 |
| B8 | Mobile | `src/context/AuthContext.js` L57-120 | **All credentials in AsyncStorage** (reinforces B7) | android:S2077 |

### 🔴 CRITICAL (27)

| # | Layer | File | Issue | SonarQube Rule |
|---|-------|------|-------|----------------|
| C1 | Backend | `app/api/v1/auth.py` L193 | Admin self-assignment via registration (no role guard unlike google_login) | S5122 |
| C2 | Backend | `app/api/v1/auth.py` L47 | Synchronous `id_token.verify_oauth2_token()` blocks async event loop | S2925 |
| C3 | Backend | `app/middleware/security_headers.py` L43 | CSP `'unsafe-inline'` + `'unsafe-eval'` negates XSS protection | S5728 |
| C4 | Backend | `app/core/config/base.py` L155 | `TEST_OTP_CODE = "123456"` hardcoded default (should be `None`) | S2068 (hardcoded creds) |
| C5 | Backend | `app/core/config/base.py` L33-34 | SECRET_KEY/JWT_SECRET_KEY default to random per-restart (no prod validator) | S2068 |
| C6 | Backend | `app/api/v1/bookings.py` L190-211 | Race condition on coupon usage (non-atomic read-check-update) | S2222 |
| C7 | Backend | `app/api/v1/bookings.py` L700-717 | IDOR: any user can overwrite any booking's OTP | S5122 |
| C8 | Backend | `app/api/v1/bookings.py` L833 | Dev fallback `order_dev_` IDs bypass real payment in production | S1134 (fixme) |
| C9 | Backend | `app/api/v1/bookings.py` L876 | Payment credentials in URL query params (appear in logs) | S5131 |
| C10 | Backend | `app/api/v1/payments.py` L79,135,186 | `detail=str(e)` leaks raw exception (API keys, paths) to client | S5131 |
| C11 | Backend | `app/api/v1/payments.py` L160-200 | Refund without admin approval — double-refund possible | S5122 |
| C12 | Backend | `app/api/v1/wallet.py` L100-118 | Unverified payment credit — fabricated payment_id accepted | S5122 |
| C13 | Backend | `app/api/v1/wallet.py` L72,87,118 | Failures returned as HTTP 200 with `str(e)` error text | S1148 |
| C14 | Backend | `app/api/v1/admin.py` L806-820 | MongoDB regex injection → ReDoS via `$regex` with unsanitized input | S5131 (injection) |
| C15 | Backend | `app/services/payment_service.py` L87 | Floating-point `int(amount * 100)` truncates currency | S2185 |
| C16 | Backend | `app/api/v1/users.py` L153 | `detail=f"Onboarding failed: {str(e)}"` leaks internals | S5131 |
| C17 | Web | `savitara-web/.env.production` L2 | Google OAuth Client ID committed to VCS | S2068 |
| C18 | Web | `savitara-web/src/services/api.js` L9 | Insecure `http://localhost:8000` default URL | S5332 |
| C19 | Web | `savitara-web/src/context/AuthContext.jsx` L62 | Tokens in localStorage — XSS-accessible | S5542 |
| C20 | Web | `savitara-web/src/context/SocketContext.jsx` L143 | JWT in WebSocket query string fallback | S5131 |
| C21 | Web | `savitara-web/vite.config.js` L30 | `sourcemap: true` in production build exposes source | S5332 |
| C22 | Web | `savitara-web/index.html` L8 | CSP allows `'unsafe-inline'` + `'unsafe-eval'` for scripts | S5728 |
| C23 | Web | `savitara-web/nginx.conf` | No HTTPS — all traffic including tokens unencrypted | S5332 |
| C24 | Mobile | `src/context/SocketContext.js` L57 | Token in WebSocket URL query string | S5131 |
| C25 | Mobile | `src/services/notifications.js` L143 | Push token logged to console | S5131 |
| C26 | Infra | `docker-compose.yml` L14-15,78 | Hardcoded MongoDB password + insecure JWT secret default | S2068 |
| C27 | Infra | `k8s/backend-deployment.yaml` L113 | Redis URL without password in K8s | S2068 |

### Major Findings (64) — Grouped by Category

#### Design & Architecture (SOLID Violations)

| # | File | Issue | Principle |
|---|------|-------|-----------|
| M1 | `users.py` L338-403 | 3 near-identical profile update functions (~90% duplication) | DRY / SRP |
| M2 | `admin.py` L48 | Shadowed import `MONGO_MATCH` — redefined locally | OCP |
| M3 | `SocketContext.js` + `websocket.js` (mobile) | Two independent WebSocket implementations → 2 connections per user | SRP |
| M4 | `Chat.jsx` (web) | 913-line monolith component handles 10+ concerns | SRP |
| M5 | `App.jsx` (web) L156-170 | Duplicate routes across roles — first match wins, potential data leak | LSP |

#### Security — Input Validation

| # | File | Issue |
|---|------|-------|
| M6 | `bookings.py` L156-171 | Race condition on slot booking (non-atomic check + insert) |
| M7 | `bookings.py` L733 | OTP leaked in push notification (visible on lock screen) |
| M8 | `bookings.py` L700-717 | No OTP expiry — generated OTPs valid forever |
| M9 | `users.py` L86-98 | Self-referral not prevented — user can use own referral code |
| M10 | `admin.py` L1379 | No validation on `action` param in `review_report` |
| M11 | `admin.py` L1256 | No validation on report `reason` (should use `ReportReason` enum) |
| M12 | `wallet.py` L228 | No validation on `transaction_type` query param |
| M13 | `upload.py` L56-62 | MIME validation uses spoofable `file.content_type` |

#### Security — Information Disclosure

| # | File | Issue |
|---|------|-------|
| M14 | `users.py` L1057 | `detail=f"Failed to fetch Acharya details: {str(e)}"` |
| M15 | `admin.py` L658 | Admin endpoint returns full user documents (hashed passwords, FCM tokens) |
| M16 | `payments.py` L186 | `detail=f"Refund initiation failed: {exc}"` leaks Razorpay errors |
| M17 | `payment_service.py` L115 | Silent auth failure — returns `False` instead of raising on transient errors |

#### Security — Infrastructure

| # | File | Issue |
|---|------|-------|
| M18 | `docker-compose.yml` L33-34 | Redis exposed `0.0.0.0:6379` without password |
| M19 | `docker-compose.yml` L11-12 | MongoDB port 27017 published to host |
| M20 | `docker-compose.yml` L48-50 | Elasticsearch ports published with security disabled |
| M21 | `k8s/backend-deployment.yaml` L163-178 | Redis sidecar: no password, no health check, no security context |
| M22 | K8s deployment (entire spec) | Missing `securityContext` — no runAsNonRoot, drop capabilities |
| M23 | `savitara-web/Dockerfile` L17-26 | Nginx runs as root, no HEALTHCHECK |
| M24 | `k8s/secrets.yaml` L22-32 | Placeholder `CHANGEME` values committed to git |
| M25 | `k8s/namespace.yaml` | No NetworkPolicy — all pods can communicate |
| M26 | `terraform/network.tf` L140-177 | All security groups have egress `0.0.0.0/0` |

#### Security — Web Frontend

| # | File | Issue |
|---|------|-------|
| M27 | `api.js` L16-17 (web) | Tokens stored in localStorage |
| M28 | `firebase.js` L12-17 (web) | Module-level `throw` crashes entire app if env var missing |
| M29 | `AuthContext.jsx` L78-84 | Backend error messages surfaced verbatim to user |
| M30 | `AuthContext.jsx` L234-237 | Incomplete `useMemo` dependencies — memoization ineffective |
| M31 | `SocketContext.jsx` L18 (web) | `token` destructured but never provided by AuthContext — **WebSocket broken** |
| M32 | `AcharyaProfile.jsx` L95 | No URL param validation — path traversal possible |
| M33 | `CreateBooking.jsx` L149-190 | Debug `console.log` of payloads/responses in production |
| M34 | `Chat.jsx` L714-721 | `window.open(msg.media_url)` — XSS/open-redirect vector |
| M35 | `Chat.jsx` L699-705 | File download link without URL validation |
| M36 | `Chat.jsx` L370-377 | Native `prompt()`/`alert()` — blocked in some browsers |
| M37 | `ErrorBoundary.jsx` L74-76 | `process.env.NODE_ENV` used instead of `import.meta.env.DEV` in Vite |
| M38 | `App.jsx` L148-170 | `!user` fallback renders ALL role routes when unauthenticated |
| M39 | `index.html` L8 | CSP `connect-src` allows `http://localhost:8000` in production |
| M40 | `nginx.conf` | Missing security headers (X-Frame-Options, HSTS, etc.) |
| M41 | `nginx.conf` | No `Cache-Control` for static assets |
| M42 | `package.json` L18 | Dead `@react-oauth/google` dependency (migrated to Firebase) |
| M43 | `vite.config.js` L17 | `Cross-Origin-Embedder-Policy: unsafe-none` |

#### Security — Mobile

| # | File | Issue |
|---|------|-------|
| M44 | All network files | No SSL/certificate pinning |
| M45 | `SocketContext.js` L47-52 | No WSS enforcement — defaults to `ws://` |
| M46 | `websocket.js` L60-68 | Reconnect uses stale (expired) token from closure |
| M47 | `notifications.js` L159 | Full notification payload logged in production |
| M48 | `notifications.js` L173-200 | Notification navigation without ownership validation |
| M49 | `AuthContext.js` L24-28 | Dummy Google Client ID used at runtime |
| M50 | `AppNavigator.js` L94-153 | Role-based navigation is client-side only (AsyncStorage tamperable) |
| M51 | `app.config.js` L32-34 | Localhost fallback in production config |
| M52 | `package.json` | `expo-secure-store` not installed |
| M53 | `package.json` | `@react-native-community/netinfo` imported but not in dependencies |
| M54 | `App.js` L42-45 | `WebSocketService.connect(userId)` called without token arg |
| M55 | `App.js` L87-91 | SocketProvider wraps unauthenticated state |
| M56 | `offline.js` L65-68 | Queued requests serialized via `.toString()` but never replayed (dead code) |

#### Performance

| # | File | Issue |
|---|------|-------|
| M57 | Backend `redis.py` | New Redis client created per request (connection pooling destroyed) |
| M58 | Backend `rate_limit.py` | Non-atomic pipeline (race condition + fails open on Redis error) |
| M59 | `users.py` L997 | Full aggregation to count — should use `$count` stage |
| M60 | `payments.py` L141 | Hardcoded `length=100` with no pagination |
| M61 | `AuthContext.jsx` L234 | Auth functions not `useCallback`-wrapped — cascading re-renders |
| M62 | `Chat.jsx` L283-287 | `handleKeyDown` listener re-created every render |
| M63 | `ChatListScreen.js` L200-206 | FlatList missing `getItemLayout`/`windowSize` |
| M64 | `vite.config.js` L31 | ChunkSizeWarningLimit 10000 — masking 10MB bundle problem |

---

## 3. Backend — Core & Config

### 3.1 `app/core/config/base.py`

**Issues Found**: 5 (2 Critical, 1 Major, 2 Minor)

- **C4**: `TEST_OTP_CODE: str = "123456"` — hardcoded, should default to `None`
- **C5**: `SECRET_KEY`/`JWT_SECRET_KEY` default to `secrets.token_urlsafe(64)` — random per restart breaks JWT verification across deploys; needs production validator
- **Major**: `RAZORPAY_WEBHOOK_SECRET: str = ""` — empty-string default means webhook verification passes trivially
- **Minor**: `ValidationError` class name shadows `pydantic.ValidationError`
- **Minor**: `sys.exit(1)` inside Pydantic `@field_validator` — kills process during config init

### 3.2 `app/core/security.py`

**Issues Found**: 0 Critical (well-implemented JWT + bcrypt with 72-byte truncation fix)

### 3.3 `app/middleware/security_headers.py`

**Issues Found**: 1 Critical

- **C3**: CSP includes `'unsafe-inline'` and `'unsafe-eval'` for `script-src`, negating XSS protection

### 3.4 `app/middleware/rate_limit.py`

**Issues Found**: 2 Major

- Non-atomic Redis pipeline for rate limiting (TOCTOU race)
- Fails open on Redis error — returns request allowed

### 3.5 `app/db/redis.py`

**Issues Found**: 1 Major

- `get_redis()` dependency creates a new `Redis()` client per request instead of using connection pool

### 3.6 `app/api/v1/auth.py`

**Issues Found**: 1 Blocker, 2 Critical

- **B1**: `InvalidInputError(field="role")` — unexpected kwarg → TypeError at runtime
- **C1**: Registration endpoint allows `role=admin` (no guard)
- **C2**: Synchronous Google token verification blocks event loop

### 3.7 `app/main.py`

**Issues Found**: 2 Minor

- Request ID uses millisecond timestamp (not unique under concurrent load)
- CORS `allow_headers=["*"]` — should be explicit list

---

## 4. Backend — API Routes & Services

### 4.1 `app/api/v1/bookings.py`

**Issues Found**: 4 Critical, 3 Major, 2 Minor

- **B4**: Double paise conversion on refunds (×100 applied twice)
- **C6**: Race condition on coupon `used_count`
- **C7**: IDOR on OTP generation (any user can overwrite any booking's OTP)
- **C8**: Dev fallback `order_dev_` IDs in production
- **C9**: Payment creds in URL params
- OTP leaked in push notification
- OTP has no expiry
- Slot booking race condition

### 4.2 `app/api/v1/payments.py`

**Issues Found**: 1 Blocker, 2 Critical, 2 Major

- **B5**: Missing ownership check on payment verification
- **C10**: Raw exceptions leaked to client
- **C11**: Self-service refund without authorization
- No pagination on payment history
- Mutable default argument

### 4.3 `app/api/v1/wallet.py`

**Issues Found**: 1 Blocker, 2 Critical, 2 Major

- **B6**: ObjectId/string mismatch → unlimited referral abuse
- **C12**: Unverified payment credit endpoint
- **C13**: Failures returned as HTTP 200
- No `transaction_type` validation

### 4.4 `app/api/v1/admin.py`

**Issues Found**: 1 Critical, 3 Major, 1 Minor

- **C14**: Regex injection → ReDoS in user search
- Missing action/reason validation
- Full user documents exposed

### 4.5 `app/api/v1/upload.py`

**Issues Found**: 2 Blocker, 1 Critical, 1 Major

- **B2**: Unauthenticated upload endpoint
- **B3**: Unauthenticated delete endpoint
- **C13** (shared): MIME spoofing via `content_type`
- No rate limiting on uploads

### 4.6 `app/api/v1/users.py`

**Issues Found**: 1 Critical, 3 Major, 2 Minor

- **C16**: Error message leaks internals
- Self-referral not prevented
- 90% code duplication in profile updates
- Full aggregation for counting

### 4.7 `app/services/payment_service.py`

**Issues Found**: 1 Critical, 1 Major, 1 Minor

- **C15**: Floating-point currency arithmetic
- Silent failure on signature verification
- Non-thread-safe singleton

---

## 5. Frontend Web (savitara-web)

### 5.1 Security

| Finding | Fix Required |
|---------|-------------|
| **C18**: HTTP default API URL | Fail-fast if no HTTPS URL configured |
| **C19**: Tokens in localStorage | Migrate to httpOnly cookies |
| **C20**: JWT in WebSocket query string fallback | Remove fallback; refuse connection |
| **C21**: Source maps in production | Set `sourcemap: false` |
| **C22**: CSP `unsafe-inline`/`unsafe-eval` | Use Vite CSP nonce plugin |
| **C23**: No HTTPS in nginx.conf | Add TLS + HSTS |
| **M31**: WebSocket broken (`token` undefined) | Fix SocketContext to read token from localStorage |
| **M34**: `window.open(media_url)` XSS | Validate URL scheme (https only) |

### 5.2 Architecture

| Finding | Fix Required |
|---------|-------------|
| **M4**: 913-line Chat.jsx monolith | Decompose into MessageList, MessageInput, TypingIndicator, etc. |
| **M5, M38**: Duplicate routes + unauthenticated fallback | Proper RBAC route guards |
| **M37**: `process.env.NODE_ENV` in Vite | Use `import.meta.env.DEV` |
| **M28**: Module-level `throw` in firebase.js | Graceful degradation |

### 5.3 Performance

| Finding | Fix Required |
|---------|-------------|
| **M61**: Missing `useCallback` in AuthContext | Wrap functions; fix useMemo deps |
| **M62**: `handleKeyDown` re-created every render | Wrap in useCallback |
| **M64**: 10MB+ chunk size silenced | Code-split with `React.lazy` |

---

## 6. Mobile App (savitara-app)

### 6.1 Security (Critical)

| Finding | Fix Required |
|---------|-------------|
| **B7/B8**: Tokens in AsyncStorage | Install `expo-secure-store`, migrate token storage |
| **C24**: Token in WebSocket URL | Send in first WS frame |
| **C25**: Push token logged | Remove console.log or guard with `__DEV__` |
| **M44**: No SSL pinning | Add `react-native-ssl-pinning` |
| **M45**: No WSS enforcement | Reject `ws://` URLs |

### 6.2 Architecture

| Finding | Fix Required |
|---------|-------------|
| **M3**: Dual WebSocket implementations | Remove `websocket.js`; use only SocketContext |
| **M54**: WebSocket connect called without token | Pass token from AuthContext |
| **M55**: SocketProvider wraps unauthenticated state | Move inside auth-gated wrapper |
| **M56**: `offline.js` dead code | Remove or implement properly |

### 6.3 Build & Config

| Finding | Fix Required |
|---------|-------------|
| **M51**: Localhost fallback in app.config.js | Fail build if env var missing |
| **M52**: Missing `expo-secure-store` | `npx expo install expo-secure-store` |
| **M53**: Missing `@react-native-community/netinfo` | `npx expo install @react-native-community/netinfo` |

---

## 7. Infrastructure & DevOps

### 7.1 Docker

| Finding | Fix Required |
|---------|-------------|
| **C26**: Hardcoded secrets in docker-compose.yml | Use `.env` file with Docker secrets |
| **M18**: Redis without password | Add `--requirepass` |
| **M19**: MongoDB port published | Remove `ports:` mapping |
| **M20**: Elasticsearch unsecured | Enable xpack.security |
| **M23**: Web Dockerfile runs as root | Add `USER nginx` |

### 7.2 Kubernetes

| Finding | Fix Required |
|---------|-------------|
| **C27**: Redis without password in K8s | Add `--requirepass` from secretKeyRef |
| **M21**: Redis sidecar missing everything | Add auth, health check, security context |
| **M22**: Missing securityContext globally | Add `runAsNonRoot`, `dropCapabilities`, `readOnlyRootFilesystem` |
| **M24**: Placeholder secrets committed | Use SealedSecrets only |
| **M25**: No NetworkPolicy | Create ingress/egress policies |

### 7.3 Terraform

| Finding | Fix Required |
|---------|-------------|
| **M26**: Unrestricted egress | Scope to required CIDR blocks |
| `readonlyRootFilesystem = false` | Set to `true` with writable tmpfs |
| Mutable ECR tags | Set `image_tag_mutability = "IMMUTABLE"` |
| Secret rotation commented out | Implement rotation |

---

## 8. Test Coverage Analysis

### 8.1 Coverage Summary

| Metric | Current | Target |
|--------|---------|--------|
| API modules with any test | 12/24 (50%) | 24/24 (100%) |
| Service modules with any test | 9/25 (36%) | 25/25 (100%) |
| Middleware modules with any test | 1/5 (20%) | 5/5 (100%) |
| Empty/pass test methods | 4 | 0 |
| Tests that only check 401 | ~15 | 0 (need happy-path) |
| Security-specific tests | 0 | 1 per vulnerability class |
| Coverage tooling configured | No | Yes (`--cov-fail-under=60`) |

### 8.2 Untested Modules (Critical)

| Module | Risk |
|--------|------|
| `admin.py`, `admin_auth.py` | Privilege escalation undetected |
| `wallet.py` | Money movement bugs undetected |
| `upload.py` | File upload attacks undetected |
| `payment_service.py` | Payment logic never verified |
| `wallet_service.py` | Balance operations never verified |
| `encryption_service.py` | Crypto could silently fail |
| `kyc_service.py` | Identity fraud risk |

### 8.3 Critical Test Quality Issues

| File | Issue |
|------|-------|
| `test_auth.py` L28-30, L58-60, L63-65 | 3 empty `pass` test methods — RBAC never verified |
| `test_bookings.py` (all) | Every test only validates 401 — zero happy-path tests |
| `test_payments.py` (all) | Every test only validates 401 — Razorpay never mocked |
| `conftest.py` L30 | Tests use real MongoDB — fails in CI without DB |
| `pytest.ini` | No `--cov` configured — coverage not measured |
| E2E tests | Only 2 smoke tests + hardcoded credentials |

### 8.4 Missing Test Categories

- **Security**: NoSQL injection, XSS, CSRF, auth bypass, IDOR, JWT manipulation, file upload attacks
- **Payment Security**: Webhook signature verification, amount tampering, replay attacks, race conditions
- **Rate Limiting**: No tests verifying rate limits actually work
- **WebSocket**: No tests for unauthenticated WS connections or token expiry
- **Edge Cases**: Max booking duration, max payment amount, max message length

---

## 9. Plan of Action

### Phase 1: 🔴 Blockers & Critical Security (Priority: IMMEDIATE)

| Task | Files | Est. Effort |
|------|-------|-------------|
| Fix TypeError in auth.py (B1) | `auth.py` | 15 min |
| Add auth to upload endpoints (B2/B3) | `upload.py` | 30 min |
| Fix double paise conversion (B4) | `bookings.py`, `payment_service.py` | 30 min |
| Add ownership check on payment verify (B5) | `payments.py` | 20 min |
| Fix ObjectId mismatch in wallet (B6) | `wallet.py` | 15 min |
| Block admin self-assignment (C1) | `auth.py` | 10 min |
| Make Google verify async (C2) | `auth.py` | 20 min |
| Fix CSP (C3/C22) | `security_headers.py`, `index.html` | 30 min |
| Remove hardcoded OTP default (C4) | `base.py` | 5 min |
| Add SECRET_KEY production validator (C5) | `base.py` | 15 min |
| Fix atomic coupon usage (C6) | `bookings.py` | 30 min |
| Fix IDOR on OTP (C7) | `bookings.py` | 15 min |
| Remove dev fallback order (C8) | `bookings.py` | 10 min |
| Move payment params to body (C9) | `bookings.py` | 15 min |
| Fix error message leaks (C10/C16) | `payments.py`, `users.py` | 20 min |
| Add refund authorization (C11) | `payments.py` | 30 min |
| Verify wallet payments (C12) | `wallet.py` | 30 min |
| Fix wallet error responses (C13) | `wallet.py` | 20 min |
| Fix regex injection (C14) | `admin.py` | 10 min |
| Fix currency arithmetic (C15) | `payment_service.py` | 15 min |

### Phase 2: 🟠 Major Security & Architecture

| Task | Files | Est. Effort |
|------|-------|-------------|
| Remove hardcoded secrets from docker-compose | `docker-compose.yml` | 30 min |
| Add K8s security contexts | `backend-deployment.yaml` | 30 min |
| Fix Redis auth everywhere | `docker-compose.yml`, K8s, Terraform | 1 hr |
| Disable source maps in prod (C21) | `vite.config.js` | 5 min |
| Fix web SocketContext (M31) | `SocketContext.jsx` (web) | 30 min |
| Add HTTPS to nginx.conf | `nginx.conf` | 30 min |
| Fix mobile token storage (B7/B8) | Multiple mobile files | 2 hr |
| Remove duplicate WebSocket (M3) | `App.js`, `websocket.js` | 1 hr |

### Phase 3: 🟡 Testing & Quality

| Task | Files | Est. Effort |
|------|-------|-------------|
| Configure pytest coverage | `pytest.ini` | 10 min |
| Implement empty test methods | `test_auth.py` | 2 hr |
| Write wallet tests | New `test_wallet.py` | 3 hr |
| Write upload tests | New `test_upload.py` | 2 hr |
| Write payment integration tests | `test_payments.py` | 3 hr |
| Create security test suite | New `test_security.py` | 4 hr |
| Fix conftest for CI | `conftest.py` | 1 hr |
| Add booking happy-path tests | `test_bookings.py` | 3 hr |

### Phase 4: 🟢 Performance & Polish

| Task | Files | Est. Effort |
|------|-------|-------------|
| Fix Redis connection pooling | `redis.py` | 30 min |
| Fix rate limiter atomicity | `rate_limit.py` | 30 min |
| Fix AuthContext memoization | `AuthContext.jsx/js` | 30 min |
| Code-split web bundle | Multiple | 2 hr |
| Decompose Chat.jsx | `Chat.jsx` → multiple | 4 hr |
| Add FlatList optimizations | `ChatListScreen.js` | 30 min |
| DRY profile update functions | `users.py` | 1 hr |

---

## 10. SonarQube Rule Mapping

| Finding | SonarQube Rule | CWE | OWASP |
|---------|---------------|-----|-------|
| B1: TypeError in auth.py | S2583 (Conditions should not unconditionally evaluate) | CWE-754 | — |
| B2/B3: No auth on upload | S5122 (Server-side requests should be authenticated) | CWE-306 | A01:2021 (Broken Access Control) |
| B4: Double paise conversion | S2185 (Silly mathematical operations) | CWE-682 | — |
| B5: Missing ownership check | S5122 | CWE-639 | A01:2021 |
| B6: ObjectId mismatch | S2159 (Conditions always false) | CWE-704 | — |
| B7/B8: Plaintext token storage | android:S2077 (Secrets should be stored securely) | CWE-311 | A02:2021 (Cryptographic Failures) |
| C1: Admin self-assignment | S5122 | CWE-269 | A01:2021 |
| C2: Sync in async | S2925 (Blocking operations in async) | CWE-400 | — |
| C3/C22: unsafe-inline CSP | S5728 (CSP should not be weakened) | CWE-79 | A03:2021 (Injection) |
| C4/C5: Hardcoded secrets | S2068 (Credentials should not be hard-coded) | CWE-798 | A07:2021 (Identification & Auth Failures) |
| C6: Race condition coupon | S2222 (Locks should be released) | CWE-362 | — |
| C7: IDOR OTP | S5122 | CWE-639 | A01:2021 |
| C8: Dev fallback in prod | S1134 (Track uses of "FIXME") | CWE-489 | — |
| C9: Creds in URL | S5131 (Sensitive data should not be logged) | CWE-598 | A04:2021 (Insecure Design) |
| C10/C16: Error info leak | S5131 | CWE-209 | A04:2021 |
| C11: Unauthorized refund | S5122 | CWE-862 | A01:2021 |
| C12: Unverified payment | S5122 | CWE-345 | A08:2021 (Software & Data Integrity Failures) |
| C14: Regex injection | S5131 | CWE-1333 | A03:2021 |
| C15: Float currency | S2185 | CWE-682 | — |
| C17/C26: Secrets in VCS | S2068 | CWE-798 | A07:2021 |
| C21: Source maps exposed | S5332 (Sensitive data should not be exposed) | CWE-540 | A05:2021 (Security Misconfiguration) |
| C24/C25: Token logging | S5131 | CWE-532 | A09:2021 (Security Logging & Monitoring Failures) |
| M14-M17: Info disclosure | S5131 | CWE-209 | A04:2021 |
| M18-M20: Exposed services | S5332 | CWE-668 | A05:2021 |
| M44: No SSL pinning | S5527 (Certificate pinning) | CWE-295 | A07:2021 |

---

## Appendix: Files Modified / To Modify

### Already Applied (Previous Sessions — Booking & Chat Fixes)
- `savitara-app/src/context/SocketContext.js` — AsyncStorage key fix
- `savitara-app/src/screens/chat/ChatListScreen.js` — Navigation target fix
- `savitara-app/src/screens/chat/ConversationScreen.js` — WebSocket handling rewrite
- `savitara-web/src/pages/grihasta/AcharyaProfile.jsx` — Data path fix
- `savitara-app/src/screens/grihasta/AcharyaDetailsScreen.js` — Data path + navigation fix
- `savitara-app/src/screens/grihasta/BookingDetailsScreen.js` — Missing params fix
- `savitara-app/src/services/notifications.js` — Navigation target fix

### Applied (This Session — Phase 1 Critical Fixes)

#### B1: InvalidInputError TypeError
**File**: `backend/app/core/exceptions.py`  
**Change**: Added optional `field` parameter to `InvalidInputError.__init__` so callers like `auth.py` and `admin.py` can pass `field="role"` without TypeError.

#### B2/B3: Unauthenticated Upload/Delete Endpoints  
**File**: `backend/app/api/v1/upload.py`  
**Change**: Added `Depends(get_current_user)` to both `upload_documents()` and `delete_document()` endpoints.

#### B4: Double Paise Conversion  
**File**: `backend/app/api/v1/bookings.py`  
**Change**: Removed pre-conversion `refund_amount_paise = int(total_amount * 100)` — now passes rupee amount directly to `initiate_refund()` which handles conversion internally.

#### B5: Payment Ownership IDOR  
**File**: `backend/app/api/v1/payments.py`  
**Change**: Added `"user_id": current_user["id"]` filter to `verify_payment()`'s `find_one_and_update` query to prevent verifying another user's payment.

#### B6: ObjectId Mismatch in Wallet  
**File**: `backend/app/api/v1/wallet.py`  
**Change**: `apply_referral_code` now uses `ObjectId(current_user["id"])` for `_id` queries and updates.

#### C1: Admin Self-Assignment  
**File**: `backend/app/api/v1/auth.py`  
**Change**: Added `if request.role == UserRole.ADMIN: raise InvalidInputError(...)` guard in `register()` endpoint, matching the same check in `google_login()`.

#### C2: Sync Google Token Verify Blocking Event Loop  
**File**: `backend/app/api/v1/auth.py`  
**Change**: Added `import asyncio`; call changed to `await asyncio.to_thread(verify_google_token, auth_request.id_token)` to run the blocking HTTP call in a thread pool.

#### C3/C22: CSP with unsafe-eval  
**Files**: `backend/app/middleware/security_headers.py`, `savitara-web/index.html`  
**Change**: Removed `'unsafe-eval'` from `script-src` directive in both backend CSP middleware and frontend meta tag. Added Razorpay domains to `script-src`, `connect-src`, and `frame-src`.

#### C4: Hardcoded Test OTP Default  
**File**: `backend/app/core/config/base.py`  
**Change**: `TEST_OTP_CODE` default changed from `"123456"` to `None` with comment requiring explicit env var.

#### C5: SECRET_KEY Production Validator  
**File**: `backend/app/core/config/base.py`  
**Change**: Added `@field_validator("SECRET_KEY", mode="after")` that raises `ValueError` if `APP_ENV == "production"` and key length is insufficient, preventing accidental use of auto-generated fallback.

#### C6: Race Condition on Coupon Usage  
**File**: `backend/app/api/v1/bookings.py`  
**Change**: Replaced separate `find_one` + usage check + `update_one` with atomic `find_one_and_update` using `$expr` filter `{"$lt": ["$used_count", "$max_uses"]}` and `{"$inc": {"used_count": 1}}` in one operation.

#### C7: IDOR on OTP Generation  
**File**: `backend/app/api/v1/bookings.py`  
**Change**: Added authorization check in `generate_attendance_otp` verifying the caller is the grihasta, acharya, or admin associated with the booking.

#### C8: Dev Fallback Order IDs in Production  
**File**: `backend/app/api/v1/bookings.py`  
**Change**: Added `if settings.APP_ENV == "production"` guard that raises `HTTPException(503)` instead of generating fake `order_dev_` IDs.

#### C9: Payment Credentials in URL Query  
**File**: `backend/app/api/v1/bookings.py`  
**Change**: `verify_payment` endpoint changed from accepting `razorpay_payment_id`, `razorpay_order_id`, `razorpay_signature` as `Query()` parameters to accepting them as a Pydantic `Body(...)` model.

#### C10/C16: Error Information Leaks  
**Files**: `backend/app/api/v1/payments.py`, `backend/app/api/v1/users.py`  
**Change**: Replaced 5 instances of `detail=str(e)` and `detail=f"...{str(e)}"` with generic error messages. Exception details are only logged server-side.

#### C11: Unauthorized Refund  
**File**: `backend/app/api/v1/payments.py`  
**Change**: Added refund status check — `if payment.get("status") != "captured": raise HTTPException(400, ...)` to prevent double-refund and refunding uncaptured payments.

#### C12: Unverified Wallet Credits  
**File**: `backend/app/services/wallet_service.py`  
**Change**: `add_money()` now calls `PaymentService.fetch_payment(payment_id)` to verify the payment is captured and amount matches before crediting. Also checks for duplicate `payment_id` to prevent double-credit.

#### C13: Wallet Returning 200 on Errors  
**File**: `backend/app/api/v1/wallet.py`  
**Change**: All 6 wallet endpoints' error handlers converted from `return {"success": False, "message": str(e)}` (HTTP 200) to proper `raise HTTPException(500/402, detail="generic message")`.

#### C14: Regex Injection in Admin Search  
**File**: `backend/app/api/v1/admin.py`  
**Change**: Added `import re`; all user-supplied values passed to `$regex` now use `re.escape()`: `email`, `role`, `status_filter` in `search_users()`, and `action` in `get_audit_logs()`.

#### C15: Floating-Point Currency Truncation  
**File**: `backend/app/services/payment_service.py`  
**Change**: Both `create_order` and `initiate_refund` now use `round(amount * 100)` instead of `int(amount * 100)` to prevent float truncation (e.g., `int(9.99 * 100)` = 998).

#### C21: Source Maps Exposed in Production  
**File**: `savitara-web/vite.config.js`  
**Change**: `sourcemap: true` changed to `sourcemap: false` in build config.

#### B7/B8: Insecure Mobile Token Storage  
**Files**: `savitara-app/src/services/api.js`, `savitara-app/src/context/AuthContext.js`, `savitara-app/package.json`  
**Change**: Migrated JWT token storage from `AsyncStorage` (plaintext) to `expo-secure-store` (encrypted keychain/keystore). Added `expo-secure-store` dependency. Non-sensitive user data remains in AsyncStorage.

### Remaining (Phase 2–4)
See [Plan of Action](#9-plan-of-action) for Major, Testing, and Performance tasks.

### Applied (Session 3 — Phase 2: Major Security & Architecture)

#### M31: Web AuthContext Missing Token Export (WebSocket Broken)
**File**: `savitara-web/src/context/AuthContext.jsx`
**Change**: Added `token` state synced to localStorage. Exported `token` in the `useMemo` context value so `SocketContext.jsx` receives a valid token. Added `useCallback` import. Fixed `useMemo` deps to include `token`.

#### M18/C17: Docker-Compose Hardcoded Secrets
**File**: `docker-compose.yml`
**Change**: Replaced hardcoded `MONGO_INITDB_ROOT_PASSWORD` with `${MONGO_ADMIN_PASSWORD:?Set MONGO_ADMIN_PASSWORD in .env}`. Added `--requirepass` to Redis service. Changed JWT default to `:?` error syntax. Restricted Redis/Elasticsearch ports to `127.0.0.1`. Enabled xpack security. Created `.env.example` with all required variables.

#### M19: K8s Missing Security Contexts & Redis Auth
**File**: `k8s/backend-deployment.yaml`
**Change**: Added pod-level `securityContext: runAsNonRoot: true, runAsUser: 1000, fsGroup: 1000`. Added container-level `securityContext: allowPrivilegeEscalation: false, readOnlyRootFilesystem: true, capabilities: drop: ["ALL"]` to both backend and Redis containers. Moved `REDIS_URL` from hardcoded value to secretKeyRef. Added `--requirepass` command and health probes to Redis sidecar.

#### M20: K8s No NetworkPolicy
**File**: `k8s/network-policy.yaml` (NEW)
**Change**: Created deny-all default NetworkPolicy + allow-backend-ingress (from ingress controller) + allow-backend-egress (DNS, MongoDB, Redis, Elasticsearch, HTTPS).

#### M21: Nginx Missing Security Headers
**File**: `savitara-web/nginx.conf`
**Change**: Full rewrite with X-Frame-Options: DENY, X-Content-Type-Options: nosniff, X-XSS-Protection, HSTS, Referrer-Policy, Permissions-Policy, server_tokens off, gzip compression, cache-control (1y for static assets, no-cache for index.html).

#### M3: Mobile Duplicate WebSocket Connection
**Files**: `savitara-app/App.js`, `savitara-app/src/context/SocketContext.js`
**Change**: Removed `WebSocketService.connect(userId)` from App.js (SocketProvider already handles connection). Removed unused `useAuth` import and `user` variable. Updated mobile SocketContext.js to use `SecureStore.getItemAsync('accessToken')` instead of `AsyncStorage.getItem('accessToken')` for token retrieval (tokens migrated to SecureStore in Phase 1).

### Applied (Session 3 — Phase 3: Testing & Quality)

#### T1: pytest.ini Coverage Configuration
**File**: `backend/pytest.ini`
**Change**: Added `testpaths`, `python_files/classes/functions`, `addopts` with `--cov=app --cov-report=term-missing --cov-report=html:htmlcov --cov-fail-under=40`, `--strict-markers`, and custom markers (slow, integration).

#### T2: Implemented Empty Test Stubs
**Files**: `backend/tests/test_auth.py`, `backend/tests/test_bookings.py`, `backend/tests/test_block_enforcement.py`
**Change**: Implemented 7 previously empty `pass` test methods — Google OAuth callback (mocked verify), grihasta/acharya role guard tests, attendance OTP validation, and 3 block enforcement integration tests.

#### T3: New Test Files
**Files**: `backend/tests/test_wallet.py` (NEW), `backend/tests/test_upload.py` (NEW), `backend/tests/test_security.py` (NEW)
**Change**: Created wallet endpoint tests (balance, add money, transactions, payment verify), upload endpoint tests (auth, oversize, disallowed types), and security tests (headers, CORS, NoSQL injection, JWT none algorithm, empty/long tokens).

### Applied (Session 3 — Phase 4: Performance & Polish)

#### P1: Redis Connection Pooling
**Files**: `backend/app/db/redis.py`, `backend/app/core/startup.py`
**Change**: Replaced per-request `from_url()` (which creates a new TCP connection each time) with a module-level `ConnectionPool` (max_connections=20). `get_redis()` now yields a client backed by the shared pool. Added `close_pool()` function called during application shutdown in `startup.py`.

#### P2: Rate Limiter Atomicity
**File**: `backend/app/middleware/rate_limit.py`
**Change**: Replaced non-atomic 4-step pipeline (ZREMRANGEBYSCORE + ZCARD + ZADD + EXPIRE) with a server-side Lua script executed atomically via `EVALSHA`. Uses `uuid4().hex[:8]` suffix on member keys to prevent same-second collision (multiple requests in same second would share the same sorted set member and count as 1). Script pre-loaded on Redis connect for performance.

---

*End of Report*
