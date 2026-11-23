# AdaptIQ Backend Server & Machine Learning Engine

Express.js backend with statistical machine learning, psychometrics, explainable AI, Judge0 execution, Whisper speech-to-text, and Puppeteer PDF generation, built with Node.js 20 ES Modules.

---

## 🔬 Pure Node.js Machine Learning Engine (`src/ml/`)

No Python environment is required. All psychometric, explainable, and statistical operations are implemented directly in JavaScript:

1. **`irt.js` (Item Response Theory Engine)**:
   - 2PL and 3PL logistic models: $P(\theta) = c + \frac{1 - c}{1 + e^{-a(\theta - b)}}$.
   - Expected A Posteriori (EAP) ability estimation using numerical integration across grid $[-4.0, +4.0]$ with prior $N(0, 1)$.
   - Fisher Information Function: $I_i(\theta) = a_i^2 \frac{(P_i(\theta) - c_i)^2}{(1 - c_i)^2} \frac{1 - P_i(\theta)}{P_i(\theta)}$.
   - Standard Error calculation: $SE(\theta) = \frac{1}{\sqrt{\sum I_i(\theta) + 1}}$.
   - Stopping rule: $SE(\theta) < 0.30$ or maximum 20 items.
   - Max-information item selection with topic balance and exposure control constraints.

2. **`scoringModel.js` & `shap.js` (Explainable AI & Attribution)**:
   - Feature extractor transforming rubric scores and embedding cosine similarities into calibrated features $[0, 10]$.
   - Calibrated Ridge Regression model predicting score $[0, 100]$ with L2 regularization.
   - Exact Linear SHAP attribution: $\phi_i = w_i (x_i - E[X_i])$, guaranteeing the efficiency axiom $\sum \phi_i = f(x) - E[f(X)]$.
   - Counterfactual simulator computing exact score delta for missing key concepts.

3. **`skillMastery.js` (Bayesian Knowledge Tracing & Graph Traversal)**:
   - Dynamic mastery probability update: $P(L_t) = P(L_{t-1} \mid \text{obs}) + (1 - P(L_{t-1} \mid \text{obs})) P(T)$.
   - Ebbinghaus retention decay based on elapsed days.
   - Graphology directed prerequisite traversal and root-cause bottleneck detection.

4. **`fairness.js` & `dif.js` (Fairness & Bias Auditing)**:
   - Group Mean Gap and Cohen's $d$ standardized effect size.
   - EEOC 80% (Four-Fifths) selection-rate ratio with shortfall calculation.
   - Mantel-Haenszel Differential Item Functioning (DIF) with ETS Category A, B, and C quarantine classification.

5. **`antiCheating.js` (Proctoring & Integrity Suite)**:
   - Keystroke-to-character disparity detection (paste vs automated script injection).
   - Superhuman typing velocity detector ($> 190$ WPM).
   - Statistical LLM transitional marker and cadence detector.
   - Dynamic integrity score $(0 - 100)$ with human review queue auto-escalation.

---

## 📂 Architecture & Directory Structure

```
server/src/
├── config/
│   ├── env.js                          # Zod schema validation for environment variables
│   ├── db.js                           # Mongoose connection with resilient fallback
│   └── logger.js                       # Structured logging utility
│
├── controllers/
│   ├── authController.js               # JWT register, login, refresh, logout
│   ├── sessionController.js            # Start, answer, pause, resume, finish, coding, voice, PDF export
│   ├── skillController.js              # Skill taxonomy, resume parser, JD analyzer, roadmap generator
│   ├── fairnessController.js           # Demographics, bias reports, DIF audits, review queue
│   └── adminRecruiterController.js     # Invitations, comparisons, AI authoring, IRT recalibration
│
├── middleware/
│   ├── auth.js                         # JWT verification and RBAC authorization
│   ├── validate.js                     # Zod request body validation middleware
│   ├── rateLimiter.js                  # Express rate limiting
│   └── errorHandler.js                 # Centralized error handler
│
├── ml/                                 # irt.js, scoringModel.js, shap.js, skillMastery.js,
│                                       # fairness.js, dif.js, antiCheating.js
│
├── models/
│   ├── User.js                         # User account & role credentials
│   ├── Question.js                     # Questions, IRT parameters (a, b, c), test cases, hints
│   ├── AssessmentSession.js            # Live sessions, theta, responses, integrity events
│   ├── Demographic.js                  # Confidential consent-gated demographic telemetry
│   ├── ReviewQueueItem.js              # Proctoring/score anomalies flagged for recruiter review
│   └── AuditLog.js                     # Immutable compliance audit trail
│
├── routes/
│   ├── authRoutes.js                   # /api/auth
│   ├── sessionRoutes.js                # /api/sessions
│   ├── skillRoutes.js                  # /api/skills
│   ├── fairnessRoutes.js               # /api/fairness
│   ├── userRoutes.js                   # /api/users
│   └── healthRoutes.js                 # /api/health
│
├── seed/
│   ├── index.js                        # Seed orchestrator (150+ questions, 80+ skills, test users)
│   ├── questions/                      # Questions across fullstack, frontend, backend, devops, datascience
│   └── skills/                         # Skill graph taxonomy and curated resources
│
├── services/
│   ├── llm/                            # Gemini unified adapter, JSON schema validator, embeddings
│   ├── scoring/                        # Rubric scorer, feature extractor, code reviewer
│   ├── judge0/                         # Judge0 REST container client
│   ├── speech/                         # Whisper STT client and speech metrics
│   ├── email/                          # Nodemailer invitation dispatcher
│   └── report/                         # Puppeteer high-resolution executive PDF compiler
│
└── tests/                              # 14 Jest test suites (124 unit tests)
```

---

## 🧪 Testing

Run all 14 test suites covering ML algorithms, services, and psychometric models:

```bash
# In the /server directory:
npm test -- src/tests/ml/ src/tests/services/
```

Test results validate:
- IRT monotonic theta updates ($\theta$ increases on correct responses, decreases on incorrect ones)
- Fisher Information selection of maximally informative items
- Exact Linear SHAP efficiency axiom $\sum \phi_i = f(x) - E[f(X)]$
- Ridge regression feature prediction and L2 regularization
- Multi-language Judge0 execution and hidden test case verification
- Whisper speech transcription and WPM extraction
- BKT Bayesian knowledge updates and prerequisite graph traversal
- EEOC 80% rule compliance and Mantel-Haenszel DIF classification
- Keystroke anomaly and LLM text risk detection

---

## 🚀 Running the Server

```bash
# Install dependencies
npm install

# Run database seed script
npm run seed

# Start development server with auto-reload (port 5000)
npm run dev

# Start production server
npm start
```
