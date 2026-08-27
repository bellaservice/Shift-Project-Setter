# Shift Scheduling System — Implementation Spec

## Instructions for the implementing agent

Build the system described below exactly as specified. If any requirement is ambiguous, underspecified, or conflicts with another requirement in this document, STOP and ask a clarifying question before writing code for that piece. Do not guess or silently resolve conflicts.

**Revision note (2026-08-25):** real-time clocking was added to this spec in Section 5. It did not exist in any earlier revision. Section 3 gained a Phase (Execution), Section 6 was amended to describe how clocked data reaches the confirmation screen, and Section 8 records the two decisions that were taken to resolve it. Phase and section numbers after Section 4 shifted by one; cross-references in this document have been updated, but any external document or ticket citing "Section 5" or "Phase 3" from an earlier revision now points one place short.

---

## 1. Roles

| Role | Scope in this system |
|---|---|
| **Admin** | Out of scope for shift-setting logic. Only touches the Workday Diary (see Section 7). |
| **Arbetsledare** | Creates shifts, confirms/edits/denies completed shifts, resolves multi-project conflicts, and may overwrite clocked times (Section 5.5). |
| **Arbetare** | Confirms/denies assigned shifts, pre-picks days/projects, clocks in and out of shifts (Section 5), may hold Fastanställd status. |

Two of these are real database roles as of 2026-08-26: `accounts.role` is `arbetsledare` or `arbetare`, and the difference is enforced by RLS and a trigger rather than by the interface — see 8.5b. Admin remains a description of a person, not a value in a column.

Each role sees a different menu. An arbetare gets **Stampla** and not **Bekrafta Pass** or **Alla Arbetare**; an arbetsledare gets the reverse. A role that is missing or unrecognised is treated as `arbetare` everywhere — falling out of the accounts table must grant less, never more.

---

## 2. Worker Attributes

- **Fastanställd**: A status flag on a worker. A Fastanställd worker is automatically included on every shift for which they are eligible, unless they have explicitly marked that specific day as "can't work." This overrides all other picking logic except when it conflicts with another Fastanställd worker for the same limited spots (see Section 4).
- **Pre-picked days**: An arbetare can mark specific days/projects in advance as days they want to work. This is not a general availability calendar — it is a per-day, per-project pick.
- **Can't-work day**: The only thing that overrides Fastanställd auto-inclusion. If a Fastanställd worker marks a day as can't-work, they are excluded from shifts that day.

---

## 3. Shift Lifecycle (Phases)

### Phase 1 — Scheduling (push model)
- Arbetsledare creates shifts in advance, up to a full month at once.
- Each shift specifies: project, date, required headcount.
- No arbetare availability calendar exists in this system. It has been replaced entirely by pre-picks and the confirm/deny mechanism below.

### Phase 2 — Confirmation (worker side)
- Once a shift is created, it becomes visible to eligible workers according to the picking order in Section 4.
- Eligible workers confirm or deny.
- Once required headcount is reached, the shift is removed from the view of all remaining eligible workers who have not yet responded.

### Phase 3 — Execution (clocking, worker side)
- On the day of the shift, the assigned arbetare clocks in when they start and clocks out when they finish. See Section 5 for the full rules.
- A shift being clocked is **not** yet in the arbetsledare's queue. It enters the queue only once it is clocked out, or once its date has passed (Phase 4).
- **The screen is `/stampla`.** It lists only the signed-in worker's own shifts, for today and yesterday (8.4), and offers exactly one control per shift — "Stampla In" or "Stampla Ut" depending on whether `clock_in_time` is set. There are no time pickers and no fields: the moment is the moment the button is pressed.
- **The timestamp comes from the database, not the phone.** The write sends Postgres's `'now'` literal, so the value is the server's clock. A phone running ten minutes fast would otherwise write ten minutes of error into what is meant to be evidence of hours worked, and nobody would notice.
- An account with no `worker_id` — office staff — has no shifts of its own to clock, and the screen says so plainly rather than showing an empty list that looks broken.

