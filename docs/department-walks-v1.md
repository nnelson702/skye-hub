# Department Walks V1

## Product Direction

The Department Walk landing experience has exactly two primary paths:

1. **Start Monthly Department Walk**
2. **Log Observation / Event**

The previous Walk Templates / Photo Uploads / Review landing model is retired.

## Monthly Department Walk

A monthly walk is scoped to one store and one department.

Prescribed questions are answered with exactly one status:

- Standards Met
- Needs Attention
- N/A

A Needs Attention response automatically creates an unassigned task in the shared Task Pool. If that response is subsequently changed to Standards Met or N/A before completion, the generated open/in-progress task is cancelled.

After every prescribed question is answered, the walk advances to observation logging. The user may log one or more observations and then complete the monthly walk.

Question wording is snapshotted into `department_walk_responses` so editing future walk configuration does not rewrite historical walks.

## Observation / Event Logging

Observation logging collects:

- Store
- Department when applicable
- Event type
- Image
- Notes
- Optional task creation

Observation images are stored privately in the `walk-images` Supabase Storage bucket. Storage policies are scoped to the user's allowed stores.

## Store-Specific Walk Configuration

Admin Tools includes **Department Walk Questions**.

Admins can:

- Select a store
- Add departments
- Select a department
- Add walk questions
- Edit question wording
- Reorder questions
- Enable/disable questions

Configuration is store-specific. Stores may therefore have different departments and different prescribed questions.

## Task Pool

Tasks may originate from:

- Manual work (future entry flow)
- Needs Attention walk responses
- Observations

The Task Pool supports:

- Store filtering
- Unassigned pool state
- Assignment to active users with access to that store
- Priority
- Open / In Progress / Completed status
- Visibility of task source

## Data Model

V1 adds:

- `departments`
- `department_walk_questions`
- `department_walks`
- `department_walk_responses`
- `department_walk_observations`
- `tasks`
- private `walk-images` storage
- `user_can_access_store()` helper
- `current_user_is_admin()` helper
- `store_task_assignees()` lookup

Existing tables remain authoritative for:

- `stores`
- `user_profiles`
- `user_store_access`
- Supabase `auth.users`

## Deployment Sequence

Apply these migrations to the production Supabase project in order:

1. `supabase/migrations/20260812100000_department_walks_v1.sql`
2. `supabase/migrations/20260812100500_walk_images_storage.sql`
3. `supabase/migrations/20260812101000_task_assignees.sql`

Then merge/deploy the frontend PR.

Do not reverse the order by deploying the frontend before the migrations; the new screens are intentionally database-backed and will show setup errors until the tables/functions exist.

## Initial Setup After Deployment

For each store:

1. Open Admin Tools.
2. Open Department Walk Questions.
3. Select the store.
4. Add the departments used for that store.
5. Add the prescribed questions for each department.
6. Order and enable the questions.
7. Run a test monthly walk.
8. Mark one test response Needs Attention and confirm it appears in the Task Pool.
9. Assign the task to a user with store access.
10. Log a test observation with a photo and optional task.

## Current Branch / PR

- Branch: `agent/department-walk-v1`
- Draft PR: #10
- CI: lint, TypeScript, and Vite build passing on Node 18 and Node 20 as of 2026-08-12.
