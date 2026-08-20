# 10 Agent Prompts — Shift Setting System build

**Run 1, then 2, then 3 — one at a time, waiting for each to finish. Nothing from 4-10 starts
until all three are done.** They build the foundation (env → schema/RLS → auth) that every
later agent reads and depends on.

After 3 is done: run 4, 5 and 6 together, then 7 → 8 → 9 → 10 one at a time.

| Agent | Scope |
| --- | --- |
| **1** | Step 0 — Prerequisites |
| **2** | Step 1a — Migrations 01–10 (schema, RLS, storage) |
| **3** | Step 1b — Auth app layer (clients, proxy, sign-in) |
| | ⛔ *foundation gate — all three above done before anything below starts* |
| 4 · 5 · 6 | Ny Arbetare · Logga Project (+mig 13) · Cron sweep (+mig 11) — **may run together** |
| 7 | Step 4 — Project Detail |
| 8 | Step 6 — Logga Timmar + migration 14 |
| 9 | Step 7 — Home + migration 12 |
| 10 | Step 8 — Restyle |

---

## Common block — prepend this to every prompt below

```
Repo: c:\Users\2hej0\Downloads\customer\Bella service\Shift-Project-Setter
Spec: shift-setting-system-spec.expanded.md (22,312 lines) at the repo root.
Locked input: shift-setting-system-spec.md — READ ONLY. Never edit it.

Rules, all of them binding:
1. The spec is already decided. Implement it verbatim — do not redesign, do not
   "improve", do not add scope. If a code block in the spec is complete, use it as
   written. If you find an ellipsis or a "// implementation here", stop and report it
   as a spec defect rather than inventing the missing part.
2. Read §0 (lines 14-73) first — it defines the Interpretation/Tradeoff/Audit-note
   markers and the ground rules — then read your own assigned line ranges in full
   before writing anything.
3. §7's canonical migration manifest (lines 20269-20379) is the ONLY authority on
   migration filenames and timestamps. Never invent a timestamp. Never create a
   migration file that is not assigned to you.
4. Touch ONLY the files listed as yours. Other agents own the rest and are working at
   the same time. If your step seems to need a file you do not own, stop and report it
   instead of editing it.
5. The private schema is `kit`, never `app`. Any `app.*` helper is a regression.
6. All application reads/writes use the cookie-bound `authenticated` client
   (`getSupabaseServerClient()`). `supabaseAdmin` (service role) is for auth-user
   provisioning only — under a service-role JWT `auth.uid()` is null and the SQL
   guards reject every write.
7. Next.js is 16.3.1: `middleware.ts` is superseded by `src/proxy.ts`, and `params`,
   `searchParams`, `cookies()` and `headers()` are Promises that must be awaited.
   Check node_modules/next/dist/docs/ before relying on any routing/cookie API.
8. Nothing in this spec has ever been executed. You are the first run. Verify against
   a real database, not just that SQL parses.
9. Read §7.12 Cross-step gotchas (lines 22254-22283) before you write code.
10. Before marking done, run the §7.13 gate:
    npm run typecheck && npm run lint && npm run build
    Report your DoD results verbatim — actual command output, not a summary. If a DoD
    fails, say so plainly. Do not report a step as done on a failing DoD.
```

---

## Agent 1 — Step 0: Prerequisites

```
Implement Step 0 of the expanded spec: lines 20380-20806.

You own, and may touch only:
  .env.local                        NEW (gitignored — never commit it)
  .gitignore                        MODIFY (append supabase/.branches)
  supabase/config.toml              NEW (via `npx supabase init`, then set the keys in the 0.7 table)
  package.json                      MODIFY (zod@^4.4.3 + the scripts block from 0.9)
  package-lock.json                 MODIFY (written by npm install)
  scripts/check-bundle-secrets.mjs  NEW (the script is printed in full at 20657-20727)

Do NOT create any migration, any SQL file, or any file under src/.

Key points:
- Exactly one new runtime dependency across the whole build: zod@^4.4.3. Zod 4 API only.
- Env var names are NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY,
  SUPABASE_SERVICE_ROLE_KEY. Never prefix the service role key with NEXT_PUBLIC_.
- config.toml: [api] schemas must NOT include `kit` or `cron`; [db] major_version = 17;
  [auth] enable_signup = false and [auth.email] enable_signup = false — both required.

The linked project already exists (ref in supabase/.temp/project-ref). Reuse it.

Report DoD 0.a through 0.e (lines 20741-20796) with actual output. DoD 0.a must print
exactly three variables, none EMPTY. DoD 0.b must show only .env.local.example tracked.

Finally, print a checklist of the Supabase Dashboard actions you cannot perform yourself
(you have no browser) so a human can do them.
```