### Phase 4 — Close-out (leader side, report screen)
- Every shift whose date has passed automatically enters the arbetsledare's confirmation queue. A shift left in `open` (clocked in, never clocked out) enters the queue too — see Section 5.4.
- Queue ordering: oldest passed shift first, newest at the bottom. No manual sorting required — this prevents the leader from having to scroll to find the oldest pending item.
- Rows are grouped by day. Each day header displays the date and the day of the week.
- Each row represents one worker's one shift, and displays:
  - Worker name
  - Project/shift name
  - The clocked times and the hours derived from them (Section 5.2), where the worker clocked
  - Plus/minus control on start time
  - Plus/minus control on end time
  - "Sen" (late) checkbox — see Section 6
  - An X control to cancel/mark no-show
  - A Confirm button
- Confirmation is final. No edits are permitted after a row is confirmed.

---

## 4. Slot-Filling Logic

Slots for a given shift are filled in the following strict order:

1. **Fastanställd workers** — auto-included, unless marked can't-work that day.
2. **Pre-picked workers** — fill whatever spots remain after step 1.
3. **Open pool (accept/deny)** — fills whatever spots remain after step 2. First-accepted-wins; a slot closes the instant it's taken.

### 4.1 Conflict: Fastanställd demand exceeds available spots
If the number of eligible Fastanställd workers for a shift exceeds the spots available, resolve via the **Priolista** (Section 4.4):
- The worker(s) with the fewest shifts worked in that week get the spot(s).
- A shift does not need to be confirmed yet to count toward this week's tally — an unconfirmed assignment already made for that worker this week still counts.

### 4.2 Conflict: Pre-picked worker, but Fastanställd already filled all spots
If Fastanställd auto-fill (step 1) consumes all available spots before pre-picks are applied (step 2), the pre-picked worker does not get the shift. There is no bump, no overflow allowance, no exception. They are simply excluded from that shift.

### 4.3 Both conflicts (4.1 and 4.2) occurring on the same shift
The two rules run **independently**, not sequentially against a shared leftover pool:
1. Resolve the Fastanställd overflow first via Priolista. Workers who lose this round are excluded — full stop. They do NOT roll over into the pre-pick stage.
2. Pre-pick then applies only to whatever spots remain after step 1 is fully settled.
3. If no spots remain after step 1, pre-picked workers get nothing, per Section 4.2.

### 4.4 Priolista (Priority List) — used by both 4.1 and the open pool
Ranking order for who gets a contested spot:
1. Sort eligible workers by number of shifts worked in the current week span, ascending (fewest shifts = highest priority).
2. Fill spots top to bottom in that order.
3. Every time a worker is marked "Sen" (Section 6) on a confirmed shift, they move down one position in the Priolista, cumulative per late instance (i.e., 3 late marks = 3 positions lower, applied going forward to future rankings).

### 4.5 Multi-project same-day conflict
If a worker is Fastanställd or pre-picked across two different projects on the same day, this is NOT resolved automatically at scheduling time. It is deferred to the arbetsledare, who makes the deciding call manually at the confirmation screen using the edit controls described in Section 6.

---

## 5. Real-Time Clocking

Workers clock in and out of shifts as they happen. The system derives an hours figure from those clock times, and the arbetsledare confirms a final figure against it.

### 5.1 Shift statuses

A shift carries exactly one of three statuses:

| Status | Meaning | Clock state | `hours` |
|---|---|---|---|
| `open` | Worker has clocked in and not yet clocked out. The shift is in progress. | `clock_in_time` set, `clock_out_time` null | null |
| `closed` | Worker has clocked out. Awaiting the arbetsledare. | both set | null |
| `confirmed` | Arbetsledare has confirmed the shift. Final and locked. | both set, or both null for a manually logged shift | **not null** |

Legal transitions are `open → closed → confirmed`, plus `→ confirmed` directly for a shift that was never clocked (see 5.6). A confirmed shift never leaves `confirmed` — this is Section 3, Phase 4's "confirmation is final," expressed as a state machine.

`status` is a text column with a check constraint, not a Postgres enum, matching the existing convention on `projects.status`: widening a check constraint is an ordinary transaction, widening an enum is not.

### 5.2 Fields

