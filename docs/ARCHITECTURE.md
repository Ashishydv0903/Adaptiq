# AdaptIQ Enterprise System Architecture & Engine Specifications

AdaptIQ is an enterprise-grade AI-powered adaptive interview and psychometric skill assessment platform built entirely on the MERN stack with modern ES modules (Node.js 20). It delivers mathematical rigor, explainable scoring, proctored trust, and algorithmic fairness without requiring a Python runtime.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Layer (React 18 + Vite)"]
        UI["Tailwind CSS + shadcn/ui"]
        Dashboards["Role Dashboards (Candidate / Recruiter / Admin)"]
        Interactive["Monaco Editor + React Flow + Recharts"]
        ClientMedia["MediaRecorder (Voice) + Socket.io Client"]
    end

    subgraph Gateway ["API Gateway & Core Server (Express + Node.js 20)"]
        AuthMiddleware["JWT Auth + RBAC (Candidate/Recruiter/Admin)"]
        ZodValidator["Zod Schema Route Validation"]
        RateLimiter["Rate Limiter + Helmet + CORS"]
        RealtimeGW["Socket.io Real-time Gateway"]
    end

    subgraph MLEngine ["ML & Psychometrics Engine (Node.js ES Modules)"]
        IRT["3PL / 2PL IRT Engine (EAP Theta & Fisher Information)"]
        ScoringModel["Ridge Regression & Feature Extractor"]
        SHAP["Exact Linear SHAP Attribution & Counterfactuals"]
        Fairness["Fairness Suite (DIF, EEOC 80% Rule, Cohen's d)"]
        SkillGraphEngine["Graphology Prerequisite & BKT Mastery Engine"]
    end

    subgraph Services ["Application Services"]
        LLMAdapter["Unified LLM Adapter (Gemini 1.5 Flash / Pro)"]
        Judge0Client["Judge0 REST Client (Docker Sandbox)"]
        WhisperClient["Whisper STT Service (OpenAI / Groq)"]
        PDFService["Puppeteer PDF Generation Engine"]
        EmailService["Nodemailer Invitation Service"]
    end

    subgraph DataLayer ["Persistence & External Services"]
        MongoDB[("MongoDB 7.0 + Mongoose")]
        GeminiAPI["Google Gemini API (LLM & Embeddings)"]
        Judge0Docker["Judge0 Docker Containers"]
        SMTPRelay["SMTP / Ethereal Email Relay"]
    end

    UI --> AuthMiddleware
    Dashboards --> AuthMiddleware
    Interactive --> AuthMiddleware
    ClientMedia <--> RealtimeGW

    AuthMiddleware --> ZodValidator --> RateLimiter
    RateLimiter --> RealtimeGW
    RateLimiter --> MLEngine
    RateLimiter --> Services

    MLEngine <--> MongoDB
    Services <--> MongoDB
    LLMAdapter <--> GeminiAPI
    Judge0Client <--> Judge0Docker
    EmailService <--> SMTPRelay
```

---

## 2. Psychometric 2PL/3PL IRT Adaptive Engine

The adaptive interview engine implements Item Response Theory (IRT) with a three-parameter logistic (3PL) model:

$$P(\theta) = c + \frac{1 - c}{1 + e^{-a(\theta - b)}}$$

Where:
- $\theta$: Candidate latent ability parameter ($\theta \in [-4.0, +4.0]$).
- $a$: Item discrimination parameter ($a > 0$).
- $b$: Item difficulty parameter ($b \in [-3.0, +3.0]$).
- $c$: Pseudo-guessing pseudo-chance parameter ($0 \le c < 1$, defaults to $0$ in 2PL mode).

```mermaid
flowchart TD
    Start([Candidate Starts Assessment]) --> InitTheta["Initialize Prior Ability &theta; = 0.0, SE = 1.0"]
    InitTheta --> CheckStop{"Termination Rule Met?<br/>SE &lt; 0.30 OR N &ge; 20"}
    
    CheckStop -- No --> CalcInfo["Compute Fisher Information I(&theta;) for all active items"]
    CalcInfo --> SelectItem["Select Max-Information Item<br/>Subject to Topic Balance &amp; Exposure Limits"]
    SelectItem --> PresentItem["Present Question to Candidate with Server Timer"]
    PresentItem --> ReceiveResp["Candidate Submits Response"]
    ReceiveResp --> ScoreResp["Rubric Scoring &amp; Feature Extraction"]
    ScoreResp --> EAPUpdate["Update &theta; using Expected A Posteriori (EAP)<br/>Prior: N(0, 1) over Grid [-4, +4]"]
    EAPUpdate --> CalcSE["Compute Standard Error of Estimation SE(&theta;)"]
    CalcSE --> PushWS["Push Live &theta; and SE to Client via Socket.io"]
    PushWS --> CheckStop

    CheckStop -- Yes --> Finalize["Calculate Final Ability Trait &theta;<br/>Compute Percentile Rank &amp; Grade"]
    Finalize --> End([Session Complete &rarr; Generate Certified Report])