---

## Agent 2 — Step 1a: Migrations 01–10 (schema, RLS, storage)

```
Implement the database half of Step 1. Read, in this order:
  §3.1 Migration Plan          lines 106-1796
  §3.2 RLS Policies            lines 1797-3047
  §7.0.2 canonical manifest    lines 20269-20379
  Step 1 deliverables + DoD    lines 20808-21022

You own, and may touch only:
  supabase/schema.sql               DELETE (legacy scaffold, contradicts the locked spec)
  supabase/storage.sql              DELETE (same)
  supabase/legacy-teardown.sql      NEW (the one-off teardown, kept as a record)
  supabase/seed.sql                 NEW (empty or a comment; db reset looks for it)
  supabase/migrations/20260817120000_hardening.sql
  supabase/migrations/20260817120100_user_roles.sql
  supabase/migrations/20260817120200_workers.sql
  supabase/migrations/20260817120300_projects.sql
  supabase/migrations/20260817120400_project_services.sql
  supabase/migrations/20260817120500_project_workers.sql
  supabase/migrations/20260817120600_shifts.sql
  supabase/migrations/20260817120700_rls_policies.sql
  supabase/migrations/20260817120800_storage_profile_pictures.sql
  supabase/migrations/20260817120900_storage_policies.sql

That is files 01-10 of the manifest and nothing else. Files 11-14 belong to Agents 6, 5,
8 and 9. Do NOT create them. Do NOT touch anything under src/ — Agent 3 owns that.

STOP AND ASK THE HUMAN before running supabase/legacy-teardown.sql. It drops every
existing table in the linked Supabase project and is irreversible. Confirm with them
whether to run it against the local Docker stack only, or against the real linked
project, and whether they want `npx supabase db dump --linked -f backup.sql` taken first.

Critical details that are easy to get wrong:
- `create table` gets NO `if not exists` — a leftover table with wrong columns must fail
  loudly. Everything else is idempotent per the table at lines 222-231.
- Every table migration enables RLS in the same file that creates the table (statement
  order at lines 240-266). Policies live in file 08, not in the table files.
- public.projects carries EXACTLY three row triggers, all created in file 04. Never add
  a fourth anywhere.
- pgcrypto: `with schema extensions`. pg_cron: bare, and it is NOT yours — it is file 11.
- Do not `alter table storage.objects enable row level security` — you do not own that
  table and it fails.
- PII: workers.personal_number and workers.account_number are the reason §3.2 exists.
  Implement its column-level grants, the workers_safe view and the gated accessors
  exactly as written. This is the highest-stakes part of your step.

Report DoD 1.a through 1.d (lines 20875-20956) with actual output. DoD 1.c is a blocker:
an anon-key request for personal_number must return a permission error or [], NEVER a
value. Also run the §3.1 verification block at lines 1657-1742.
```

---

## Agent 3 — Step 1b: Auth app layer

