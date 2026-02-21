# FRONTEND_HANDOFF.md — Smriti UI Integration Guide

## 0) Goal

This doc maps **every screen** in the frontend to the **exact backend endpoints**, expected request/response shapes, and recommended UI behavior for Elder + Caregiver.

---

## 1) Global frontend rules

### 1.1 Auth & JWT

* After login, store:

  * `access_token`
  * `role`
  * `user_id`
* Attach token on every request:

  * `Authorization: Bearer <token>`
* Role-based routing:

  * `role === "caregiver"` → `/caretaker`
  * `role === "elder"` → `/elder`

### 1.2 Base API

* Backend default: `http://localhost:5000`
* Prefer Axios instance in `api/axios.ts`

### 1.3 Elder UI constraints

* Big typography, high contrast, full-screen layout
* One action at a time (cards)
* Avoid dense lists and tables
* Always show “Help” button accessible

### 1.4 Event rendering rule

* **Do not show raw JSON** (`payload_json`) in UI.
* Always render a human string:

  * backend should provide `alert` (recommended)
  * or frontend should parse `payload` and show `payload.text/message`

---

## 2) Screens — Caregiver UI

### 2.1 Caregiver Login

**Endpoint**

* `POST /api/auth/login`

**Request**

```json
{ "email": "caregiver@test.com", "password": "pass" }
```

**Response**

```json
{ "access_token": "...", "role": "caregiver", "user_id": 1 }
```

**UI behavior**

* Store token in localStorage
* Route to `/caretaker/dashboard`

---

### 2.2 Caregiver Dashboard (Command Center)

**Endpoint**

* `GET /api/caregiver/dashboard`

**Response (example)**

```json
{
  "stats": [ { "label": "Active Alerts", "value": "3" } ],
  "elders": [ { "id": 2, "name": "..." } ],
  "activity": [ { "text": "...", "time": "Recent" } ]
}
```

**UI components**

* Stats cards row
* Elders list/table
* Activity timeline list

**Notes**

* “Active Alerts” should reflect `HELP_REQUESTED` count.
* Activity timeline should show readable `text` (not event payload).

---

### 2.3 Elder Detail View (per elder)

**Goal**
A caregiver clicks an elder from the dashboard and sees:

* Recent events timeline
* Active cards
* Quick actions: create card, add knowledge, add contact

**Endpoints**

* `GET /api/caregiver/events/<elder_id>?limit=50`

  * Should return `alert` string per event.
* `GET /api/elder/feed` *(optional if you support caregiver reading elder feed; otherwise create caregiver feed endpoint)*

**UI rules**

* Timeline shows:

  * icon by type (MED_TAKEN, HELP_REQUESTED, CONFUSED)
  * `alert` message
  * timestamp

---

### 2.4 Add Knowledge Doc (AI training)

**Endpoint**

* `POST /api/caregiver/knowledge_docs` (or `/knowledge` based on current backend naming)

**Request**

```json
{
  "elder_id": 2,
  "doc_type": "GENERAL",
  "title": "चिया",
  "content_nepali": "आमा हरियो चिया मन पराउनु हुन्छ।"
}
```

**Response**

```json
{ "ok": true, "doc_id": 12 }
```

**UI behavior**

* Show “Saved” toast
* Optionally show “This will affect AI answers immediately”

---

### 2.5 Create Card (manual caregiver card)

**Endpoint**

* `POST /api/caregiver/cards`

**Request**

```json
{
  "elder_id": 2,
  "type": "MED",
  "title_nepali": "औषधि समय भयो",
  "body_nepali": "अब निलो औषधि लिनुहोस्।",
  "media_url": "/uploads/pills/blue.png",
  "payload": { "med_name": "निलो औषधि", "time_hint": "बिहान खाना पछि" }
}
```

**Response**

```json
{ "ok": true, "card_id": 55 }
```

**UI behavior**

* Show created card preview
* Optionally show “This will appear on elder screen instantly”

---

### 2.6 Elder Profile Form

**Endpoints**

* `POST /api/caregiver/elder_profile`
* `GET /api/caregiver/elder_profile/<user_id>`

**UI**

* Upsert profile
* Save button
* Render fields in large readable form

---

### 2.7 Care Contacts (family network)

**Endpoints**

* `POST /api/caregiver/care_contacts`
* `GET /api/caregiver/care_contacts/<elder_user_id>`

**UI**

* Contact list
* Add contact modal
* “Call this person” quick action (later integration)

---

## 3) Screens — Elder UI

### 3.1 Elder Smart Display (Main)

**Endpoint**

* `GET /api/elder/feed`

**Response**

```json
{
  "active_cards": [ ... ],
  "latest_events": [ ... ]
}
```

**UI behavior**

* Fullscreen cards
* One card at a time with simple action buttons:

  * ✅ Taken
  * 🆘 Help
  * 🤔 Confused

---

### 3.2 Card Actions

**Endpoints**

* `POST /api/elder/cards/<id>/taken`
* `POST /api/elder/cards/<id>/help`
* `POST /api/elder/cards/<id>/confused`

**UI behavior**

* Show immediate feedback:

  * “ठिक छ 😊”
  * “सहयोग मागियो 🆘”
* Move to next card
* No complex forms

---

### 3.3 Ask AI (RAG)

**Endpoint**

* `POST /api/rag/query`

**Request**

```json
{ "text": "मेरो औषधि कहिले खाने?", "elder_id": 2 }
```

**Response**

```json
{
  "answer_nepali": "...",
  "retrieved": [ ... ],
  "confidence": { "status": "confident" },
  "auto_card": { "created": true, "card_id": 90 }
}
```

**UI behavior**

* Show big Nepali answer text
* If `confidence.status !== "confident"` show:

  * “परिवारलाई फोन गर्नुहोस्” prompt
* If `auto_card.created === true`, show:

  * “मैले कार्ड बनाइदिएँ ✅” toast

---

### 3.4 Voice (MVP)

**Implementation**

* Web Speech API:

  * speech-to-text in browser
* Send transcript to `/api/rag/query`
* Optional TTS:

  * browser speech synthesis for Nepali voice

---

## 4) Error handling

* 401 → clear token, redirect to login
* 403 → show “Access denied”
* 500 → show generic “Something went wrong” + retry

---

## 5) Recommended frontend folder structure

* `features/auth/`
* `features/caretaker/`
* `features/elder/`
* `api/axios.ts`
* `api/endpoints.ts` (recommended)
* `components/ui/` (cards, modals, toasts)
