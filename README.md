# AnalyticOS — Enterprise Analytics & ERP Dashboard

![Version](https://img.shields.io/badge/version-1.0.0-blue)
![Agile](https://img.shields.io/badge/Process-Scrum-green)
![License](https://img.shields.io/badge/License-MIT-yellow)

**AnalyticOS** is a full-stack enterprise analytics platform developed as a Software Engineering graduation project. [cite_start]It simulates a real-world environment by applying core concepts including Agile methodology, SOLID principles, and the Software Development Life Cycle (SDLC)[cite: 1, 4].

## 📖 Table of Contents
* [Project Overview](#1-project-overview)
* [Team Structure](#2-team-structure)
* [Agile Process](#3-agile-process)
* [Architecture & Design Patterns](#4-architecture--design-patterns)
* [Clean Code & SOLID](#5-clean-code--solid-principles)
* [UML Diagrams](#6-uml-diagrams)
* [Testing Strategy](#7-testing-strategy)
* [Setup & Installation](#8-setup--installation)

---

## 1. Project Overview
[cite_start]AnalyticOS is a role-aware ERP dashboard serving six departments (Sales, Finance, HR, PR, Inventory, and IT)[cite: 7]. [cite_start]It centralizes cross-departmental operations and provides Python-powered data analytics tailored to specific user roles[cite: 10, 31].

### Key Features
* **Role-Based Access Control (RBAC):** Tailored UI components for managers vs. employees.
* **Analytics Engine:** Dynamic JSON data generation via Python scripts.
* **AI Advisory Layer:** Integrated LLM for insights and support chat.
* **Bilingual UI:** Full support for Arabic (RTL) and English (LTR).

---

## 2. Team Structure
[cite_start]Following the project guidelines for team organization[cite: 6, 8]:

| Role | Name | Responsibilities |
| :--- | :--- | :--- |
| **Product Owner (PO)** | [Name] | [cite_start]Requirements and prioritization [cite: 7] |
| **Software Engineer** | [Name] | [cite_start]Architecture and design decisions [cite: 8] |
| **Developer** | [Name] | [cite_start]Implementation and Clean Code [cite: 10] |
| **QA/Test Engineer** | [Name] | [cite_start]Testing and quality assurance [cite: 11] |

---

## 3. Agile Process
[cite_start]The project was executed in **4 Sprints** (1 week each)[cite: 13]:
1. **Sprint 1 (Planning):** Scope definition, DB schema, and project scaffolding.
2. **Sprint 2 (Core):** Authentication and MVC architecture implementation.
3. **Sprint 3 (Features):** Approval workflows and AI integration.
4. [cite_start]**Sprint 4 (QA):** Bug fixing, testing, and final documentation[cite: 18].

---

## 4. Architecture & Design Patterns
[cite_start]The system follows a **Three-Tier Architecture** (React Frontend, Express Backend, MySQL Database)[cite: 27].

### [cite_start]Implemented Design Patterns [cite: 36]
1. **Repository Pattern:** Decouples logic from data access. Found in `backend/src/repositories/`.
2. [cite_start]**Factory Pattern:** Centralizes object creation (e.g., `EmailBodyFactory.js` and `DashboardFactory.jsx`)[cite: 38].
3. [cite_start]**Strategy Pattern:** Maps roles to specific analytics algorithms in `ScriptResolutionStrategy.js`[cite: 39].
4. **Observer Pattern:** Implemented via React Context API to handle global state changes.

---

## 5. Clean Code & SOLID Principles
[cite_start]We strictly followed Clean Code best practices[cite: 28, 29, 32]:
* **SRP (Single Responsibility):** Controllers handle HTTP only; Services handle logic.
* **OCP (Open/Closed):** New departments can be added without modifying existing strategies.
* **Meaningful Naming:** Functions like `resetPasswordAndLogTicket()` describe intent clearly.
* **DRY (Don't Repeat Yourself):** Centralized API constants and shared middleware.

---

## 6. UML Diagrams
[cite_start]** > **Note:** Replace these with your actual diagram files in `/docs/diagrams/`[cite: 21].
* **Use Case Diagram:** Actor-system interactions[cite: 22].
* [cite_start]**Class Diagram:** System structure and relationships[cite: 23].
* [cite_start]**Sequence Diagram:** Logic flow for the Login process[cite: 24].

---

## 7. Testing Strategy
[cite_start]We maintained a 10% weight on rigorous testing[cite: 52]:
* **Unit Tests:** Testing isolated logic in `AuthService` and `EmailBodyFactory`.
* **Integration Tests:** Verifying API route responses (200 OK vs 401 Unauthorized).
* [cite_start]**Tools:** Jest / Vitest for automated test suites[cite: 31].

---

## 8. Setup & Installation
1. **Clone:** `git clone <repo-url>`
2. **Backend:** `cd backend && npm install && npm start`
3. **Frontend:** `cd frontend && npm install && npm run dev`
4. **Database:** Import `schema.sql` into MySQL 8.