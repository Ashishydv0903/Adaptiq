# AdaptIQ REST & Real-Time API Documentation

Complete specification of all REST endpoints and Socket.io real-time events for the AdaptIQ platform.

---

## Base URLs
- **REST API Base URL**: `http://localhost:5000/api`
- **Real-Time WebSocket**: `ws://localhost:5000`

---

## Authentication & Headers
All protected routes require a Bearer token in the `Authorization` header:
```http
Authorization: Bearer <access_token>
Content-Type: application/json
```

---

## 1. Authentication Routes (`/api/auth`)

### `POST /api/auth/register`
Registers a new user account.
- **Request Body**:
  ```json
  {
    "name": "Ada Lovelace",
    "email": "ada@adaptiq.ai",
    "password": "Password123!",
    "role": "candidate"
  }
  ```
- **Response `201 Created`**:
  ```json
  {
    "success": true,
    "data": {
      "user": { "id": "u123", "name": "Ada Lovelace", "email": "ada@adaptiq.ai", "role": "candidate" },
      "accessToken": "eyJhbGciOi...",
      "refreshToken": "eyJhbGciOi..."
    }
  }
  ```

### `POST /api/auth/login`
Authenticates an existing user.
- **Request Body**:
  ```json
  {
    "email": "candidate@adaptiq.ai",
    "password": "Password123!"
  }
  ```
- **Response `200 OK`**: Returns user profile and JWT pair.

### `POST /api/auth/refresh`
Exchanges a valid refresh token for a new access token.
- **Request Body**: `{ "refreshToken": "eyJhbGci..." }`

---

## 2. Assessment Sessions & Adaptive Engine (`/api/sessions`)

### `POST /api/sessions/start`
Initializes a new adaptive interview session.
- **Request Body**:
  ```json
  {
    "track": "fullstack"
  }
  ```
- **Tracks Supported**: `fullstack`, `frontend`, `backend`, `devops`, `datascience`.

### `GET /api/sessions/active`
Retrieves the candidate's active or paused session.

### `GET /api/sessions/:id`
Retrieves full session metadata, current round, responses, and current ability trait $\theta$.