| Field | Type | Null | Written by |
|---|---|---|---|
| `status` | text | no, default `'confirmed'` | system / arbetsledare |
| `clock_in_time` | timestamptz | yes | arbetare at clock-in; arbetsledare may overwrite (5.5) |
| `clock_out_time` | timestamptz | yes | arbetare at clock-out; arbetsledare may overwrite (5.5) |
| `clock_in_original` | timestamptz | yes | **trigger only** — append-only (5.5) |
| `clock_out_original` | timestamptz | yes | **trigger only** — append-only (5.5) |
| `clock_edited_at` | timestamptz | yes | **trigger only** — stamped on first divergence (5.5) |
| `clock_edited_by` | uuid | yes | **trigger only** — `auth.uid()` at first divergence (5.5) |
| `calculated_hours` | numeric | yes | system, derived at clock-out |
| `hours` | numeric | **yes** — see 5.3 | arbetsledare at confirmation |

The clock fields are `timestamptz`, not `time`, because a clocking is an *event*: it happens once, at an instant, and must stay comparable across a daylight-saving transition. This distinguishes them from the existing `start_time` / `end_time`, which are `time` and describe a *planned* span on a schedule.

**`calculated_hours` is the raw span**, `(clock_out_time - clock_in_time)` expressed in hours. It does **not** deduct unpaid breaks, because this system does not track breaks. This is precisely why it cannot simply become `hours`: a shift with an unpaid break has a longer span than the hours actually worked. The existing schema already documents this decoupling on the `hours` column, and clocking does not change it.

**`calculated_hours` is advisory.** It is what the leader looks at while deciding. It is never what is paid, never what is summed, and never what reaches the Workday Diary.

### 5.3 `hours` is nullable

`hours` is nullable. An `open` or `closed` shift has no confirmed hours yet, and the column records that honestly rather than storing a placeholder that would be indistinguishable from a genuinely zero-hour shift.

The following invariant is enforced in the database, and is what keeps nullability safe:

> **A shift with `status = 'confirmed'` must have a non-null `hours`.**

So no shift can ever be confirmed — and therefore no shift can ever reach payroll or the Workday Diary — without a real figure the arbetsledare put there. Null `hours` means exactly "not confirmed yet," and nothing else.

⚠️ **Accepted risk, recorded deliberately.** The Supabase client in this app is untyped (`SupabaseClient` with no `Database` generic, and no generated types), and `Number(null)` is `0` in JavaScript rather than `NaN`. A null therefore produces **neither a compile error nor a runtime error** — it silently becomes zero. Every read of `hours` must be audited by hand; the compiler will not find them. See Section 8.3 for the audit checklist. The alternative (a not-null placeholder) was considered and rejected in favour of honest data.

### 5.4 A shift left `open`

A worker who clocks in and never clocks out leaves the shift `open` past its date. Such a shift:
- still enters the arbetsledare's queue at Phase 4, so it cannot be lost;
- has `calculated_hours` null, because there is no span to derive one from;
- is resolved by the arbetsledare supplying `clock_out_time` (5.5) or simply setting `hours` directly and confirming.

### 5.5 Clocked times are editable — and the original is kept

The arbetsledare **may overwrite `clock_in_time` and `clock_out_time`** on any shift that is not yet confirmed. The plus/minus controls described in Section 6 act on these values, and the overwritten value is what the Workday Diary reports.

The worker's original stamp is **not** lost when that happens. Three columns carry the audit trail, and all three are maintained by a database trigger — never by the application:

| Column | Holds |
|---|---|
| `clock_in_time` / `clock_out_time` | the **effective** time: what is reported, what the leader may change |
| `clock_in_original` / `clock_out_original` | the **first** value the column ever held, frozen |
| `clock_edited_at` | when an effective time first diverged from its original; null means untouched |
| `clock_edited_by` | `auth.uid()` of whoever caused that first divergence |

`clock_edited_by` is null when the change came from outside a request context — the SQL console, `service_role`, or cron have no JWT to read a `sub` from. Null therefore means "no signed-in identity", not "unknown person", and `clock_edited_at` is still stamped in that case, so the trail never disappears entirely. There is deliberately no foreign key to `auth.users`: deleting a login must not take with it the record of what that login did.

"Was this edited?" needs no column of its own — it is `clock_in_time is distinct from clock_in_original`.

