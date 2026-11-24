# AdaptIQ Enterprise System Architecture & Engine Specifications

AdaptIQ is an enterprise-grade AI-powered adaptive interview and psychometric skill intelligence platform built entirely on the MERN stack with modern ES modules (Node.js 20). It delivers mathematical rigor, explainable scoring, real computer vision proctoring, and algorithmic fairness without requiring external Python environments.

---

## 1. High-Level System Architecture

```mermaid
flowchart TB
    subgraph Client ["Client Layer (React 18 + Vite)"]
        UI["Tailwind CSS Design System + Primitives"]
        Dashboards["Role Dashboards (Candidate / Recruiter / Admin)"]
        VisionModels["Client-Side Vision Engine (@mediapipe/tasks-vision + @tensorflow/tfjs + COCO-SSD + face-api)"]
        Interactive["Monaco Editor + React Flow + Recharts"]
        ClientMedia["MediaRecorder (Voice) + Socket.io Client"]
    end

    subgraph Gateway ["API Gateway & Core Server (Express + Node.js 20)"]
        AuthMiddleware["JWT Auth + RBAC + Socket.io Auth Middleware"]
        OwnershipMiddleware["Granular Session Ownership Verification"]
        ZodValidator["Zod Schema Route Validation"]
        RateLimiter["Rate Limiter + Helmet + CORS"]
        RealtimeGW["Socket.io Real-time Gateway (Role-Gated Rooms)"]
    end

    subgraph MLEngine ["ML & Psychometrics Engine (Node.js ES Modules)"]
        IRT["3PL / 2PL IRT Engine (EAP Theta & Fisher Information)"]
        ScoringModel["Ridge Regression & Feature Extractor"]
        SHAP["Exact Linear SHAP Attribution & Counterfactuals"]
        Fairness["Fairness Suite (DIF, EEOC 80% Rule, Cohen's d)"]
        SkillGraphEngine["Graphology Prerequisite & BKT Mastery Engine (84 Skills, 112 Edges)"]
    end

    subgraph Services ["Application Services"]
        LLMAdapter["Honest AI Layer (Gemini 1.5 Flash / Pro + Typed LLMUnavailableError Fallback)"]
        Judge0Client["Judge0 Client + Process-Isolated Child Runner Sandbox"]
        WhisperClient["Whisper STT Service (OpenAI / Groq)"]
        PDFService["Puppeteer PDF Generation Engine"]
    end

    subgraph DataLayer ["Persistence & External Services"]
        MongoDB[("MongoDB 7.0 + Mongoose (or in-memory mongodb-memory-server)")]
        GeminiAPI["Google Gemini API (Text & Embeddings)"]
        Judge0Docker["Judge0 API / CE Containers"]
    end

    UI --> AuthMiddleware
    Dashboards --> AuthMiddleware
    Interactive --> AuthMiddleware
    VisionModels -->|Proctoring Telemetry Events| ClientMedia
    ClientMedia <--> RealtimeGW

    AuthMiddleware --> OwnershipMiddleware --> ZodValidator --> RateLimiter
    RateLimiter --> RealtimeGW
    RateLimiter --> MLEngine
    RateLimiter --> Services

    MLEngine <--> MongoDB
    Services <--> MongoDB
    LLMAdapter <--> GeminiAPI
    Judge0Client <--> Judge0Docker
```

---

## 2. Psychometric 2PL/3PL IRT Adaptive Engine

The adaptive interview engine implements Item Response Theory (IRT) with a two- and three-parameter logistic model:

$$P(\theta) = c + \frac{1 - c}{1 + e^{-a(\theta - b)}}$$

Where:
- $\theta$: Candidate latent ability parameter ($\theta \in [-4.0, +4.0]$).
- $a$: Item discrimination parameter ($a > 0$).
- $b$: Item difficulty parameter ($b \in [-3.0, +3.0]$).
- $c$: Pseudo-guessing parameter ($0 \le c < 1$, defaults to $0$ in 2PL mode).

```mermaid
flowchart TD
    Start([Candidate Starts Assessment]) --> InitTheta["Initialize Prior Ability &theta; = 0.0, SE = 1.0"]
    InitTheta --> CheckStop{"Termination Rule Met?<br/>SE &lt; 0.30 OR N &ge; 20"}
    
    CheckStop -- No --> CalcInfo["Compute Fisher Information I(&theta;) for all active items"]
    CalcInfo --> SelectItem["Select Max-Information Item<br/>Subject to Topic Balance &amp; Exposure Limits"]
    SelectItem --> PresentItem["Present Question to Candidate with Server Timer"]
    PresentItem --> ReceiveResp["Candidate Submits Response (Type / Voice / Code)"]
    ReceiveResp --> ScoreResp["Rubric Scoring &amp; Feature Extraction"]
    ScoreResp --> EAPUpdate["Update &theta; using Expected A Posteriori (EAP)<br/>Prior: N(0, 1) over Grid [-4, +4]"]
    EAPUpdate --> CalcSE["Compute Standard Error of Estimation SE(&theta;)"]
    CalcSE --> PushWS["Push Live &theta; and SE to Client via Socket.io"]
    PushWS --> CheckStop

    CheckStop -- Yes --> Finalize["Calculate Final Ability Trait &theta;<br/>Compute Percentile Rank &amp; Grade"]
    Finalize --> End([Session Complete &rarr; Generate Certified Report])
```

