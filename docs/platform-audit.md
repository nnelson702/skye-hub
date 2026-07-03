# Platform Audit: skye-hub

## Decision

Use `skye-hub` as the current implementation candidate for the internal employee/admin platform.

Do not create a second application scaffold in `skye-helpful-platform` until this repo has been fully audited.

## Why

The repo already contains useful foundation work:

- React + TypeScript + Vite frontend
- Supabase integration
- Login and profile loading
- Admin route structure
- Admin users page
- Admin stores page
- Test scripts and admin delivery documentation

## Current Routes

Observed routes:

- `/login`
- `/reset-password`
- `/`
- `/admin`
- `/admin/stores`
- `/admin/users`

## Current Gaps

The current home page is still a placeholder. The next low-risk improvement is to turn it into an employee hub shell with links or cards for:

- announcements
- store messages
- documents
- tasks
- department walks
- admin tools

Larger modules still need schema and permission planning before implementation:

- communications feed
- document library
- media library
- task system
- department walks
- public site content controls
- sales goals
- labor intelligence
- catalog and B2B intake

## Repo Strategy

Use staged consolidation:

- `skye-helpful-platform` remains the umbrella roadmap and architecture repo.
- `skye-hub` remains the likely implementation base for employee/admin tools.
- `ScreenOrderingFlows` remains frozen until quote/request integration is ready.

## Next Safe Segment

Update the employee home page as a UI-only shell. Avoid database changes until the current schema is audited.