The originals are enforced append-only: once set, the trigger overwrites any attempt to change them, including an explicit `update ... set clock_in_original = ...`. A trigger rather than application code, for two reasons: it cannot be forgotten, and it applies equally to a row written from a SQL console.

⚠️ **What `original` means, precisely.** It is the *first value the column received*, not "the worker's stamp." The trigger cannot see who is writing. If the arbetsledare fills in a clock-out for a worker who forgot to clock out (5.4), the leader's value becomes the original — there was no worker stamp to preserve. `clock_edited_at` stays null in that case, because filling in a missing value is not an edit of an existing one. This is the honest reading of the column and the one to rely on when debugging.

The database enforces ordering, not authorship:
- `clock_in_time <= clock_out_time` whenever both are present;
- `clock_out_time` may not be set without `clock_in_time`;
- the same ordering rule applies to the original pair.

All of these tolerate nulls, so an in-progress shift (`clock_out_time` null) is always legal.

When a clocked time is overwritten, `calculated_hours` is recomputed from the new span. `hours` is not touched by this — it changes only when the arbetsledare sets it.

### 5.6 Coexistence with manual shift logging

The existing "Logga Pass" flow — the arbetsledare recording a finished shift and its hours directly, with no clocking involved — continues to work unchanged. Such a shift is written with `hours` set, both clock fields null, and `status = 'confirmed'`.

This is why `status` defaults to `'confirmed'` rather than `'open'`: a manually logged shift is already final, and a default of `'open'` would make every such row appear to be a shift someone is standing in right now.

---

## 6. Confirmation Screen — Detailed Behavior

- Any row that is confirmed, edited, denied, or has its project switched appears on the front page of the confirmation screen.
- Each row displays the clocked times and `calculated_hours` alongside the editable controls, so the leader is adjusting against visible evidence rather than from memory.
- Each row has a **"Sen" checkbox**.
  - When checked, it unlocks the time-edit controls (plus/minus on start time, plus/minus on end time) for that specific row. Per Section 5.5 these controls act on `clock_in_time` / `clock_out_time`.
  - Marking "Sen" is what triggers the Priolista demotion described in Section 4.4.
- Confirming a row requires a non-null `hours` value (Section 5.3). The leader may accept `calculated_hours` as-is or enter a different figure; either way the value is written to `hours` explicitly.
- Confirmation per row is final once submitted — no post-confirmation edits.
- Rows are grouped and displayed by day, oldest day first (see Section 3, Phase 4).

---

## 7. Workday Diary (Admin-only, motivator mechanism)

- A document generated for Admin only. Contains the full legal record of actual hours worked: start/end times, duration, tasks performed, and all confirmed shift details.
- Hours reported in this document come from `hours`, never from `calculated_hours` (Section 5.2).
- **Generation is blocked** until every shift within the target date range has been confirmed by the arbetsledare. Since confirmation requires non-null `hours`, this guarantees the document never contains a blank or placeholder figure.
- This block is **hard**. The Arbetsdagbok screen already has a survey gate for optional fields the client may genuinely not have (a forgotten org number), which the user can step past with `fortsatt=1`. An unconfirmed shift is not that kind of gap — it resolves on its own once the leader acts — so it sits outside that escape hatch and offers no "generate anyway". An unconfirmed shift is also never folded into a day table: rendering it as `0` would read as "the worker was here and did nothing," which is a different claim from "this is not finished yet."
- This is the system's built-in pressure mechanism: Admin cannot obtain this legally-required document until the arbetsledare has confirmed all outstanding shifts. Any follow-up (e.g., Admin messaging the leader to confirm faster) happens outside the software and is not part of this system's scope.
- See the caveat in Section 5.5 regarding edited clock times and this document's evidentiary standing.

---

## 8. Decisions and Open Items

### 8.1 Resolved 2026-08-25 — `hours` nullability
`hours` is nullable, guarded by the confirmed-implies-non-null invariant in Section 5.3. Chosen over a not-null placeholder of `0` so that "not yet confirmed" and "confirmed as zero hours" remain distinguishable in the data. Accepted cost: the untyped client cannot flag null reads, so the audit in 8.3 is manual.

