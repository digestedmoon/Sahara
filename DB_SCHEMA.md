# DB_SCHEMA.md — Smriti SQLite Tables

> This file documents the database schema as implemented in `backend/app/models.py`.

## 1) User

Purpose: authentication + role

**Columns**

* `id` (PK, int)
* `email` (unique, string)
* `password_hash` (string)
* `role` (string: `caregiver` | `elder`)
* `created_at` (datetime)

---

## 2) Elder

Purpose: elder profile data

**Columns**

* `id` (PK)
* `user_id` (FK → User.id)
* `full_name` (string)
* *(recommended additions)* `age`, `room`, `notes`

---

## 3) KnowledgeDoc

Purpose: RAG memory (elder-specific)

**Columns**

* `id` (PK)
* `elder_id` (int) *(should map to elder user id consistently)*
* `doc_type` (string: GENERAL, MED_PURPOSE, ROUTINE, PERSON, etc.)
* `title` (string)
* `content_nepali` (text)
* `embedding_json` (text JSON array)
* `created_at` (datetime)

**Important rules**

* Retrieval MUST filter by `elder_id`
* Embeddings stored as JSON for deterministic retrieval

---

## 4) Card

Purpose: UI instruction objects for elder

**Columns**

* `id` (PK)
* `elder_id` (int)
* `type` (string: MED, ROUTINE, HELP, PRESENCE)
* `title_nepali` (string)
* `body_nepali` (text)
* `media_url` (string, nullable)
* `payload_json` (text JSON, nullable)
* `status` (string: active, acknowledged, expired)
* `created_at` (datetime)

---

## 5) Event

Purpose: immutable event log (system heartbeat)

**Columns**

* `id` (PK)
* `elder_id` (int)
* `event_type` (string: MED_TAKEN, HELP_REQUESTED, CONFUSED, CARD_CREATED, etc.)
* `payload_json` (text JSON, nullable)
* `created_at` (datetime)

**Rule**

* Never delete events in normal operation

---

## 6) Medication (optional / in progress)

Purpose: structured medication tracking

Typical columns:

* `id`
* `elder_id`
* `name`
* `taken` (bool)
* `scheduled_time` (datetime)
* `created_at`

---

## 7) VitalSign (optional / in progress)

Purpose: structured vitals tracking

Typical columns:

* `id`
* `elder_id`
* `type` (BP, HR, TEMP)
* `value`
* `unit`
* `created_at`

---

## 8) CareContact

Purpose: care network / family tree

Typical columns:

* `id`
* `elder_user_id`
* `name`
* `relation`
* `phone`
* `priority`
* `created_at`

---

## 9) Consistency note (important)

Decide one consistent meaning for `elder_id` across the entire backend:

* Option A (recommended): `elder_id = Elder.id` (profile PK)
* Option B: `elder_id = User.id` (elder user PK)

Right now some queries use `elder_id=user.id`. Choose one and standardize to avoid cross-joins and bugs.
