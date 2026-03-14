# Savitara World-Class Growth Execution Backlog (India-First)

> Goal: Convert Savitara into the most trusted, culturally authentic, and technically superior spiritual services platform in India.

## Priority Legend
- P0 = immediate revenue/risk impact (0-30 days)
- P1 = high growth impact (30-90 days)
- P2 = category leadership (90-180 days)

## A. Backend Platform & Reliability (1-30)
1. [x] P0: Introduce strict API idempotency keys for booking/payment/retry-prone endpoints.
2. [x] P0: Add distributed rate-limit buckets per user, IP, and device fingerprint.
3. [x] P0: Enforce global request correlation IDs and pass through WebSocket events.
4. [x] P0: Add centralized error taxonomy with machine-readable codes for all APIs.
5. [ ] P0: Move all side-effect notifications to outbox pattern + retry workers.
6. [x] P0: Add per-endpoint latency/error SLO dashboards (p50/p95/p99).
7. [ ] P0: Enable per-tenant feature flags (region/language/role/city cohorts).
8. [ ] P1: Introduce schema versioning for response payloads.
9. [ ] P1: Add async job queue for heavy panchanga/yearly computations.
10. [ ] P1: Add OpenTelemetry tracing from frontend to backend spans.
11. [ ] P1: Add resilience policies per integration (retry, timeout, hedging).
12. [ ] P1: Add DB query budget guards to prevent accidental N+1 patterns.
13. [ ] P1: Add write-ahead audit logs for all financial/trust actions.
14. [ ] P1: Add immutable event stream for booking state transitions.
15. [ ] P1: Add per-route cache hints and adaptive caching in Redis.
16. [ ] P1: Introduce read replicas for analytics-heavy admin queries.
17. [ ] P2: Build anti-abuse policy engine with dynamic risk scoring.
18. [ ] P2: Add zero-downtime migration framework for Mongo schema evolution.
19. [ ] P2: Add configuration drift detection between environments.
20. [ ] P2: Add synthetic monitoring for key flows (auth, booking, payment, chat).
21. [ ] P2: Add API contract tests generated from OpenAPI snapshots.
22. [ ] P2: Enable progressive delivery with automatic rollback gates.
23. [ ] P2: Add global emergency kill switches (payments/chat/recommendations).
24. [ ] P2: Implement adaptive throttling under incident load.
25. [ ] P2: Build real-time fraud/event anomaly stream processor.
26. [ ] P2: Add consistency checker between payment records and booking states.
27. [ ] P2: Introduce operational command bus for admin remediation actions.
28. [ ] P2: Add deterministic replay tooling for production incidents.
29. [ ] P2: Implement data retention/archival lifecycle policies by collection.
30. [ ] P2: Build chaos automation in CI nightly for integration failure modes.

### Backend Reliability Progress Notes
- ✅ Item 1 done: `X-Idempotency-Key` enforced for booking create + payment verify, with persisted response snapshots in `idempotency_keys` collection and TTL cleanup.
- ✅ Item 2 done: rate limiting key now includes user/IP/device/method/path dimensions for distributed buckets.
- ✅ Item 3 done: correlation ID is carried in request lifecycle and passed into WebSocket messages whenever available.
- ✅ Item 4 done: HTTP error envelope now normalizes machine-readable codes with request/correlation metadata.
- ✅ Item 6 done: Prometheus per-endpoint request count + latency histogram metrics added for API SLO tracking.