### 8.2 Resolved 2026-08-25 — authority over clocked times, and the audit trail
The arbetsledare may overwrite clocked times, **and the original stamp is retained** (Section 5.5). This supersedes the earlier form of this decision, which allowed overwriting with no audit trail and accepted the loss of the original as a cost. That cost is no longer accepted, and no longer paid: `clock_in_original` / `clock_out_original` / `clock_edited_at` are trigger-maintained and append-only, so the Workday Diary reports the leader's figures while the worker's stamps remain reconstructable.

The identity gap noted earlier is now closed too: `clock_edited_by` records `auth.uid()`. The one residual limitation is the meaning of "original" spelled out in 5.5 — it records the first value written, which is not always a worker's stamp.

### 8.3 Resolved 2026-08-25 — audit of `hours` reads
Done. Every `Number(s.hours)` in `src/lib/queries.ts` was replaced with one of two named helpers — `readHours` (returns `number | null`, never coerces absence to zero) or `hoursForSum` (an unconfirmed shift contributes nothing, stated deliberately at the call site). The grouping key in `getPassProblems` now distinguishes unconfirmed from zero with a marker that cannot collide with a number.

The compiler was recruited rather than trusted: the per-row `hours` fields on `Shift`, `RecentShiftRow`, `PassProblem`, `DayShift` and `ShiftDetail` were widened to `number | null`. Those are the app's own types, so unlike the untyped Supabase client they *are* checked — widening them turned seven silent zeros into seven compile errors, each since handled. `ArbetsdagbokRow.hours` deliberately stayed `number`: the document type must be unable to represent an unconfirmed row.

### 8.3b Note for future work — the compiler's blind spot remains
The safety above comes from the app's own types. Reads straight off the Supabase client are still unchecked, so any *new* query that touches `hours` must go through `readHours` / `hoursForSum` by discipline. Running `npm run db:types` and typing the client would close this properly.

### 8.4 Resolved 2026-08-26 — clocking UI and permissions

**The device.** Each arbetare clocks in from **their own phone, under their own personal login**, which is what makes the clock stamps attributable to a person rather than to a shared device. Every worker therefore needs an account and a password they can recover.

**Date restriction — a soft window, not a hard rule.** The clocking screen lists the worker's shifts for **today and yesterday**; the database forbids nothing beyond that. Two reasons a hard `shift_date = today` rule was rejected: a night shift that begins at 22:00 is clocked out after midnight and would fall outside its own date, and site signal is unreliable, so a worker who could not clock out on the spot must be able to do it next morning rather than ask the leader to repair it. The real control is elsewhere — the arbetsledare confirms every shift and sets `hours` personally, so clock times are evidence, never payroll.

**Unassigned shifts — impossible, not merely forbidden.** `shifts_update_egen_stampling` admits only rows where `worker_id = kit.min_arbetare_id()`, so an attempt on someone else's shift matches zero rows and the screen says so. No extra validation exists because none can be reached: the screen never lists another worker's shift, and the database would refuse it even if it did.

### 8.4c Resolved 2026-08-26 — what a scheduled-but-unstarted shift is

The three statuses in 5.1 describe a shift that has been clocked. A shift the leader created in advance (Phase 1) but nobody has started yet is **`status = 'open'` with `clock_in_time` null**. So `open` carries two sub-states, told apart by the clock:

| `status` | `clock_in_time` | Means |
|---|---|---|
| `open` | null | scheduled, not started |
| `open` | set | in progress |
| `closed` | set | finished, awaiting the leader |
| `confirmed` | either | final |

No fourth status was added: the distinction is already carried by a column that must be read anyway, and a new status would have meant widening `shifts_status_check` and revisiting every query that filters on it. A scheduled shift nobody clocked into simply reaches the leader's queue once its day passes, with no stamps — which is exactly a no-show, and 8.4b already says what to do with one.

### 8.4b Resolved 2026-08-25 — what "no-show" writes
The X control in the confirmation row confirms the shift at **zero hours** rather than deleting the row. The shift was scheduled, and the fact that the worker did not appear is information the Workday Diary and the Priolista both have reason to hold; a deleted row instead asserts the shift never existed. This is representable in the three statuses without a fourth, which is why no status was added.