```
Implement the application half of Step 1. Read:
  §5 Navigation Map / Routes / Auth Gating   lines 14471-17557
  Step 1 deliverables                        lines 20832-20871
  Step 1 DoD 1.e-1.g + failure modes         lines 20957-21021

You own, and may touch only:
  src/lib/routes.ts                     NEW — every URL and query-param name, `as const`
  src/lib/supabase/server.ts            NEW — getSupabaseServerClient(), SYNCHRONOUS
  src/lib/supabase/client.ts            NEW — browser client
  src/lib/supabase/admin.ts             MODIFY — service role, server-only, no v1 call site
  src/lib/supabase/require-user.ts      NEW — requireUser(): Promise<User>
  src/proxy.ts                          NEW — NOT the repo root; src/proxy.ts
  src/app/auth/actions.ts               NEW
  src/app/auth/sign-in/page.tsx         NEW
  src/app/auth/sign-in/SignInForm.tsx   NEW — "use client"
  src/app/auth/callback/route.ts        NEW
  src/app/auth/auth-error/page.tsx      NEW
  src/components/SignOutButton.tsx      NEW
  src/components/AuthListener.tsx       NEW
  src/app/layout.tsx                    MODIFY — mount <AuthListener /> only
  src/lib/types.ts                      MODIFY — see below

Do NOT create migrations. Do NOT touch src/app/ny-arbetare, logga-project, logga-timmar,
or page.tsx — Agents 4, 5, 8, 9 own those.

src/lib/types.ts is a shared collision point and you are the ONLY agent who reshapes it.
Land its final shape now, even where query bodies come later (see §7.10 rule 2, lines
22123-22130): Project gains start_date, status: 'active'|'inactive', activated_at,
deactivated_at, updated_at; Worker gains updated_at; HomeStats becomes
{ totalHours, activeProjectCount, monthShiftCount, monthStart }. Declare getActiveProjects().
Later agents may only ADD to this file, never reshape it.

The six ranked failure modes at lines 21005-21021 are the ones that actually happen:
1. The file must be src/proxy.ts and the export must be `proxy` (or default). A
   middleware.ts, or a proxy.ts exporting `middleware`, silently never runs and every
   route is public. DoD 1.e is the only thing that catches this.
2. Never getSession() server-side. getClaims() in proxy, getUser() in requireUser().
3. Never return a bare NextResponse.redirect() from proxy — it drops the rotated refresh
   token and logs users out hourly.
4. cookies() is a Promise in Next 16 — awaited INSIDE the getAll/setAll callbacks, not at
   client construction.

Report DoD 1.e, 1.f and 1.g with actual output. DoD 1.e must show 307 redirects for / and
/ny-arbetare and 200 for /auth/sign-in. DoD 1.f needs an admin user to exist — if the
human has not created one in the Dashboard yet, say so and list what they must do.
```

---

## Agent 4 — Step 2: Ny Arbetare  *(parallel with 5 and 6)*

```
Implement Step 2. Read:
  §4.5 Screen — Ny Arbetare   lines 12333-14470
  Step 2                      lines 21024-21127

You own, and may touch only:
  src/app/ny-arbetare/page.tsx            MODIFY — requireUser(), accept ?returnTo
  src/app/ny-arbetare/NyArbetareForm.tsx  MODIFY — hidden returnTo input
  src/app/ny-arbetare/actions.ts          MODIFY — requireUser(), RLS client for the insert
  src/components/BackButton.tsx           MODIFY — optional href, defaults to Home

Step 2 adds NO migration — its SQL (public.create_worker, kit.storage_filename_as_uuid,
the bucket and its policies) shipped in Agent 2's files 09/10. If those objects are
missing, stop and report it; do not write a migration to add them.

Agents 5 and 6 are running right now. Do NOT touch src/lib/queries.ts, src/lib/types.ts,
src/components/WorkerRows.tsx, src/components/SelectWithNew.tsx, anything under
src/app/logga-project/ or src/app/logga-timmar/, or any migration file.

Fields, verbatim from locked §4.5, in this order: Namn, profile picture (circular, optional),
E-postadress, Telefon Nummer, Adress, Person nummer, Kontonummer, Närmst Anhörig.
Submit label: `Lägg Till Arbetare`.

Restore Swedish diacritics — the scaffold has `Lagg Till Arbetare` and `Narmst Anhorig`.
The locked spec uses real characters. (This is NOT the same as the locked typo
`Logga Porject` in §4.2, which another agent preserves deliberately.)

The upload is the likely failure (lines 21118-21125): use the authenticated client per
the spec's write path, keep `contentType: file.type`, and keep the existing `file.size > 0`
guard — an untouched file input still arrives as a zero-byte File and would write a broken
URL for every worker who skipped the photo.

Report DoD 2.a-2.e (lines 21055-21113) with actual output.
```

---

## Agent 5 — Step 3: Logga Project + migration 13  *(parallel with 4 and 6)*

