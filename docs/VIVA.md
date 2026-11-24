# AdaptIQ Viva Technical Defense Guide & Examiner Q&A

This guide prepares the engineering team for project defense, live examiner demonstrations, and rigorous questioning on psychometrics, machine learning, computer vision, and algorithmic governance.

---

## 🎬 1. Live Examiner Demonstration Script (5-Minute Tour)

### Act 1: Candidate Flow & Adaptive IRT Calibration
1. **Login**: Navigate to `/login` and sign in with `candidate@adaptiq.ai` / `Candidate@123456`.
2. **Resume & Target Role**: Show the Candidate Dashboard. Point out the parsed resume ("Alan Turing") and active target JD.
3. **Practice Sandbox**: Click **"Start Practice (No Proctoring)"** on the Fullstack track to show private learning mode. Point out:
   - Server-validated countdown timer.
   - **Practice Hint Ladder**: Click **"Reveal Hint 1"** to demonstrate progressive costed hints without hiring penalties.
   - **Standalone STAR Evaluator**: In behavioral rounds, click **"Check STAR Structure"** to display real-time Situation, Task, Action, Result breakdown before submitting.
4. **Explainable AI Modal**: Submit an answer and open the **Explainable Feedback Modal**:
   - Show the 5-dimension rubric breakdown.
   - Highlight the **SHAP Feature Attribution Waterfall** ($\sum \phi_i = f(x) - E[f(x)]$).
   - Point out **Counterfactual Guidance** ("Covering distributed caching would yield +12 points").
   - Point out the **"Verified Quote"** badge proving evidence was extracted verbatim from candidate input.
5. **Skill Graph Taxonomy**: Navigate to `/skills/graph` to showcase the interactive 84-node DAG taxonomy with prerequisite edges, mastery coloring (Green $\ge 70\%$, Amber 40-69%, Red $< 40\%$), and category filtering.

### Act 2: Recruiter Operations & Live Proctoring
1. **Login**: Sign in with `recruiter@adaptiq.ai` / `Recruiter@123456`.
2. **Candidate Pipeline**: Showcase the multi-candidate comparison table and radar chart comparing latent ability $\theta$, coding pass rate, and acoustic fluency.
3. **Live Monitor**: Open the **Live Proctoring Monitor** tab.
4. **Red Alert Escalation**:
   - In the **Viva Demo Controls** panel at bottom-left, click **"Inject Phone"** or **"Inject 2nd Face"**.
   - Observe the immediate audio chime, the high-priority **"RED ALERT ESCALATION"** banner, and the automatic session freeze under the recruiter's `onRedPolicy: 'pause'` policy.
   - Click **"View Audit Log"** to prove the incident is committed to the immutable audit trail.

### Act 3: Admin Governance, MMLE Recalibration & EEOC Fairness
1. **Login**: Sign in with `admin@adaptiq.ai` / `Admin@123456`.
2. **Question Studio Approval Queue**: Show pending AI-generated questions with embedding duplicate detection. Click **"Approve & Promote"** to promote into the active pool.
3. **IRT Recalibration**: Trigger **"Recalibrate Item Bank"** to execute Marginal Maximum Likelihood Estimation (MMLE) with prior damping over candidate response logs.
4. **Fairness Dashboard**: Open `/admin/fairness` to demonstrate:
   - EEOC Four-Fifths (80%) Rule adverse impact ratios across demographic groups.
   - Cohen's $d$ standardized effect sizes.
   - Mantel-Haenszel Differential Item Functioning (DIF) with ETS Category C quarantine.

---

## 💡 2. 20 Likely Examiner Questions & Authoritative Answers

### 1. What is Item Response Theory (IRT) and why use it over Classical Test Theory (CTT)?
> **Answer**: Classical Test Theory computes a simple percentage score ($X = T + E$) which conflates candidate ability with test difficulty—a candidate who scores 70% on an easy test looks better than one scoring 60% on a brutally hard test. IRT models the probability of a correct answer as a function of the candidate's latent trait ($\theta$) and item parameters (difficulty $b$, discrimination $a$, guessing $c$). It places candidate ability and question difficulty on the same mathematical scale, allowing dynamic adaptive testing where fewer questions yield equal or higher measurement precision ($SE(\theta) < 0.30$).

### 2. How is candidate latent ability ($\theta$) estimated using Expected A Posteriori (EAP)?
> **Answer**: AdaptIQ uses Bayesian Expected A Posteriori (EAP) over a quadrature grid of $Q = 81$ points on $\theta \in [-4.0, +4.0]$. Given prior distribution $N(0, 1)$ and response vector $U$, the posterior expectation is:
> $$\hat{\theta} = \frac{\sum_{k=1}^Q \theta_k L(U | \theta_k) W(\theta_k)}{\sum_{k=1}^Q L(U | \theta_k) W(\theta_k)}$$
> Where $L(U|\theta_k) = \prod P_i(\theta_k)^{u_i} (1 - P_i(\theta_k))^{1 - u_i}$. EAP is non-iterative, guaranteed to converge, produces finite estimates even for all-correct or all-wrong response vectors, and directly computes estimation standard error $SE(\theta) = \sqrt{\text{Var}(\theta|U)}$.