⚠️ Note the consequence: a no-show becomes a confirmed 0-hour row, and the Workday Diary will print it as `0`. Whether the document should instead omit or annotate such rows is not settled here.

### 8.7 Resolved 2026-08-27 — changing a role, and the lockout that guards it

**The screen.** `Installningar > Konto` gained a role switch per account — one segmented control, not two buttons. An amber plate sits over the role the account holds and slides across when the role changes; that movement is the confirmation, so there is nothing to save and nothing to dismiss. Two buttons side by side would have said "here are two things to do"; a switch with a marked position says "the account is this, and it can be moved", which is what is true.

The held half is disabled, because pressing the role an account already holds would be a write that changes nothing while the screen reported a success that never happened. It reads as selected rather than greyed out, since it is the lit half.

One form with two submit buttons carrying `name="roll"`, rather than two forms: a submit button contributes its own value to the form data, so the whole switch is a single submission and `konto_id` appears once. The list is leader-only; an arbetare reaching it is turned away, and `accounts_update_arbetsledare` refuses their write regardless.

Setting a role at *creation* time is not included. Accounts are minted through an Edge Function holding the service-role key, which is a separate deployment path; new accounts therefore still default to `arbetare` and are promoted afterwards. Deferred deliberately.

**⚠️ The lockout this opens, and the guard that closes it.** A role switch is the one control that can lock the company out of its own system: the last active arbetsledare demotes themselves, and from that moment nobody may write to `public.accounts` — because promotion requires exactly the role that just disappeared. It is unrecoverable from inside the app and needs direct database access to repair.

`kit.accounts_behall_en_arbetsledare()` (`before update or delete` on `accounts`) refuses any change that would leave zero active arbetsledare. It closes three routes into the same ditch, not one:

| Route | Why it counts |
|---|---|
| `role` → `arbetare` | the obvious one |
| `status` → `pausad` / `avstangd` | `kit.ar_arbetsledare()` requires *both* role and active status, so a paused leader is exactly as powerless as a demoted one |
| the row is deleted | including via the `auth.users` cascade |

Promotion is never blocked — the guard only looks at accounts *leaving* the set. `SECURITY DEFINER`, so it counts every account and not merely those the caller's own policies reveal; otherwise an invisible colleague would make a safe change look like the last one.

The check lives in the database, not the button, for the same reason as the rest of the role work: the browser holds its own JWT and can call PostgREST directly. A React-side check is one you can walk around, and this is far too expensive to walk around by accident.

### 8.6 Partly resolved 2026-08-27 — scheduling (`/skapa-pass`)

**What was built.** A leader screen that creates shifts in advance: date, project, one or more named workers, and optional planned Pass Tider. Rows are written `status='open'`, `hours` null, no clock stamps — the "scheduled, not started" state of 8.4c. This is what makes clocking usable at all; before it, `/stampla` could only ever be empty, because Logga Timmar writes finished `confirmed` rows.

Deliberately absent: **no hours field.** A shift that has not happened has no hours worked, and offering the field would invite a number nobody earned.

A duplicate guard rejects a second *unconfirmed* shift for the same worker, project and date, naming who already has one. Already-confirmed shifts are history and never count as duplicates. There is no unique constraint behind this — genuinely split days exist — so it is a check, not a rule.

**⚠️ This is NOT Section 4.** There is no headcount, no Fastanställd auto-fill, no pre-picks, no can't-work days and no Priolista. The leader names each worker. Section 4's logic remains entirely unimplemented.

**⚠️ The remaining structural obstacle.** `public.shifts` conflates *a shift* with *one worker's assignment to it* — one row per worker. Section 3 Phase 1 describes a shift with a **required headcount** that several workers fill, and Phase 2's "removed from view once headcount is reached" cannot be expressed until those are separate things. A faithful Phase 1 therefore needs `shifts` (project, date, headcount) plus an assignments table, and that restructure touches every query that treats a shift row as one person's work — the confirmation queue and every hours total included. `/skapa-pass` sidesteps it rather than solving it, and should be replaced when that work happens.

### 8.6b Resolved 2026-08-27 — `calculated_hours` is derived, not written

`kit.shifts_derive_calculated_hours()` recomputes the column from the two clock stamps on every insert and update. A client cannot set it.