```
Implement Step 3. Read:
  §4.2 Screen — Logga Project      lines 5806-7515
  §6 LD-2 (activation)             lines 18016-18731
  Step 3                           lines 21129-21306

You own, and may touch only:
  supabase/migrations/20260817121200_project_write_rpcs.sql   NEW — manifest file 13
  src/app/logga-project/page.tsx           MODIFY
  src/app/logga-project/LoggaProjectForm.tsx  MODIFY
  src/app/logga-project/actions.ts         MODIFY — saveProject
  src/components/WorkerRows.tsx            MODIFY
  src/components/SelectWithNew.tsx         MODIFY
  src/lib/validation/project.ts            NEW (imports zod)

Migration 13 carries FIVE objects: public.action_idempotency,
create_project_with_details(), update_project(), set_project_status(),
project_total_hours(). The last three are Step 4's but they ship in YOUR file — see "Why
#13 is one file and not two" at lines 20316-20323. Do not split them out.

Agents 4 and 6 are running right now. Do NOT touch src/lib/queries.ts, src/lib/types.ts,
src/app/ny-arbetare/**, src/app/logga-timmar/**, src/app/logga-project/[id]/** (Agent 7),
or any other migration file. src/lib/types.ts already has its final shape from Agent 3.

Submit button label is `Logga Porject` — the locked spec's typo, PRESERVED VERBATIM.
Do not fix it. Flag it to the client as a copy question instead.

The activation rule (lines 21163-21196): activated_at = start_date at Europe/Stockholm
midnight when start_date is given, else created_at. It lives in
kit.projects_set_activation_defaults(), which is in Agent 2's migration file 04 — you do
not write it, you rely on it. Never use `start_date::timestamptz` (bare cast resolves at
the session timezone = UTC, landing 1-2h off) — not in code and not in a DoD query.

Do not call redirect() inside a try block — it throws NEXT_REDIRECT, the catch swallows
it, and the user sits on a dead form after a successful three-table write.

Report DoD 3.a-3.g (lines 21198-21292) with actual output. DoD 3.d proves the rule lives
in a trigger, not the form. DoD 3.f must return exactly five rows.
```

---

## Agent 6 — Step 5: Cron sweep + migration 11  *(parallel with 4 and 5)*

```
Implement Step 5. Read:
  §3.3 Scheduled Auto-Deactivation Job   lines 3048-4300
  §3.1 migration 9                       lines 1424-1552
  Step 5                                 lines 21477-21637

You own exactly ONE file and nothing else:
  supabase/migrations/20260817121000_project_auto_deactivation.sql   NEW — manifest file 11

You touch no application code at all. This step is a leaf — nothing depends on it. Agents
4 and 5 are editing src/ right now; stay out of it entirely.

The rule, verbatim from the locked spec: status = 'active' AND activated_at < now() -
interval '2 weeks' AND not exists (select 1 from shifts where shifts.project_id =
projects.id). Read it LITERALLY — no shifts have EVER been logged, not "no shifts in the
trailing two weeks". The misreading deactivates long-running projects that merely had a
quiet fortnight, and it is a data-destroying bug the client notices before you do.

Chosen path is pg_cron, not an Edge Function. Required shape:
- `create extension if not exists pg_cron;` written BARE — never `with schema extensions`;
  pg_cron is not relocatable and the clause errors.
- kit.deactivate_stale_projects() — security definer, search_path = '', returns integer.
- A thin public.deactivate_stale_projects() wrapper for RPC.
- cron.schedule('deactivate-stale-projects', '15 2 * * *', …).
- The extension + schedule MUST sit inside the availability guard printed at lines
  20340-20359. Files 12-14 sort after yours, so an unguarded failure here also takes out
  the Home read model and every write RPC. The sweep function itself is created
  unconditionally; only the extension and schedule are conditional.

The sweep writes ONE column: `status`. kit.projects_enforce_status_transition() (Agent 2's
file 04) derives deactivated_at. Sending deactivated_at yourself just adds a second place
for it to be wrong.

pg_cron is often unavailable on the local Docker stack and there is NO config.toml key to
preload it — do not invent one. If it is missing locally, apply everything except the
extension and schedule, and verify by calling the function synchronously as DoD 5.b does.

Report DoD 5.a-5.d (lines 21511-21606) with actual output. DoD 5.b must yield
deactivated_count = 1 with A inactive, B and C still active. DoD 5.c must return 0 —
a non-zero second run means the sweep re-touches rows and destroys deactivated_at's audit
value. Seed fixtures via start_date ONLY (the BEFORE INSERT trigger overwrites status and
activated_at — see the audit note at lines 21573-21581). Clean up your fixtures.
```

---

## Agent 7 — Step 4: Project Detail