```

---

## 3. Multi-Round Assessment State Machine

AdaptIQ dynamically tailors assessments across 6 distinct round types per role track:

```mermaid
stateDiagram-v2
    [*] --> InProgress: Start Session
    
    state InProgress {
        [*] --> MCQ: Diagnostic Foundation
        MCQ --> Technical: IRT Calibrated Architecture
        Technical --> Coding: Monaco Editor + Judge0
        Coding --> SystemDesign: Microservices & Distributed Scale
        SystemDesign --> BehavioralSTAR: Situation-Task-Action-Result
        BehavioralSTAR --> VoiceMode: Whisper Speech Transcription
        VoiceMode --> Complete: All Rounds Concluded
    }

    InProgress --> Paused: User Pause / Inactivity
    Paused --> InProgress: Resume Session (Server-Validated Timer)

    Complete --> XAIEvaluation: Execute Feature Extractor & SHAP
    XAIEvaluation --> PDFExport: Compile Branded Puppeteer Report
    PDFExport --> [*]
```

---

## 4. Explainable AI (XAI) Scoring & SHAP Feature Attribution

```mermaid
flowchart LR
    CandidateAns["Candidate Answer"] --> RubricLLM["LLM Rubric Scorer<br/>(Correctness, Depth, Clarity, Completeness, Relevance)"]
    CandidateAns --> EmbeddingEngine["Gemini Embedding Model<br/>(text-embedding-004)"]
    
    RubricLLM --> EvidenceQuoteCheck["Evidence Quote Verification<br/>(Exact Substring Validation)"]
    EmbeddingEngine --> ConceptCoverage["Cosine Similarity Concept Coverage<br/>Against Key Benchmark Concepts"]
    
    EvidenceQuoteCheck --> FeatureVector["Normalized Feature Vector [0, 10]"]
    ConceptCoverage --> FeatureVector
    
    FeatureVector --> RidgeModel["Calibrated Ridge Regression Scorer"]
    RidgeModel --> FinalScore["Composite Score (0 - 100)"]
    
    RidgeModel --> LinearSHAP["Exact Linear SHAP Engine<br/>ml/shap.js"]
    LinearSHAP --> FeatureAttribution["Feature Attribution Waterfall<br/>Base Value + &Sigma; &phi;_i = Final Score"]
    
    FeatureVector --> Counterfactuals["Counterfactual Simulator<br/>Synthesize Incremental Score If Missing Concepts Were Covered"]
```

---

## 5. Fairness, Trust & Anti-Cheating Architecture

```mermaid
flowchart TD
    subgraph AntiCheating ["Anti-Cheating Telemetry & Integrity"]
        ClientProctor["Proctor Telemetry (Fullscreen, Blur, Paste, Typing Velocity)"] --> WSEvents["Socket.io Integrity Events"]
        WSEvents --> TypingDetector["Keystroke Anomaly & Superhuman WPM Detector"]
        WSEvents --> AITextDetector["Statistical LLM Transitional Marker & Cadence Detector"]
        TypingDetector --> IntegrityScore["Dynamic Integrity Score (0 - 100)"]
        AITextDetector --> IntegrityScore
        IntegrityScore --> ReviewFlag{"Integrity &lt; 75% OR<br/>Severe Anomaly?"}
        ReviewFlag -- Yes --> HumanQueue["Recruiter Human Review Queue"]
        ReviewFlag -- No --> CertifiedValid["Integrity Certified"]
    end

    subgraph FairnessSuite ["Algorithmic Fairness & Bias Auditing"]
        Demographics["Confidential Demographics Store<br/>(Separate Collection, Consent Gated)"] --> MetricsCalc["Fairness Metrics Engine (ml/fairness.js)"]
        MetricsCalc --> DisparateImpact["EEOC 80% Rule Selection-Rate Ratio"]
        MetricsCalc --> CohensD["Cohen's d Standardized Effect Size"]
        MetricsCalc --> LordChiSquare["Mantel-Haenszel DIF Bias Detection (Delta MH)"]
        LordChiSquare --> QuarantineAction{"ETS Category C<br/>(|&Delta;| &gt; 1.5)?"}
        QuarantineAction -- Yes --> QuarantinePool["Quarantine Item from IRT Selection"]
        QuarantineAction -- No --> ActivePool["Retain in Active Testing Pool"]
    end

    HumanQueue --> AuditTrail[("Immutable Audit Log")]
    QuarantinePool --> AuditTrail
```