The bug that forced this: clocking sends Postgres's `'now'` so the *server* fixes the instant, which means the app cannot know the span it is about to create. Every shift clocked out through `/stampla` therefore got `calculated_hours` null, and the leader met "Klockan sager –" on exactly the shifts clocking exists to produce. Deriving in the database fixes it for every path at once — clocking, leader adjustment, and direct SQL.

### 8.5b Resolved 2026-08-26 — how the two roles are actually enforced

`accounts.role` (`arbetsledare` | `arbetare`, text + check, defaulting to **`arbetare`** so nothing is born privileged) plus `kit.ar_arbetsledare()` and `kit.min_arbetare_id()`, both `SECURITY DEFINER`. Every `for all using(true)` policy is gone; `shifts`, `workers` and `accounts` carry per-command policies.

The load-bearing pieces, each guarding a specific way the system could be cheated:

| Guard | Prevents |
|---|---|
| `kit.shifts_guard_leader_columns()` | a worker writing `hours` or `status` — i.e. setting their own pay or confirming their own shift |
| `shifts_update_egen_stampling` | touching anyone else's shift |
| leader-only writes on `accounts` | a worker promoting themselves, which would unravel everything above |
| leader-only `select` on `workers` (own row excepted) | reading colleagues' `personal_number` and `account_number` |

**Clocking out is the one hole, and it is exactly one transition.** A clock-out is two columns at once — `clock_out_time` plus `status` `'open' → 'closed'` — and the guard above rejected the second half, so workers could clock in and never out. Migration `20260826130000_utstampling.sql` permits that single transition, and only when accompanied by the shift's *first* clock-out. Reopening a closed shift, confirming, closing without clocking out, and smuggling `hours` alongside are all still refused.

**The UI is role-aware, but the UI is not the boundary.** The nav hides what a role cannot use and `/bekrafta` turns an arbetare away, yet the browser holds its own JWT and can call PostgREST directly. Every guarantee above lives in the database; the interface is courtesy.

### 8.5 🚨 HISTORICAL — the app has no roles, and every login is an administrator

**Resolved 2026-08-26 — see 8.5b.** Kept because the mechanism finding below is still true and still easy to get wrong.

Section 1 describes three roles. **The system implements none of them.** There is no `role` column anywhere; `accounts` carries only `worker_id`, `status`, and `email`. The live RLS policies on `shifts`, `workers` and `accounts` are each a single `for all ... using (true) with check (true)` grant to `authenticated`.

The consequence: **any account that can sign in has unrestricted read and write access to every table.** For the roles in Section 1 this means an arbetare could, the moment they are given a login —

- set their own `hours` and flip their own shift to `confirmed`, which is the confirmation mechanism of Sections 3 and 6 defeated at its root, and payroll fraud by design;
- read every colleague's `personal_number` and `account_number`, along with addresses and emergency contacts;
- delete projects, empty the Papperskorg, and alter other workers' shifts.

**This blocks the worker-facing clocking UI outright.** The clocking UI's whole premise is giving arbetare logins, and under the current posture a login is an administrator. It is not a matter of hiding controls in the interface: the browser holds the JWT and can call PostgREST directly, so any restriction that exists only in React is decorative.

It does *not* block the arbetsledare confirmation screen, because everyone who holds an account today is office staff already entitled to that access.

Required before any arbetare receives a login:
1. A role concept — most naturally a `role` column on `accounts` plus a `SECURITY DEFINER` helper in `kit` that reads it, following the pattern `kit.arende_synligt()` already establishes for `arenden`.
2. Per-table policies replacing the four `using (true)` grants, split by command, so that an arbetare may `update` only the clock columns of their own shift and may never write `hours` or `status`.
3. Column-level protection for `hours` and `status`, since PostgREST honours column grants — an RLS predicate alone cannot stop a permitted row-update from touching a forbidden column.

Note that `clock_edited_by` records identity but does not confer authority: it documents who changed a clocked time, and would faithfully document a fraudulent change too.

### 8.5 Standing instruction
If, during implementation, any new edge case is discovered that isn't covered by Sections 1–7, or if two rules in this document appear to contradict each other in a real scenario, stop and ask before implementing a resolution.
