# 🪐 Smriti: ElderCare AI Project Overview

This document provides a detailed explanation of the current state of the **Smriti (ElderCare AI)** project, covering architecture, database models, and file-by-file descriptions.

---

## 🏗️ System Architecture

Smriti is an **event-driven eldercare platform** designed to provide a safe, AI-assisted environment for elders while giving caregivers real-time monitoring and control capabilities.

- **Backend**: Built with **Flask (Python)** and **SQLite (SQLAlchemy)**. It handles authentication, data management, AI RAG (Retrieval-Augmented Generation) queries, and real-time event logging.
- **Frontend**: Built with **React (Vite/TypeScript)**. It features two distinct dashboards: one for the **Caretaker** to manage the elder's schedule and knowledge base, and one for the **Elder** to interact with an AI assistant and view their daily feed.
- **Core AI**: Uses **Gemini** (or local LLMs) for RAG-based question answering, ensuring answers are grounded only in the knowledge provided by the caregiver.
- **Vision**: Includes a **detection system** that uses camera frames to alert caregivers of person presence or unusual activities.

---

## 📂 Project Structure & File Explanations

### 🖥️ Backend (`/backend`)

The backend follows a modular structure using Flask Blueprints.

| Path | Description |
| :--- | :--- |
| `app/__init__.py` | **Application Factory**: Initializes Flask, CORS, SQLAlchemy, JWT, and SocketIO. It also registers all blueprints (routes). |
| `app/models.py` | **Database Schema**: Defines all SQLAlchemy models (User, KnowledgeDoc, Card, Event, etc.). |
| `app/routes/` | **API Routes**: Contains separate files for each feature area. |
| `app/routes/auth.py` | Handles **Authentication**: Login, signup (not used yet), and seeding initial data. |
| `app/routes/caregiver.py` | API for **Caregiver actions**: Managing knowledge documents, cards, and elder profiles. |
| `app/routes/elder.py` | API for the **Elder Smart Display**: Fetching the feed and acknowledging cards. |
| `app/routes/rag.py` | **AI Query Engine**: Proxies requests to Gemini and retrieves context from `KnowledgeDoc`. |
| `app/routes/detect.py` | **Computer Vision**: Receives camera frames and generates presence alerts. |
| `app/routes/health.py` | Simple health check endpoint for the server. |
| `app/extensions.py` | Singleton instances of database and auth extensions to avoid circular imports. |
| `app/services/scheduler.py` | Handles **Background Tasks**: E.g., reminding elders about medications or checking for missed routines. |
| `run.py` | **Entry Point**: The script used to start the backend server. |
| `requirements.txt` | List of all Python dependencies (Flask, SQLAlchemy, OpenCV, etc.). |

### 🌐 Frontend (`/frontend`)

The frontend is a modern React application with a glassmorphism design.

| Path | Description |
| :--- | :--- |
| `src/main.tsx` | Entry point for the React application. |
| `src/App.tsx` | **Main App Component**: Defines routing (Caregiver vs Elder) and layout structures. |
| `src/features/caretaker/` | Contains all UI for the **Caregiver Dashboard**: Alerts feed, medication tracker, knowledge manager. |
| `src/features/elder/` | Contains all UI for the **Elder Smart Display**: The central feed, the "Ask AI" button, and medication reminders. |
| `src/features/auth/` | **Auth Components**: Login page and registration forms. |
| `src/guards/` | **Route Protection**: Ensures only logged-in users or specific roles can enter certain pages. |
| `src/index.css` | **Global Styles**: Defines the design system (dark glassmorphism, HSL colors). |
| `vite.config.ts` | Configuration for the Vite build tool. |

---

## 📊 Core Data Models (`app/models.py`)

- **User**: Authentication details (`email`, `password`, `role`).
- **Elder**: Profile info for the senior (`full_name`, `medical_summary`).
- **KnowledgeDoc**: The "brain" of the AI. Caregivers upload facts here, which RAG uses to answer questions.
- **Card**: UI elements sent to the elder (e.g., "Take your pill").
- **Event**: Immutable logs of everything that happens (e.g., "Medication acknowledged").
- **VitalSign**: Tracks health metrics like Heart Rate and Blood Pressure.
- **Medication**: List of meds and their "taken" status.
- **ScheduleItem**: Daily routine items (e.g., "Lunch with visitor").

---

## 📈 Current Progress Summary

1.  **Backend Foundation**: Fully established with authentication and database migrations.
2.  **API Layer**: Core endpoints for Caregiver, Elder, and RAG are functional.
3.  **Frontend Design**: A high-end dark glassmorphism UI has been implemented for both dashboards.
4.  **Integration**: The Elder dashboard can query the Caregiver's knowledge docs via AI.
5.  **Environment Fix**: Recently resolved Flask import issues to ensure a smooth development experience in VS Code.

---

*This guide serves as a living document to help you understand and navigate the Smriti codebase.*