## B. Security, Trust & Compliance (31-55)
31. [ ] P0: Enforce device-bound refresh tokens with rotation + reuse detection.
32. [ ] P0: Add step-up authentication for high-risk actions (wallet/refund/profile bank changes).
33. [ ] P0: Add OTP attempt throttling and velocity checks by booking/user/device.
34. [ ] P0: Add mandatory signed webhook replay protection windows.
35. [ ] P0: Add tamper-evident audit trail hashing for dispute evidence.
36. [ ] P0: Enable secrets scanning + pre-commit secret blockers.
37. [ ] P0: Add CSP, HSTS, X-Frame-Options hardening across web apps.
38. [ ] P1: Deploy bot/bulk-abuse detection for fake booking spikes.
39. [ ] P1: Add content safety checks for chat media and abusive language patterns.
40. [ ] P1: Add account recovery safeguards against SIM swap vectors.
41. [ ] P1: Implement KYC document OCR validation + liveness checks.
42. [ ] P1: Add role-based data minimization (need-to-know payload shaping).
43. [ ] P1: Add privacy controls for user visibility and discoverability.
44. [ ] P1: Add auto-redaction of PII in logs and analytics events.
45. [ ] P2: Build compliance package for DPDP/GDPR-like controls.
46. [ ] P2: Add cryptographic evidence package for trust dispute timelines.
47. [ ] P2: Add abnormal location/time login risk workflows.
48. [ ] P2: Deploy signed attachment URLs with TTL and one-time access.
49. [ ] P2: Add admin action four-eyes approval for sensitive operations.
50. [ ] P2: Add external penetration test cadence and remediation tracker.
51. [ ] P2: Add FIDO2/WebAuthn support for admin panel logins.
52. [ ] P2: Build red-team simulation scripts for trust/payout exploit attempts.
53. [ ] P2: Add account graphing for collusive review/payment fraud.
54. [ ] P2: Add regional legal policy packs for state-level requirements.
55. [ ] P2: Introduce automated secure SDLC gates in CI/CD.

## C. Booking Experience & Revenue Engine (56-85)
56. [ ] P0: Introduce request-mode SLA countdown (accept/reject timers) with reminders.
57. [ ] P0: Add instant rebook from completed booking with one tap.
58. [ ] P0: Add booking abandonment recovery (WhatsApp/SMS/push nudges).
59. [ ] P0: Add transparent fee breakdown and GST invoice generation.
60. [ ] P0: Add dynamic slot confidence score (likelihood of completion).
61. [ ] P0: Add Acharya response-time badges in listing and checkout.
62. [ ] P0: Add “best-value bundles” for multi-ritual journeys.
63. [ ] P0: Add personalized package recommendation at booking step.
64. [ ] P1: Add waitlist + auto-match when preferred slot opens.
65. [ ] P1: Add alternative Acharya suggestions on decline/timeout.
66. [ ] P1: Add pre-ritual checklist with auto reminders by ritual type.
67. [ ] P1: Add multilingual booking forms (Hindi + regional language packs).
68. [ ] P1: Add low-data “lite booking flow” for weaker networks.
69. [ ] P1: Add trust-backed “On-time or compensation” badge logic.
70. [ ] P1: Add no-show prediction model and proactive intervention flows.
71. [ ] P1: Add add-ons marketplace (samagri kits, prasad delivery, video recording).
72. [ ] P1: Add recurring ritual subscriptions (monthly sankalp/vrat reminders).
73. [ ] P1: Add family accounts with guardian booking and elder-friendly mode.
74. [ ] P1: Add in-flow financing for high-ticket rituals.
75. [ ] P2: Add AI-assisted ritual advisor before booking finalization.
76. [ ] P2: Add multilingual voice booking assistant for non-typing users.
77. [ ] P2: Add smart pricing model based on region, demand, seasonality.
78. [ ] P2: Add surge protection + fairness constraints to avoid user distrust.
79. [ ] P2: Add ceremony timeline tracking (prep→travel→check-in→completion).
80. [ ] P2: Add family event calendar integration (Google/Apple/WhatsApp export).
81. [ ] P2: Add conversion-optimized checkout variants by user segment.
82. [ ] P2: Add “ritual outcome journal” + follow-up recommendations.
83. [ ] P2: Add NPS-triggered rescue workflow for unhappy bookings.
84. [ ] P2: Add gift-a-ritual checkout for diaspora family use-cases.
85. [ ] P2: Add city-wise concierge hotline escalations during peak festivals.

## D. Payments, Wallet & Finance Ops (86-105)
86. [ ] P0: Add UPI intent + collect flows with fallbacks.
87. [ ] P0: Add payment retry smart router (card→UPI→netbanking fallback sequence).
88. [ ] P0: Add partial payment + advance booking deposits.
89. [ ] P0: Add real-time payment success reconciliation dashboard.
90. [ ] P0: Add delayed-settlement risk hold for suspicious accounts.
91. [ ] P0: Add refund TAT tracker with user-visible status.
92. [ ] P1: Add wallet cashbacks and ritual milestone rewards.
93. [ ] P1: Add offer engine with festival-specific promo calendars.
94. [ ] P1: Add payout reliability score for Acharyas.
95. [ ] P1: Add split payout architecture for platform + partner + tax allocations.
96. [ ] P1: Add GST-compliant invoicing and downloadable statements.
97. [ ] P1: Add subscription billing for premium user tiers.
98. [ ] P1: Add fee experimentation framework with guardrails.
99. [ ] P2: Add BNPL partnerships for expensive ceremonies.
100. [ ] P2: Add international payment rails for NRI users.
101. [ ] P2: Add treasury insights (float, aging liabilities, payout cycles).
102. [ ] P2: Add finance anomaly alerts (refund spikes, payout outliers).
103. [ ] P2: Add smart dunning for failed subscription renewals.
104. [ ] P2: Add automated month-end close exports to ERP.
105. [ ] P2: Add merchant risk segmentation and adaptive limits.

