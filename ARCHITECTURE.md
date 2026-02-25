# ARCHITECTURE.md — Smriti Data Flow & System Design

## 0) System overview

Smriti is an event-driven eldercare loop:

1. Caregiver stores trusted knowledge and sends cards
2. Elder interacts with cards & asks AI questions
3. System logs events and updates caregiver dashboard
4. RAG answers only from caregiver knowledge (elder-scoped)

---

## 1) Modules

### Backend (Flask)

* Auth (JWT)
* Caregiver APIs
* Elder APIs
* RAG APIs
* Detect (vision)
* DB via SQLAlchemy (SQLite)

### Frontend (React)

* Caregiver Dashboard
* Elder Smart Display

---

## 2) Core data objects

* **KnowledgeDoc**: truth memory (RAG source)
* **Card**: elder action prompt (primary UI)
* **Event**: immutable log (monitoring + analytics)

---

## 3) Data flow diagrams (text)

### 3.1 Caregiver trains AI

Caregiver UI
→ `POST /api/caregiver/knowledge_docs`
→ `KnowledgeDoc` stored + embedded
→ RAG can answer immediately

---

### 3.2 Caregiver sends card to elder

Caregiver UI
→ `POST /api/caregiver/cards`
→ `Card` created
→ `Event: CARD_CREATED` logged
→ Elder UI sees it in `/api/elder/feed`

---

### 3.3 Elder acts on a card (taken/help/confused)

Elder UI
→ `POST /api/elder/cards/<id>/<action>`
→ card status updated (ack/active/etc)
→ `Event` logged (MED_TAKEN / HELP_REQUESTED / CONFUSED)
→ Caregiver dashboard updates

---

### 3.4 Elder asks AI question (RAG)

Elder UI
→ `POST /api/rag/query` with `{ text, elder_id }`
→ embed query
→ retrieve top docs scoped to elder
→ if low confidence: safe fallback + log `RAG_UNCERTAIN`
→ if confident: answer in Nepali (Gemini optional)
→ optional auto-card routing + log `AUTO_CARD_CREATED`

---

### 3.5 Vision detection alerts caregiver

Detect system
→ `POST /api/detect/frame` (or similar)
→ if trigger condition
→ `Event: PRESENCE_DETECTED / INTRUDER`
→ caregiver UI shows alert timeline

---

## 4) Security boundaries

* JWT required for all elder/caregiver endpoints
* Role-based access:

  * caregiver only can manage multiple elders
  * elder only sees their own feed
* RAG retrieval MUST be elder-scoped (no cross-elder leakage)

---

## 5) Safety policy

* AI answers only from retrieved context
* If confidence low: “call family/caregiver” response
* No medical advice beyond stored caregiver text
* Auto-card creation only when grounded and confident

---

## 6) Phase 3 architecture upgrades

* WebSocket realtime events (Socket.IO)
* Scheduler service for med/routine due cards
* Device pairing for elder displays
* Risk scoring from event logs
* Media upload service for pill photos + voice notes