### 3. What is Fisher Information, and how is it used to select the next question?
> **Answer**: Fisher Information $I(\theta)$ quantifies the measurement precision an item provides at ability level $\theta$:
> $$I_i(\theta) = \frac{(P_i'(\theta))^2}{P_i(\theta)(1 - P_i(\theta))} = a_i^2 P_i(\theta)(1 - P_i(\theta))$$
> Under Maximum Fisher Information (MFI), the engine selects the unadministered question that maximizes $I_i(\hat{\theta})$, which occurs when item difficulty $b_i$ matches candidate ability $\hat{\theta}$. AdaptIQ blends MFI with topic balancing and exposure control to prevent item overexposure.

### 4. Why use the 2PL/3PL model instead of a simple 1PL (Rasch) model?
> **Answer**: In technical interviewing, questions differ significantly in their discriminatory power. A 1PL Rasch model assumes all questions have identical discrimination ($a_i = 1$). A 2PL model estimates item discrimination $a_i$, rewarding strong answers more heavily on questions that cleanly differentiate top performers from weak candidates. The 3PL adds pseudo-guessing $c_i$ for multiple-choice diagnostic items.

### 5. How is SHAP calculated for a linear ridge model, and why is it exact?
> **Answer**: For a linear model $f(x) = \beta_0 + \sum_{j=1}^M \beta_j x_j$, Shapley values satisfy efficiency and symmetry with an exact closed-form solution:
> $$\phi_j(x) = \beta_j (x_j - E[X_j])$$
> Where $E[X_j] = 5.0$ represents our standardized baseline benchmark. The sum of all attributions equals the difference from base value: $\sum_{j=1}^M \phi_j = f(x) - E[f(X)]$. This eliminates the need for slow, non-deterministic Monte Carlo approximations.

### 6. What are counterfactual explanations, and how does AdaptIQ generate them?
> **Answer**: Counterfactuals explain what minimal, actionable change in the candidate's response would have altered the outcome. AdaptIQ simulates the scoring function with missing rubric concepts set to covered:
> $$\Delta \text{Score} = f(x_{\text{concept}=\text{true}}) - f(x_{\text{observed}})$$
> Providing candidates with concrete feedback (e.g., "Covering cache stampede mitigation would have added +8 points to your depth score").

### 7. What is Differential Item Functioning (DIF) and how does Mantel-Haenszel detect item bias?
> **Answer**: An item exhibits DIF when candidates from different demographic groups who possess the *same* underlying ability $\theta$ have significantly different probabilities of answering correctly. AdaptIQ stratifies candidates into matching $\theta$ score intervals and computes the Mantel-Haenszel common odds ratio $\alpha_{MH}$:
> $$\Delta MH = -2.35 \ln(\alpha_{MH})$$
> Items with $|\Delta MH| \ge 1.5$ and statistical significance are flagged as ETS Category C (severe DIF) and quarantined from future tests.

### 8. What is the EEOC Four-Fifths (80%) Rule for adverse impact?
> **Answer**: Under the Equal Employment Opportunity Commission (EEOC) Uniform Guidelines, a selection process has adverse impact if the selection rate for a protected demographic group is less than four-fifths ($80\%$) of the selection rate for the group with the highest pass rate:
> $$\text{Impact Ratio} = \frac{\text{Selection Rate}_{\text{adverse}}}{\text{Selection Rate}_{\text{benchmark}}} \ge 0.80$$
> AdaptIQ audits this ratio in real-time in `/admin/fairness`.

### 9. Why does AdaptIQ explicitly refuse to use facial emotion recognition for scoring?
> **Answer**: Multiple scientific reviews (e.g., Barrett et al., 2019) and EEOC regulatory guidance confirm that facial micro-expressions (smile, furrowed brow) do not reliably map to emotional states or job competency across cultural backgrounds and produce severe disparate impact against neurodivergent individuals. AdaptIQ restricts scoring purely to technical correctness, system design reasoning, and acoustic speech clarity.

### 10. What are the limits and failure modes of browser-based computer vision proctoring?
> **Answer**: Single-camera webcams suffer from optical occlusion (e.g., notes positioned just behind the monitor frame), lighting variations, and low frame rates. AdaptIQ treats proctoring not as an automated judge, but as an audit telemetry stream: infractions follow an escalation ladder (Yellow $\to$ Orange $\to$ Red), and candidate disqualification requires human recruiter review with an immutable audit log.

### 11. How does the proctoring escalation state machine work?
> **Answer**: Events carry base severity:
> - **Yellow**: Minor anomalies (looking away $> 4\text{s}$, single tab switch).
> - **Orange**: Medium anomalies (looking away $> 8\text{s}$ or accumulating 3 Yellow events).
> - **Red**: Critical violations (multiple faces, cell phone in view, identity mismatch, or accumulating 3 Orange events). Red alerts trigger an emergency audio chime, notify recruiter monitors, and apply the session's `onRedPolicy` (`pause` or `continue`).

### 12. How is facial identity verified across an interview session?
> **Answer**: During the pre-interview check, `@vladmandic/face-api` computes a 128-dimensional Euclidean face descriptor vector from the candidate's camera stream. During the session, periodic frames compute descriptors and measure Euclidean distance $d(u, v) = \sqrt{\sum (u_i - v_i)^2}$. If distance exceeds $0.60$ for consecutive checks, an identity mismatch event is emitted. Raw video frames are discarded immediately on the client and never saved to the cloud.

### 13. How does the platform prevent privilege escalation on registration?
> **Answer**: The registration schema (`auth.schema.js`) and controller explicitly ignore any `role` field submitted in the public registration request body, hardcoding `role = 'candidate'`. Recruiters and administrators can only be created via the seed script or the authenticated admin-only endpoint `POST /api/users/admin/create-user`.

### 14. How is Judge0 and code execution secured against arbitrary execution?
> **Answer**: When Judge0 is configured, code executes inside isolated Docker containers with no network access, CPU quotas, memory ceilings (256 MB), and hard execution timeouts (5s). When Judge0 is unreachable, the API returns HTTP 503 (`EXECUTION_UNAVAILABLE`) rather than faking passes. For local development, an isolated child process runner runs only JavaScript with network module imports (`net`, `http`, `child_process`) blocked.

### 15. What happens if the Gemini LLM service is offline or GEMINI_API_KEY is not configured?
> **Answer**: AdaptIQ throws a typed `LLMUnavailableError` instead of returning silent fake scores. The scoring pipeline catches this error and gracefully falls back to the calibrated local Ridge regression heuristic model. The evaluation is explicitly stamped with `evaluatedBy: 'heuristic'`, confidence is capped at $0.40$, a visible badge is shown to candidate and recruiter, and unreviewed heuristic sessions cannot receive certified PDF badges.

### 16. How does the platform prevent fabricated quotes in LLM evaluations?
> **Answer**: The rubric scoring pipeline runs `verifyQuoteInAnswer(quote, answerText)`. If the LLM generates an "evidence quote" that does not exist verbatim as a normalized substring within the candidate's submitted answer text, the fabricated quote is discarded.

### 17. How does the skill graph detect root-cause knowledge deficiencies?
> **Answer**: The skill graph is a Directed Acyclic Graph (DAG) built using `graphology` with 84 skills and 112 prerequisite edges. When a candidate fails an advanced competency (e.g., *Distributed Transactions*), the engine walks backwards along in-neighbor edges (`inNeighbors(skill)`). If foundational prerequisites (e.g., *Database Indexing* or *ACID Isolation*) are unproven, the engine flags the earliest prerequisite as the root-cause gap.

### 18. Why use client-side Web Workers for computer vision instead of streaming video to the server?
> **Answer**: Streaming raw webcam video to a backend server incurs massive network bandwidth costs ($~2\text{ Mbps}$ per candidate), high server GPU costs, and severe privacy liabilities under GDPR and BIPA. Client-side execution in a dedicated Web Worker runs MediaPipe FaceLandmarker and COCO-SSD entirely in WebAssembly and WebGL on the candidate's hardware, transmitting only lightweight JSON telemetry events over WebSockets.

### 19. How does Bayesian Knowledge Tracing (BKT) update skill masteries?
> **Answer**: BKT tracks candidate mastery $P(L_t)$ as a Hidden Markov Model with parameters: initial mastery $P(L_0)$, transit $P(T)$, slip $P(S)$, and guess $P(G)$. Upon observing response $u_t$:
> $$P(L_t | u_t = 1) = \frac{P(L_t)(1 - P(S))}{P(L_t)(1 - P(S)) + (1 - P(L_t))P(G)}$$
> $$P(L_{t+1}) = P(L_t | u_t) + (1 - P(L_t | u_t)) P(T)$$
> This prevents single lucky guesses or accidental slips from distorting proven capability.

### 20. How does the platform ensure biometric data privacy and regulatory compliance?
> **Answer**: Under Illinois BIPA, Texas CBO, and GDPR Article 9:
> 1. Candidates must give explicit informed consent before camera initialization.
> 2. No facial biometric descriptors or raw video recordings are stored in a persistent database.
> 3. Descriptors reside purely in client volatile memory for the duration of the browser tab session.
> 4. Demographic data for EEOC audits is stored in an isolated, encrypted collection separated from candidate assessment profiles.