## E. Chat, Voice & Real-Time Engagement (106-130)
106. [ ] P0: Replace browser prompt/alert patterns with polished in-app dialogs.
107. [ ] P0: Add structured message templates (ritual prep checklist, location notes).
108. [ ] P0: Add smart quick replies in Hindi + English.
109. [ ] P0: Add media upload resumability and retry state indicators.
110. [ ] P0: Add voice-note noise suppression and waveform preview.
111. [ ] P0: Add in-chat trust signals (verified profile, completion rate, punctuality).
112. [ ] P1: Add translation toggle for mixed-language chats.
113. [ ] P1: Add scheduled messages/reminders for ritual timelines.
114. [ ] P1: Add reaction analytics to detect sentiment drift in conversations.
115. [ ] P1: Add richer moderation controls with context-aware report forms.
116. [ ] P1: Add safe contact sharing masks (temporary proxy numbers).
117. [ ] P1: Add read-receipt privacy controls and granular mute windows.
118. [ ] P1: Add searchable chat across text + OCR-on-image.
119. [ ] P1: Add ephemeral messages for sensitive personal details.
120. [ ] P2: Add AI copilot for ritual Q&A (with authenticity guardrails).
121. [ ] P2: Add voice call escalation option with consent + recording policy.
122. [ ] P2: Add conversation quality scoring for support intervention.
123. [ ] P2: Add “booking room” shared timeline with pinned tasks.
124. [ ] P2: Add context cards (location weather, traffic ETA for in-person rituals).
125. [ ] P2: Add anti-spam models using behavior embeddings.
126. [ ] P2: Add supergroup/community satsang channels with moderation tiers.
127. [ ] P2: Add encrypted attachment support for sensitive documents.
128. [ ] P2: Add AI summarization of long threads for quick catch-up.
129. [ ] P2: Add language-aware toxicity moderation with review pipeline.
130. [ ] P2: Add call-to-book conversion nudges in relevant chat moments.

## F. Panchanga, Ritual Intelligence & Cultural Depth (131-155)
131. [ ] P0: Add city-level defaults for Panchanga instead of Delhi fallback when profile missing.
132. [ ] P0: Add timezone confidence + geolocation accuracy indicator.
133. [ ] P0: Add panchanga source/explanation notes for user trust.
134. [ ] P0: Add “what this means today” plain-language daily summary.
135. [ ] P0: Add one-tap reminders for Ekadashi/Pradosh/Amavasya/Purnima.
136. [ ] P1: Add regional calendar modes (Amanta/Purnimanta + state-specific variants).
137. [ ] P1: Add regional festival priority by user language/state.
138. [ ] P1: Add personalized muhurat by activity with confidence score.
139. [ ] P1: Add temple crowd/holiday advisory overlays for planning.
140. [ ] P1: Add ritual material checklist generated from booking + date.
141. [ ] P1: Add multilingual Sanskrit transliteration support.
142. [ ] P1: Add Panchanga API caching strategy for monthly/yearly views.
143. [ ] P1: Add structured educational cards (Tithi/Nakshatra significance).
144. [ ] P2: Add family astro profile for life-event planning timeline.
145. [ ] P2: Add “best windows” recommender with travel buffer constraints.
146. [ ] P2: Add Panchanga widgets for lockscreen/home screen.
147. [ ] P2: Add explainable astrologic rationale view for recommendations.
148. [ ] P2: Add religious-school preference settings (tradition variants).
149. [ ] P2: Add panchanga diff tool for location/date comparisons.
150. [ ] P2: Add event prediction calendar integrations for yearly planning.
151. [ ] P2: Add Vedic learning journeys linked to calendar events.
152. [ ] P2: Add sharable family ritual planner with permissions.
153. [ ] P2: Add machine-assisted transliteration for regional scripts.
154. [ ] P2: Add AR-based temple direction guidance for local events.
155. [ ] P2: Add curated content partnerships with trusted scholars.

