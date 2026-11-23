# AdaptIQ Frontend Client

Production React 18 application built with Vite, Tailwind CSS, shadcn/ui patterns, React Flow, Recharts, Monaco Editor, and Socket.io.

---

## 🛠️ Tech Stack & Key Libraries

- **Framework**: React 18 with Vite fast refresh
- **Styling**: Tailwind CSS, Lucide React icons, dark-mode glassmorphic theme
- **Visualization**:
  - `recharts`: Competency radar charts, $\theta$ ability trajectory area charts, SHAP attribution waterfall charts
  - `reactflow`: Interactive directed acyclic skill graph with custom green/yellow/red/grey status nodes
- **Code Execution**: `@monaco-editor/react` with syntax highlighting, multi-language support (JS, Python, Java, C++), and costed hint ladder
- **Real-Time Gateway**: `socket.io-client` for live ability updates, question timers, and integrity telemetry
- **Audio Capture**: Browser `MediaRecorder` API for voice responses
- **State & Networking**: React Context (`AuthContext`), Axios with automatic JWT access/refresh token interceptors

---

## 📂 Directory Structure

```
client/src/
├── components/
│   ├── Navbar.jsx                      # Navigation header with role badge & session indicator
│   ├── ProtectedRoute.jsx              # RBAC route guard (candidate, recruiter, admin)
│   ├── fairness/
│   │   └── CandidateDemographicsModal.jsx # Consent-gated demographic collection modal
│   └── skills/
│       └── SkillGraph.jsx              # React Flow interactive skill taxonomy graph
│
├── context/
│   └── AuthContext.jsx                 # JWT token management, user state, auto-refresh
│
├── pages/
│   ├── CandidateDashboard.jsx          # Competency radar, progress trend, streaks, badges, leaderboard
│   ├── RecruiterDashboard.jsx          # Candidate comparison modal, Nodemailer invitations, PDF reports
│   ├── AdminDashboard.jsx              # Question approval queue, AI question studio, IRT recalibration
│   ├── InterviewSession.jsx            # Adaptive IRT test interface, timers, follow-up generator, code/voice modes
│   ├── ExplainableFeedback.jsx         # 5-dimension rubric breakdown, SHAP waterfall, counterfactuals
│   ├── SkillGapAnalysis.jsx            # Resume upload, JD matching, topological learning roadmap
│   ├── Login.jsx                       # Quick demo credential selectors, JWT sign-in
│   └── Register.jsx                    # Account registration with role selection
│
├── services/
│   └── api.js                          # Axios instance with Bearer token & refresh interceptors
│
├── test/
│   └── Auth.test.jsx                   # Vitest & React Testing Library tests
│
├── App.jsx                             # Route definitions & React Router configuration
├── index.css                           # Tailwind directives & custom scrollbar styles
└── main.jsx                            # React root mount point
```

---

## 🛡️ Route Hierarchy & Role-Based Access Control

| Route | Allowed Roles | Description |
|---|---|---|
| `/login` | Public | Sign in with demo selector |
| `/register` | Public | Account creation |
| `/dashboard` | Candidate | Candidate hub: competency radar, streaks, practice mode, PDF export |
| `/interview` | Candidate | Active adaptive interview session |
| `/feedback` | Candidate, Recruiter, Admin | Explainable AI rubric breakdown & SHAP chart |
| `/skills` | Candidate, Recruiter, Admin | Skill gap analysis, resume parser, learning roadmap |
| `/recruiter` | Recruiter, Admin | Pipeline management, side-by-side comparison, invitations |
| `/admin` | Admin | Question approval queue, AI question studio, IRT recalibration, DIF audit |

---

## 🚀 Running and Building

```bash
# Install dependencies
npm install

# Start Vite development server (http://localhost:5173)
npm run dev

# Run Vitest test suite
npm test

# Build optimized production bundle
npm run build

# Preview production build locally
npm run preview
```