```
Implement Step 4. Read:
  §4.3 Screen — Project Detail   lines 7516-9753
  Step 4                         lines 21308-21475

You own, and may touch only:
  src/app/logga-project/[id]/page.tsx        MODIFY — params is a Promise, await it
  src/app/logga-project/[id]/loading.tsx     NEW
  src/app/logga-project/[id]/not-found.tsx   NEW
  src/app/logga-project/actions.ts           MODIFY — ADD toggleProjectStatus only
  src/components/ProjectStatusButton.tsx     NEW
  src/lib/queries.ts                         MODIFY — getProjectWithDetails(id) returns totalHours

Step 4 adds NO migration. update_project(), set_project_status() and project_total_hours()
already shipped in Agent 5's migration file 13. Writing your own migration is exactly how
the 20260817120000_project_detail.sql collision with _hardening.sql came back. Do not.

src/lib/queries.ts is a shared collision point — Agents 8 and 9 edit it after you. ADD
functions; do not reshape existing ones or touch src/lib/types.ts.

THE most important contract in this step (lines 21339-21388): both buttons write exactly
ONE column, `status`. Never a lifecycle timestamp.
    update public.projects set status = 'inactive' where id = …   -- Avsluta
    update public.projects set status = 'active'   where id = …   -- Aktivera
kit.projects_enforce_status_transition() derives activated_at/deactivated_at from the
transition. Sending them yourself appears to work, then raises restrict_violation the
first time a user double-clicks the button or a revalidation replays the action against an
already-toggled row. The server action calls public.set_project_status(p_project_id,
p_expected_status, p_next_status), which handles the stale/noop cases.

Deletion is out of scope (locked §8). There is no delete button on this screen.

The edit path deletes and re-inserts project_services and project_workers — the delete and
the insert must be atomic, or a failure between them leaves the project with zero services
and the user staring at data loss.

Report DoD 4.a-4.f (lines 21390-21460) with actual output. DoD 4.b includes clicking
Aktivera twice — the second click must not error and must not move activated_at.
```

---

## Agent 8 — Step 6: Logga Timmar + migration 14

```
Implement Step 6. Read:
  §4.4 Screen — Logga Timmar   lines 9754-12332
  Step 6                       lines 21639-21787

You own, and may touch only:
  supabase/migrations/20260817121300_log_shifts.sql   NEW — manifest file 14
  src/app/logga-timmar/page.tsx                    MODIFY — searchParams is a Promise, await it
  src/app/logga-timmar/LoggaTimmarForm.tsx         MODIFY — multi-worker rows
  src/app/logga-timmar/LoggaTimmarProjectSelect.tsx MODIFY — active-only + `+ Nytt Project`
  src/app/logga-timmar/actions.ts                  MODIFY — logShifts
  src/components/DateSelect.tsx                    MODIFY
  src/lib/schemas/shift.ts                         NEW (imports zod)
  src/lib/queries.ts                               MODIFY — ADD getActiveProjects()

getActiveProjects() REPLACES getProjects(), which does not filter by status. Agent 9 edits
queries.ts after you — add, do not reshape. Do not touch src/lib/types.ts.

Migration 14 carries public.log_shifts() (atomic N-row insert, active-project check,
idempotent per p_submission_id via a deterministic shifts.id — it does NOT use file 13's
action_idempotency table) and shifts_project_worker_date_idx.

Both project-creation paths are kept deliberately (locked Decision 4): the dropdown lists
only active projects, so the separate `+ Lägg Till` button is the escape hatch when the
dropdown comes up empty. They are NOT redundant. Do not "simplify" them into one.

The single most likely failure (lines 21779-21782): the second Arbetare dropdown. Rendering
it with the same name but reading it with formData.get("worker_id") silently inserts one
row and drops the second worker — success redirect, half the data. It must be
formData.getAll("worker_id"). Keep the existing Set-based de-duplication so the same
worker chosen twice inserts one row, not two.

The date is assembled from three dropdowns by zero-padded string concatenation. Never route
it through new Date() — that is an off-by-one-day timezone bug.

Report DoD 6.a-6.i (lines 21674-21772) with actual output. DoD 6.e must be rejected at BOTH
layers — the action guard and the table's hours > 0 check constraint.
```

---

## Agent 9 — Step 7: Home + migration 12