## G. UX, Growth, Retention & India-Market Fit (156-180)
156. [ ] P0: Build true low-end Android performance budget (RAM <2GB mode).
157. [ ] P0: Add app language onboarding (English/Hindi + regional choices).
158. [ ] P0: Add elder-friendly accessibility mode (larger text, high contrast, voice prompts).
159. [ ] P0: Add trust-first profile cards with clear verification evidence.
160. [ ] P0: Replace all generic error texts with next-step actionable copy.
161. [ ] P1: Add referral loops with culturally relevant reward milestones.
162. [ ] P1: Add “first ritual guidance” onboarding wizard for new users.
163. [ ] P1: Add progressive profiling (collect details over time, not at once).
164. [ ] P1: Add cohort-based retention journeys (festival calendar-triggered).
165. [ ] P1: Add city-specific home feed with local festival relevance.
166. [ ] P1: Add post-booking delight moments (photo memories, gratitude prompts).
167. [ ] P1: Add Acharya quality leaderboard with fairness controls.
168. [ ] P1: Add bilingual SEO landing pages by ritual and city.
169. [ ] P1: Add growth experiments platform (A/B + holdout + guardrail metrics).
170. [ ] P2: Add WhatsApp mini-flow integrations for high-intent reactivation.
171. [ ] P2: Add creator ecosystem for devotional content + lead gen.
172. [ ] P2: Add “family trust circle” subscription plan.
173. [ ] P2: Add diaspora mode (time-zone scheduling, remittance-friendly payments).
174. [ ] P2: Add marketplace ratings trust model resistant to brigading.
175. [ ] P2: Add demand forecasting by festival/city for supply planning.
176. [ ] P2: Add personalized annual spiritual plan with reminders.
177. [ ] P2: Add dynamic CRM orchestration (push/email/WhatsApp by propensity).
178. [ ] P2: Add brand safety and policy transparency center.
179. [ ] P2: Add partner ecosystem APIs (temples/events/spiritual stores).
180. [ ] P2: Add full North Star metrics framework tied to profitability.

## H. Engineering Excellence Across All Clients (181-200)
181. [ ] P0: Remove blocking browser APIs (`prompt/alert/confirm`) and standardize UX dialogs.
182. [ ] P0: Add end-to-end typed API contracts generated for web/mobile/admin apps.
183. [ ] P0: Add shared design tokens package for all frontend apps.
184. [ ] P0: Add route-level code splitting in web/admin web for faster first load.
185. [ ] P0: Add bundle size budgets in CI with fail thresholds.
186. [ ] P1: Add visual regression tests for key flows.
187. [ ] P1: Add deterministic fixtures for booking/chat integration tests.
188. [ ] P1: Add mobile performance profiling pipeline (startup, TTI, memory).
189. [ ] P1: Add i18n extraction pipeline and translation QA checks.
190. [ ] P1: Add structured analytics event governance schema.
191. [ ] P1: Add feature-flag-driven dark launches per platform.
192. [ ] P1: Add monorepo package for shared auth/api clients.
193. [ ] P2: Add domain-driven module boundaries to reduce coupling.
194. [ ] P2: Add static architecture linting (forbidden imports/dependency cycles).
195. [ ] P2: Add deterministic data generators for staging realism.
196. [ ] P2: Add release-train governance with risk classification.
197. [ ] P2: Add canary quality gates powered by real user telemetry.
198. [ ] P2: Add incident simulation game-days for team readiness.
199. [ ] P2: Add engineering scorecards per squad with quality targets.
200. [ ] P2: Add continuous product discovery loop with user interview repository.

---

## Execution Wave 1 (Already Selected)
- [ ] Remove prompt/alert/confirm from chat + admin actions.
- [ ] Introduce idempotency key support for create booking/payment verify.
- [ ] Add city-aware panchanga defaults and explanation cards.
- [ ] Add request-mode booking SLA countdown + nudges.
- [ ] Add route-level code splitting for web and admin web.
- [ ] Add elder-friendly accessibility toggle (font size + contrast).
- [ ] Add Hindi copy baseline for booking and chat flows.
- [ ] Add structured error codes and user-actionable messages.
- [ ] Add abandoned booking re-engagement pipeline.
- [ ] Add SLO dashboards for booking/payment/chat/panchanga APIs.