### `POST /api/sessions/:id/answer`
Submits an answer to the current question, updates latent ability via IRT EAP, and selects the next optimal question.
- **Request Body**:
  ```json
  {
    "questionId": "q_react_101",
    "answer": "React Fiber uses a linked-list work-in-progress tree with lanes for priority scheduling...",
    "durationSeconds": 45
  }
  ```
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "abilityTheta": 1.15,
      "standardError": 0.28,
      "isComplete": false,
      "nextQuestion": {
        "id": "q_sys_204",
        "title": "Distributed Caching Invalidation",
        "roundType": "technical",
        "irtParams": { "a": 1.4, "b": 1.1, "c": 0.0 }
      }
    }
  }
  ```

### `POST /api/sessions/:id/pause`
Pauses the active assessment session and validates elapsed timer.

### `POST /api/sessions/:id/resume`
Resumes a paused assessment session.

### `POST /api/sessions/practice/start`
Starts an uncertified sandbox assessment that does not affect candidate ratings or persistent records.

---

## 3. Explainable AI & Scoring (`/api/sessions`)

### `POST /api/sessions/:id/evaluate-response`
Runs the 5-dimension rubric evaluation 3 times (median), semantic concept coverage with embeddings, and computes linear SHAP values.
- **Request Body**:
  ```json
  {
    "questionId": "q_react_101",
    "answer": "Full answer text...",
    "telemetry": { "keystrokes": 340, "wpm": 65 }
  }
  ```
- **Response `200 OK`**: Returns rubric scores (Correctness, Depth, Clarity, Completeness, Relevance), evidence quotes, SHAP attributions, and counterfactual suggestions.

### `GET /api/sessions/:id/feedback/:questionId`
Retrieves cached explainable evaluation feedback, SHAP waterfall chart data, and missing concept counterfactuals.

### `POST /api/sessions/:id/export-pdf`
Generates and downloads a branded executive certification PDF compiled via Puppeteer.
- **Response**: `application/pdf` binary stream.

---

## 4. Coding Round & Judge0 Integration (`/api/sessions`)

### `POST /api/sessions/:id/execute-code`
Executes candidate code against test cases in the Judge0 sandbox.
- **Request Body**:
  ```json
  {
    "questionId": "q_code_fib",
    "code": "function fib(n) { ... }",
    "language": "javascript"
  }
  ```
- **Languages**: `javascript`, `python`, `java`, `cpp`.
- **Response `200 OK`**: Test case pass rates, runtime execution time, memory usage, and Judge0 stdout/stderr.

### `POST /api/sessions/:id/review-code`
Triggers Gemini LLM code review assessing readability, edge case resilience, and Big-O time/space complexity.

### `POST /api/sessions/:id/unlock-hint`
Unlocks a costed hint from the 3-level ladder (Level 1: -2pts, Level 2: -5pts, Level 3: -10pts).

---

## 5. Voice Mode & Speech-to-Text (`/api/sessions`)

### `POST /api/sessions/:id/voice-answer`
Uploads candidate audio recording (`multipart/form-data`) and transcribes via Whisper API.
- **Form Data**: `audio: <binary_audio_file>`, `questionId: "q_star_01"`
- **Response `200 OK`**:
  ```json
  {
    "success": true,
    "data": {
      "transcript": "In my previous role as tech lead...",
      "speechMetrics": {
        "wpm": 142,
        "fillerWordCount": 3,
        "fillerWords": ["um", "like"],
        "pauseRatio": 0.08
      }
    }
  }
  ```

---

## 6. Skill Gap & Learning Roadmap (`/api/skills`)

### `GET /api/skills/taxonomy`
Retrieves the 80+ skill node taxonomy and prerequisite graph.

### `POST /api/skills/resume/upload`
Uploads candidate resume (PDF or DOCX), extracts structured skills via LLM, and builds Claimed-vs-Proven matrix.

### `POST /api/skills/jd/analyze`
Analyzes Job Description text, computes role-fit match percentage, and recommends top-3 skill gap closures.

### `POST /api/skills/roadmap/generate`
Generates topologically sorted learning milestones using graphology dependencies and curated learning resources.

---

## 7. Algorithmic Fairness & Trust (`/api/fairness`)

### `POST /api/fairness/demographics`
Records confidential demographic attributes (gender, ethnicity, age range) in an isolated collection.

### `GET /api/fairness/bias-report`
Calculates group mean scores, standardized effect size (Cohen's d), and the EEOC 80% Four-Fifths selection rate ratio.

### `GET /api/fairness/dif-audit`
Executes Mantel-Haenszel Differential Item Functioning across all active questions, classifying items into ETS Category A, B, or C (quarantine).

### `POST /api/fairness/llm-bias-test`
Performs sensitivity testing by evaluating semantic paraphrases across diverse demographic voices.

### `GET /api/fairness/review-queue`
Lists assessment sessions flagged for proctoring anomalies or borderline scores.

### `POST /api/fairness/review-queue/:id/override`
Records recruiter/admin manual qualification decision with audit log trail.

---

## 8. Recruiter & Admin Management (`/api/users`)

### `GET /api/users/recruiter/candidates`
Returns evaluated candidate cohort with multilateral metrics ($\theta$, coding pass rate, STAR score, delivery WPM, integrity) for side-by-side comparison.

### `POST /api/users/recruiter/invite`
Dispatches a branded invitation email via Nodemailer with custom note and assessment link.

### `GET /api/users/admin/approval-queue`
Lists questions in status `review` or `quarantined`.

### `POST /api/users/admin/generate-question`
Generates a new assessment question via Gemini LLM and performs embedding-based cosine similarity duplicate detection ($\ge 85\%$).

### `POST /api/users/admin/questions/:id/approve`
Approves a pending question into the active IRT item bank.

### `POST /api/users/admin/recalibrate-irt`
Executes empirical IRT item recalibration via Marginal Maximum Likelihood Estimation (MMLE) with prior damping.

### `GET /api/users/leaderboard`
Returns opt-in candidate leaderboard rankings.

### `POST /api/users/leaderboard/toggle`
Toggles candidate participation in the public cohort leaderboard.

---

## 9. Socket.io Real-Time Protocol

### Client to Server:
- `join_session`: `{ "sessionId": "sess_123", "token": "..." }`
- `proctor_event`: `{ "sessionId": "sess_123", "eventType": "tab_switch" | "fullscreen_exit" | "paste" | "typing_anomaly" }`

### Server to Client:
- `theta_update`: `{ "abilityTheta": 1.25, "standardError": 0.26 }`
- `timer_tick`: `{ "remainingSeconds": 85 }`
- `integrity_alert`: `{ "status": "flagged", "integrityScore": 72 }`
