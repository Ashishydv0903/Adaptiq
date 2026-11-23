# AdaptIQ - AI-Powered Adaptive Interview & Skill Assessment Platform

> **Production-Style MERN Platform with Psychometric Item Response Theory, Explainable AI (XAI), Algorithmic Fairness & Trust, Skill Gap Analysis, and Real-Time Proctoring.**

[![Node.js](https://img.shields.io/badge/Node.js-20.x%20LTS-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-18.3-blue.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-4.19-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7.0-brightgreen.svg)](https://www.mongodb.com/)
[![Vite](https://img.shields.io/badge/Vite-5.4-purple.svg)](https://vitejs.dev/)
[![Tests](https://img.shields.io/badge/Tests-124%2F124%20Passing-success.svg)](https://jestjs.io/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

---

## 🌟 Key Architecture & Capabilities

1. **Adaptive Testing Engine (Item Response Theory)**:
   - 2PL and 3PL logistic models: $P(\theta) = c + \frac{1 - c}{1 + e^{-a(\theta - b)}}$.
   - Latent ability ($\theta$) estimation via Bayesian Expected A Posteriori (EAP) over grid $[-4.0, +4.0]$ with standard normal prior $N(0, 1)$.
   - Maximum Fisher Information (MFI) question selection with topic balance and exposure control.
   - Dynamic stopping rule: Standard Error $SE(\theta) < 0.30$ or 20 questions answered.
   - Real-time $\theta$ updates and SE broadcasts over Socket.io.

2. **Explainable AI (XAI) Feedback Engine**:
   - 5-dimension rubric evaluation (Correctness, Depth, Clarity, Completeness, Relevance) executed 3 times at temperature 0 (median score selected, variance recorded).
   - Strict evidence quote verification ensuring claims exist verbatim in candidate answers.
   - Semantic concept coverage detection via Gemini vector embeddings (`text-embedding-004`).
   - Feature extractor feeding a calibrated Ridge Regression scoring model.
   - Exact Linear SHAP attribution ($\sum \phi_i = f(x) - E[f(x)]$) and counterfactual "what-if" guidance.

3. **Multi-Round Assessment Engine**:
   - 6 configurable rounds per role track: Diagnostic MCQ, Technical Architecture, Monaco Code Sandbox (Judge0), System Design, Behavioral STAR (Situation/Task/Action/Result), and Voice Mode.
   - Server-validated per-question timers with pause and resume capabilities.
   - Dynamic LLM follow-up generator with 5 tactical modes (`clarify`, `go_deeper`, `edge_case`, `real_world_example`, `trade_off`).

4. **Skill Gap Analysis & Graphology Intelligence**:
   - Directed taxonomy graph with 80+ skills and prerequisite edges powered by `graphology`.
   - Difficulty- and recency-weighted Bayesian Knowledge Tracing (BKT) mastery scores.
   - Root-cause gap detection by walking prerequisite graphs backward.
   - Resume parsing (PDF/DOCX via `pdf-parse` & `mammoth`) with Claimed-vs-Proven audit matrix.
   - Job Description (JD) matching with role-fit percentage and top-3 gap recommendations.
   - Interactive React Flow skill graph with green/yellow/red/grey state nodes.

5. **Monaco Coding Sandbox & Judge0 Execution**:
   - Multi-language sandbox: JavaScript, Python, Java, and C++.
   - Hidden and visible test case evaluation, execution time, and memory tracking.
   - 3-level costed hint ladder with progressive score penalties.
   - LLM code reviewer analyzing readability, edge cases, and Big-O time/space complexity.

6. **Voice Mode & Speech Telemetry**:
   - Browser `MediaRecorder` audio capture streamed to server.
   - Whisper STT transcription via OpenAI / Groq API.
   - Speech delivery metrics: Words Per Minute (WPM), filler words, and pause ratio.
   - Optional, consent-gated MediaPipe posture/confidence trend (strictly excluded from scoring).

7. **Fairness, Trust & Anti-Cheating Suite**:
   - Confidential demographic telemetry stored in an isolated, encrypted collection.
   - Algorithmic fairness: Group Mean Gap, Cohen's $d$ effect size, and EEOC 80% Four-Fifths Rule.
   - Mantel-Haenszel Differential Item Functioning (DIF) with ETS Category A, B, and C quarantine.
   - LLM scorer sensitivity testing using demographic-paraphrased answers.
   - Socket.io anti-cheating suite: tab switches, fullscreen exit, paste frequency, typing cadence anomalies, and AI-text risk indicators.
   - Recruiter human review queue with manual decision override and immutable audit logs.

8. **Enterprise Dashboards & Gamification**:
   - **Candidate Dashboard**: Competency radar chart (`recharts`), $\theta$ trajectory progress chart, daily streaks, 4 achievement badges, opt-in cohort leaderboard, uncertified practice mode, and executive Puppeteer PDF certification.
   - **Recruiter Dashboard**: Multilateral candidate comparison modal with radar chart and comparison matrix, Nodemailer email invitations, pipeline filters, and certified PDF downloads.
   - **Admin Dashboard**: Question approval queue, AI question generation studio with embedding duplicate detection ($\ge 85\%$), empirical IRT recalibration trigger (MMLE with prior damping), DIF audit, and service health monitors.

---

## 🏗 Monorepo Structure

```
adaptiq/
├── client/                      # React 18 + Vite Frontend
│   ├── src/
│   │   ├── components/          # Navigation, SkillGraph (React Flow), DemographicsModal
│   │   ├── context/             # AuthContext (JWT Access + Refresh tokens)
│   │   ├── pages/               # CandidateDashboard, RecruiterDashboard, AdminDashboard,
│   │   │                        # InterviewSession, ExplainableFeedback, SkillGapAnalysis, Login, Register
│   │   ├── services/            # Axios API client with automatic token refreshing
│   │   └── test/                # Vitest & React Testing Library test suites
│   ├── index.html
│   ├── vite.config.js
│   └── tailwind.config.js
│
├── server/                      # Express + Node.js 20 Backend (ES Modules)
│   ├── src/
│   │   ├── config/              # Environment schema (Zod), MongoDB connector, Logger
│   │   ├── controllers/         # Session, Skill, Fairness, Admin/Recruiter, Auth
│   │   ├── middleware/          # JWT auth, RBAC, Zod validation, error handling, rate limiting
│   │   ├── ml/                  # irt.js, scoringModel.js, shap.js, skillMastery.js, fairness.js, dif.js, antiCheating.js
│   │   ├── models/              # User, Question, AssessmentSession, Demographic, ReviewQueueItem, AuditLog
│   │   ├── routes/              # authRoutes, sessionRoutes, skillRoutes, fairnessRoutes, userRoutes
│   │   ├── seed/                # 150+ seeded questions across 5 tracks, 80+ skills taxonomy
│   │   ├── services/            # llm/ (Gemini adapter), judge0, speech, email, report (Puppeteer)
│   │   └── tests/               # 14 Jest test suites (124 unit tests)
│   ├── package.json
│   └── .env.example
│
├── docker/
│   └── docker-compose.yml       # MongoDB, Express Server, Vite Client, Judge0, PostgreSQL, Redis
├── docs/
│   ├── ARCHITECTURE.md          # Complete system architecture and Mermaid diagrams
│   └── API.md                   # REST and Socket.io protocol specifications
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: v20.x LTS or higher
- **npm**: v10.x or higher
- **MongoDB**: Local MongoDB instance on port 27017 or MongoDB Atlas connection string
- **Docker Compose**: Optional, for containerized MongoDB and Judge0 execution

### 1. Installation

```bash
# Clone the repository
git clone https://github.com/your-org/adaptiq.git
cd adaptiq

# Install backend dependencies
cd server
npm install

# Install frontend dependencies
cd ../client
npm install
```

### 2. Environment Configuration

Copy the example environment file:
```bash
cp server/.env.example server/.env
```

Verify or configure key variables in `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/adaptiq
JWT_SECRET=super_secure_jwt_secret_key_adaptiq_2026_dev_min_32_chars
JWT_REFRESH_SECRET=super_secure_refresh_secret_key_adaptiq_2026_dev_min_32_chars
LLM_PROVIDER=gemini
GEMINI_API_KEY=your_gemini_api_key_here
JUDGE0_API_URL=http://localhost:2358
CLIENT_URL=http://localhost:5173
```

### 3. Database Seeding

Seed 150+ questions across 5 tracks, 80+ skills, and default test accounts:
```bash
cd server
npm run seed
```

#### Demo User Credentials:
| Role | Email | Password |
|---|---|---|
| **Candidate** | `candidate@adaptiq.ai` | `Candidate@123456` |
| **Recruiter** | `recruiter@adaptiq.ai` | `Recruiter@123456` |
| **Admin** | `admin@adaptiq.ai` | `Admin@123456` |

---

## 🧪 Testing Guide

### Backend Jest Test Suite (14 Suites, 124 Tests):
```bash
cd server
npm test -- src/tests/ml/ src/tests/services/
```
All 124 tests validate mathematical IRT properties, SHAP efficiency axioms, Ridge regression, Judge0 test runner, Whisper transcription, BKT skill updates, and EEOC fairness compliance.

### Frontend Vitest Suite:
```bash
cd client
npm test
```

### Production Build Verification:
```bash
cd client
npm run build
```

---

## 💻 Running the Platform in Development

### Start Express Backend Server:
```bash
cd server
npm run dev
# API running on http://localhost:5000
# Health check: http://localhost:5000/api/health
```

### Start Vite Frontend Application:
```bash
cd client
npm run dev
# Client running on http://localhost:5173
```

### Run with Docker Compose:
```bash
cd docker
docker-compose up -d
```

---

## 📚 Documentation
- [System Architecture & Mermaid Specifications](file:///docs/ARCHITECTURE.md)
- [REST & Real-Time API Reference](file:///docs/API.md)
- [Client Frontend Guide](file:///client/README.md)
- [Server Backend Guide](file:///server/README.md)

---

## 📄 License
This project is licensed under the MIT License.