---

## 3. Honest AI Scoring & SHAP Feature Attribution

```mermaid
flowchart LR
    CandidateAns["Candidate Answer"] --> LLMCheck{"GEMINI_API_KEY Configured?"}
    
    LLMCheck -- Yes --> RubricLLM["LLM Rubric Scorer<br/>(Correctness, Depth, Clarity, Completeness, Relevance)"]
    LLMCheck -- No --> HeuristicScorer["Calibrated Local Ridge Heuristic<br/>(confidence capped at 0.40,<br/>evaluatedBy: 'heuristic')"]
    
    RubricLLM --> EvidenceQuoteCheck["Strict Evidence Quote Verification<br/>(Discards Fabricated Quotes)"]
    EvidenceQuoteCheck --> FeatureVector["Normalized Feature Vector [0, 10]"]
    HeuristicScorer --> FeatureVector
    
    FeatureVector --> RidgeModel["Calibrated Ridge Regression Scorer"]
    RidgeModel --> FinalScore["Composite Score (0 - 100)"]
    
    RidgeModel --> LinearSHAP["Exact Linear SHAP Engine<br/>ml/shap.js"]
    LinearSHAP --> FeatureAttribution["Feature Attribution Waterfall<br/>Base Value + &Sigma; &phi;_i = Final Score"]
    
    FeatureVector --> Counterfactuals["Counterfactual Simulator<br/>Synthesize Incremental Score If Missing Concepts Were Covered"]
```

---

## 4. Real Computer Vision Proctoring Pipeline

Proctoring executes on-device computer vision inside client Web Workers with no raw video transmission:

```mermaid
flowchart TD
    VideoFeed["Webcam Video Stream"] --> Worker["proctor.worker.js (Dedicated Web Worker)"]
    
    subgraph VisionInference ["Local Model Inference (Zero Cloud Leakage)"]
        Worker --> FaceLandmark["MediaPipe FaceLandmarker<br/>(Head Yaw/Pitch Matrix + Iris Offset)"]
        Worker --> ObjectDetect["COCO-SSD Object Detector<br/>(Cell phone, book, laptop, tv)"]
        Worker --> FaceID["face-api.js 128-d Descriptor<br/>(Cosine Euclidean Similarity to Enrolment)"]
    end
    
    FaceLandmark --> SeverityRules["Severity & Escalation State Machine<br/>(proctorSeverity.js)"]
    ObjectDetect --> SeverityRules
    FaceID --> SeverityRules
    
    SeverityRules --> AlertYellow["YELLOW Alert<br/>(brief looking away, 1 tab switch)"]
    SeverityRules --> AlertOrange["ORANGE Alert<br/>(3 yellow escalations, looking away &gt; 8s)"]
    SeverityRules --> AlertRed["RED ALERT<br/>(Multiple faces, prohibited object, 3 orange escalations)"]
    
    AlertRed --> RecruiterStream["Socket.io &rarr; Recruiter Live Monitor<br/>(Critical Banner + Sound Chime + OnRed Policy)"]
```

---

## 5. Algorithmic Fairness & EEOC Audit Architecture

```mermaid
flowchart TD
    subgraph FairnessSuite ["Algorithmic Fairness & Bias Auditing"]
        Demographics["Confidential Demographics Store<br/>(Separate Collection, Consent Gated)"] --> MetricsCalc["Fairness Metrics Engine (ml/fairness.js)"]
        MetricsCalc --> DisparateImpact["EEOC 80% Rule Selection-Rate Ratio (Adverse Impact)"]
        MetricsCalc --> CohensD["Cohen's d Standardized Effect Size"]
        MetricsCalc --> LordChiSquare["Mantel-Haenszel DIF Bias Detection (Delta MH)"]
        LordChiSquare --> QuarantineAction{"ETS Category C<br/>(|&Delta;| &gt; 1.5)?"}
        QuarantineAction -- Yes --> QuarantinePool["Quarantine Item from IRT Selection"]
        QuarantineAction -- No --> ActivePool["Retain in Active Testing Pool"]
    end

    QuarantinePool --> AuditTrail[("Immutable Audit Log")]
```