```
Implement Step 7. Read:
  §4.1 Screen — Home     lines 4307-5805
  §6 LD-1 (Månads pass)  lines 17666-18015
  Step 7                 lines 21789-21954

You own, and may touch only:
  supabase/migrations/20260817121100_home_read_model.sql   NEW — manifest file 12 (the last one)
  src/app/(home)/page.tsx          MOVE from src/app/page.tsx, then rewrite
  src/app/(home)/loading.tsx       NEW
  src/app/(home)/error.tsx         NEW — "use client"
  src/app/(home)/_components/*.tsx NEW — HomeHeader, HomePrimaryActions, HomeStatRow,
                                   OngoingProjectsList, OngoingProjectRow, HomeSkeletons
  src/app/not-found.tsx            NEW — stays at the root
  src/app/global-error.tsx         NEW — "use client", stays at the root
  src/components/StatCard.tsx      MODIFY — optional subtitle
  src/lib/queries.ts               MODIFY — rewrite getHomeStats() and getOngoingProjects()
  src/lib/format.ts                NEW — formatHours, formatCount, formatMonthNameSv

src/app/page.tsx must be MOVED, not copied. Leaving it alongside src/app/(home)/page.tsx is
two routes resolving to / and `next build` fails outright. There must be no bare
src/app/loading.tsx or src/app/error.tsx either — at src/app/ they apply to every nested
segment, so Home's skeleton would flash on the way to /ny-arbetare and /logga-timmar.

The scaffold implements the WRONG rules and must be replaced, not extended. Verified in
src/lib/queries.ts: getHomeStats() derives "active" from at least one shift in the last 30
days and returns a worker count as the third stat. The correct three:
  Loggade Timmar — sum(shifts.hours) across all shifts
  Aktiva Project — count(*) where projects.status = 'active'
  Månads pass    — count of shifts whose shift_date is in the current calendar month,
                   with the Swedish month name as a subtitle
Shipping the 30-day heuristic under the new labels renders plausibly and errors nothing —
DoD 7.c is the only thing that catches it.

The month window is computed in Postgres against public.app_timezone(), never with
new Date() in the Server Component. get_home_stats() returns month_start (a date);
formatMonthNameSv() in src/lib/format.ts is the ONLY thing that turns it into `Augusti`.
There is no monthLabel field and SQL returns no month name — lc_time is C on Supabase, so
to_char(…,'TMMonth') would return `August`.

Each Pågående Project row is tappable → /logga-project/[id] (Project Detail), NOT the
/logga-project create form. Wiring it to the create form violates locked Decision 3.

Report DoD 7.a-7.i (lines 21860-21941) with actual output. After your migration, db:list
shows fourteen rows and every later migration is stamped by `npx supabase migration new`,
never by hand.
```

---

## Agent 10 — Step 8: Restyle

```
Implement Step 8. Read:
  Interpretation E   lines 20243-20248
  Step 8             lines 21956-22049
  Locked §8          lines 22304-22312 (binding — adds no scope)

You own:
  src/app/globals.css              MODIFY — Tailwind v4 theme tokens
  src/app/layout.tsx               MODIFY — shell chrome only
  src/components/*.tsx             MODIFY — classes only
  src/app/**/page.tsx, **/*Form.tsx  MODIFY — classes and wrapper elements only

BEFORE you change anything, take the two snapshots — they are the only cheap way to prove
you broke nothing:
  grep -rho 'name="[a-zA-Z_]*"' src/app src/components | sort | uniq -c > before-names.txt
  grep -rhoE '>[^<>{}]*[A-Za-zÅÄÖåäö][^<>{}]*<' src/app src/components | sort -u > before-copy.txt

You MAY change: Tailwind classes, colors, spacing, typography, radii, shadows, icons, the
wrapper elements around a control, aria-* attributes.

You MAY NOT change: any form field `name` attribute (they are the server-action contract),
any route path or query-param name, any Swedish label INCLUDING the locked typo
`Logga Porject`, any query in src/lib/queries.ts, any server action, or the set and order
of controls on a screen. Do not edit src/lib/routes.ts at all.

The likely failure: renaming a form field while cleaning up markup — e.g. client_name →
clientName to match a component prop. The page renders, the form submits, and the server
action silently receives null and writes NULL to the database. Nothing throws.
Runner-up: "fixing" `Logga Porject`. It is a locked label. Flag it, do not fix it.

Report DoD 8.a-8.e (lines 21986-22035). DoD 8.a's diff must be empty. DoD 8.d — re-running
the entire §7.11 smoke-test checklist (lines 22138-22252) end to end — is the real DoD and
is non-negotiable.
```

---

## Human-only tasks (no agent can do these)

Agents have no browser. Do these yourself in the Supabase Dashboard before Agent 3's DoD 1.f:

1. Authentication → URL Configuration → **Site URL** = `http://localhost:3000`
2. Authentication → URL Configuration → **Redirect URLs** += `http://localhost:3000/auth/callback`
3. Authentication → Sign In / Providers → Email → **"Allow new users to sign up" OFF** —
   required, because the `on_auth_user_created` trigger makes every new user an admin
4. Authentication → Users → **Add user**, email confirmed — this is the only admin account

Also decide before Agent 2 runs: local Docker stack first, or straight against the linked
project. Agent 2's teardown is destructive and irreversible either way.
```
