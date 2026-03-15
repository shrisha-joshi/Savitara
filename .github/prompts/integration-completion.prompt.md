---
name: integration-completion
description: "Audit all 5 Savitara codebases for unused, unwired, or partially connected functionality, then connect backend and frontend flows until features are fully reachable or explicitly retired."
argument-hint: "Optional focus area, folders, or feature family to audit and complete"
agent: agent
---
Use this prompt when you need to **research, verify, and complete missing integrations** across the Savitara platform:
- `backend/`
- `savitara-app/`
- `savitara-web/`
- `admin-savitara-web/`
- `admin-savitara-app/`

Follow the repo guidance in `.github/copilot-instructions.md`.

## Mission
Find functionality that exists but is not fully used, including:
1. backend endpoints, services, or flows that have no frontend entry point
2. frontend screens, buttons, toggles, menus, or helper functions that are not connected to backend APIs
3. partially implemented features where backend and frontend are both present but the integration is incomplete
4. duplicated or hardcoded UI behavior that should instead consume runtime/admin-managed configuration
5. dead or unreachable code that should either be wired properly or explicitly removed if truly obsolete

Then implement the missing connections with production-grade changes, not just a report.

## Expected workflow
1. Audit all 5 main folders unless the user narrows scope.
2. Build a feature/integration map covering:
   - backend capability
   - current frontend entry points
   - missing links
   - required API, UI, state, navigation, validation, and config updates
3. Prioritize high-impact gaps first:
   - broken or unreachable booking/payment flows
   - admin tools that cannot control backend behavior
   - user-facing controls with no API effect
   - backend endpoints that should be exposed in existing screens
4. Make incremental changes across the affected projects.
5. After each wave, run focused validation:
   - backend tests for impacted domains
   - frontend build/lint/error checks for changed apps
6. Continue until the requested scope is completed or a concrete blocker is proven.

## Non-negotiable rules
- Do not stop at listing issues; fix what is realistically fixable in the requested scope.
- Prefer wiring existing features before inventing new ones.
- Preserve existing architecture and conventions unless a refactor is required for correctness.
- Use admin-managed/runtime config instead of hardcoded maps or literals where appropriate.
- Read relevant files before editing.
- Update a todo list and keep only one active step in progress.
- Validate each affected app after changes.
- If something cannot be safely completed, explain the exact blocker and propose the next smallest shippable step.

## What to inspect
### Backend
- routers under `backend/app/api/v1/`
- services under `backend/app/services/`
- schemas/models for request and response support
- config/bootstrap endpoints and admin-controlled dynamic config paths

### Frontends
- route/page/screen coverage
- API service modules
- contexts/providers
- navigation entry points
- buttons, tabs, cards, dialogs, and menu actions
- hidden or partially wired controls

## Required output style
Respond with:
1. a concise integration gap summary
2. the specific files you will change next
3. incremental implementation updates as you progress
4. final verification results
5. remaining gaps only if they were not completed in the requested scope

## If the user provides a focus argument
Interpret it as one or more of:
- a feature family (`bookings`, `wallet`, `chat`, `reviews`, `admin controls`)
- one or more folders
- a mode such as `audit-only`, `implement`, or `finish wiring`

If no argument is given, default to:
**full integration completion audit + implementation across all five main folders**.

## Example invocations
- `/integration-completion finish wiring bookings across all apps`
- `/integration-completion audit-only wallet and rewards flows`
- `/integration-completion connect admin controls to backend runtime configs`
- `/integration-completion full repo pass for unused frontend/backend features`
