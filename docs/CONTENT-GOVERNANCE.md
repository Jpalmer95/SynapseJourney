# Content governance

How a course gets into the public catalogue, and how junk gets out.

## The problem this fixes

The first corpus was generated from a keyword-substitution template. 593 of 725 units contained
template prose ("this is where bugs hide"), one quiz stem appeared 285 times, and 593 units listed
`khanacademy.org/search?page_search_query=…` as a "resource". Every topic was public the moment it
existed. Regenerating it once would not fix it; a gate does.

## Data model (migration 0013)

| column | meaning |
|---|---|
| `published` | in the public commons. `false` = private to `owner_user_id` |
| `reviewed` | a human (or the audit) has looked at it since it last changed |
| `quality_score` | 0–100 from the gate |
| `quality_report` | full issue list, per unit |
| `last_audited_at` | when the score was written |
| `kind` | `core` \| `niche` \| `jit` \| `addon` |
| `normalized_title` | dedupe key |
| `owner_user_id` | author; private courses are visible only to them |

`GET /api/topics` returns `published = true` **or** `owner_user_id = viewer`, so a personal
"just-in-time" course never leaks into the commons.

## The gate

`server/content-quality.ts`, used by three consumers:

1. **Ingest** (`POST /api/learn/ingest`, MCP `synapse.ingest_course`) — error-severity issues return
   `422` with a per-unit report. Admins can override with `force: true`.
2. **Audit** (`npm run audit:content`) — scores every topic, writes `quality_score`, triages.
3. **Admin API** — `GET /api/admin/content/report`, `POST /api/admin/content/audit`,
   `GET /api/admin/content/topic/:id/units` for section-level issues.

### Blocking (error) rules

- template prose markers (see `TEMPLATE_MARKERS`)
- duplicate quiz stems inside a unit; repeated stems across a course
- placeholder resources (`?page_search_query=`, khanacademy search, google search, example.com, bare roots)
- concept prose below ~60% of the archetype budget, or empty
- fewer takeaways / quiz items / resources than the archetype floor

### Warning rules (accepted, recorded)

- unrecognised resource host
- the same URL repeated across a course
- no worked example, no analogy
- prose well above the archetype budget

### Duplicate gate

`findDuplicateTitle()` compares distinctive title tokens (edition/year/`intro`/`essentials` stripped).
A new course that matches a **published** one at ≥0.6 similarity is refused with `409` and the
`existingTopicId`. The intended path for a variant is a modular add-on: resend with `topicId`.

## Audit triage

| grade | action | when |
|---|---|---|
| `ok` | publish / keep | passes the gate |
| `needs_refresh` | quarantine (`published=false`) | fixable, worth keeping |
| `unusable` | delete **only if** no progress, goals or hypotheses; otherwise quarantine | nothing teachable |

Never delete a topic with usage. `npm run audit:content -- --apply --delete-unusable` enforces that.

## Refreshing a course in place

```bash
# 1. author + validate the new units (see the synapse-learn skill for the contract)
# 2. append them to the existing topic so learner progress survives
curl -X POST "$BASE/api/learn/ingest" -H "Authorization: Bearer $SYNAPSE_PAT" \
  -H 'Content-Type: application/json' -d @course.json     # payload carries "topicId": 16
# 3. delete the legacy units next to them
npm run purge:units -- --apply --topic 16
# 4. rescore + publish
npm run audit:content -- --apply
```

## Self-test

```bash
npm run check:quality
```

Asserts that the known-bad legacy unit is rejected (template prose, placeholder resource, thin prose),
a good unit passes with no blocking issues, and repeated quiz stems fail at the course level. If
someone loosens a rule, this fails first.

## Licensing

- Course text: CC BY-SA 4.0 (attribution stays on the course record).
- Platform code: Apache-2.0.
