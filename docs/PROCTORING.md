# AdaptIQ Computer Vision Proctoring System

## 1. Overview & Architecture

AdaptIQ replaces synthetic heuristics with a production-grade, multi-model client-side computer vision pipeline. The architecture executes all neural network inference on candidate hardware inside the browser, decoupling vision inference from policy rule evaluation.

```
                           +-------------------------------------+
                           |      Webcam & Audio MediaStream     |
                           +-------------------------------------+
                                              |
                     requestVideoFrameCallback (fallback: setInterval)
                                              |
        +-------------------------------------+-----------------------------------+
        |                                     |                                   |
 ~2 - 4 FPS                           ~0.5 FPS (~2.0s)                     ~0.2 FPS (~5.0s)
        v                                     v                                   v
+-----------------------+           +--------------------+              +--------------------+
| MediaPipe FaceLandmark|           |      COCO-SSD      |              | face-api Descriptor|
| - 478 3D landmarks    |           | - Prohibited Obj   |              | - 128-d vector     |
| - Facial Transform Mtx|           |   (phone, book,    |              | - TinyFace+Landmark|
| - Iris tracking       |           |    laptop, tv)     |              | - Euclidean dist   |
+-----------------------+           +--------------------+              +--------------------+
        |                                     |                                   |
        +-------------------------------------+-----------------------------------+
                                              |
                                Vision Inference Results
                                              |
                                              v
                           +-------------------------------------+
                           |        proctor.worker.js            |
                           |   (Dedicated Web Worker Thread)     |
                           | - Duration & temporal smoothing     |
                           | - Severity assignment (Y/O/R)       |
                           | - Multi-strike escalation           |
                           +-------------------------------------+
                                              |
                                Verified Incident Event
                                              |
                                              v
                           +-------------------------------------+
                           | Socket.io & REST Evidence Upload    |
                           | - AES-GCM Encrypted Biometrics      |
                           | - WebRTC Snapshot / Audit Log       |
                           +-------------------------------------+
```

### Module Responsibilities

1. **`client/src/services/vision/poseMath.js`**:
   - Pure, stateless math functions with fixture tests.
   - Euler angle extraction (`yaw`, `pitch`, `roll`) from MediaPipe's 4x4 facial transformation matrix.
   - Eye gaze offset from landmarks 468–477 relative to eye corners (inner/outer canthi).
   - Biometric descriptor averaging across frames and Euclidean distance metric.

2. **`client/src/services/vision/faceLandmarker.js`**:
   - MediaPipe Tasks Vision (`FaceLandmarker`).
   - Configured with `numFaces: 2` to detect multiple people simultaneously.
   - Returns real facial transformation matrices, bounding boxes, and iris coordinates.

3. **`client/src/services/vision/objectDetector.js`**:
   - TensorFlow.js COCO-SSD object detection.
   - Filtered exclusively for prohibited exam items: `cell phone`, `book`, `laptop`, `tv`.
   - Polled every ~1.5–2.0 seconds to balance CPU load.

4. **`client/src/services/vision/faceIdentity.js`**:
   - `@vladmandic/face-api` (128-dimensional facial embedding descriptor).
   - Multi-frame biometric enrolment (`enrol([f1, f2, f3])`) with mandatory single-face gating.
   - Continuous verification against reference embedding (`verify(frame, ref)`), Euclidean threshold configurable at `0.50`.

5. **`client/src/workers/proctor.worker.js`**:
   - Decoupled Web Worker maintaining temporal violation timers, duration thresholds, and multi-strike escalations.
   - Receives model outputs from the UI thread; emits actionable proctoring events (`status`, `events`, `counts`).

---

## 2. Offline Model Serving Policy (Zero Exam-Time CDN)

To guarantee assessment integrity, exam availability, and compliance with data isolation, **no models or weights are fetched from external CDNs at runtime**.

- All model binaries and WASM assets are served locally from `client/public/models/`.
- The build pipeline includes `scripts/downloadModels.js`, executed via `npm run download:models` or prior to `npm run build`.

### Model Inventory & Licenses

| Model | Path in `client/public/models/` | Origin / Source | License |
|---|---|---|---|
| **MediaPipe FaceLandmarker Task** | `mediapipe/face_landmarker.task` (3.7 MB) | Google MediaPipe Tasks Vision Bundle | Apache 2.0 |
| **MediaPipe WASM Runtime** | `mediapipe/wasm/` (`vision_wasm_internal.*`) | Google MediaPipe Tasks Vision NPM | Apache 2.0 |
| **COCO-SSD Object Detection** | `coco-ssd/model.json` + `group1-shard*of5.bin` | TensorFlow.js Models repository | Apache 2.0 |
| **Tiny Face Detector** | `face-api/tiny_face_detector_model-*` | `@vladmandic/face-api` package repository | MIT |
| **Face Landmark 68 Net** | `face-api/face_landmark_68_model-*` | `@vladmandic/face-api` package repository | MIT |
| **Face Recognition Net** | `face-api/face_recognition_model-*` | `@vladmandic/face-api` package repository | MIT |

---

## 3. Biometric Enrolment & Continuous Verification

Biometric enrolment occurs during the pre-interview system diagnostics (`PreInterviewSystemCheck.jsx`):

1. **Strict Single-Face Validation**:
   - Captures 3 distinct video frames.
   - For every frame, `detectFaceLandmarks()` verifies that exactly 1 face is present.
   - If 0 faces or >1 face is detected during any frame capture, enrolment is immediately rejected with a corrective prompt.

2. **Descriptor Averaging**:
   - `@vladmandic/face-api` generates a 128-dimensional floating point vector for each valid frame.
   - Vectors are averaged element-wise and normalized to produce a stable baseline embedding.

3. **End-to-End Encryption**:
   - The averaged 128-d reference descriptor is encrypted in candidate browser memory using WebCrypto **AES-GCM-256** with an ephemeral key derivation prior to transmission.
   - Stored in the database associated with the assessment session.

4. **Continuous Identity Verification**:
   - Every ~5 seconds, candidate face descriptor is recomputed and compared against the baseline.
   - Euclidean distance $> 0.50$ triggers an `IDENTITY_MISMATCH` violation.

---

## 4. Detection Rules, Severities & Escalation

Infractions are classified into standard severity tiers (`yellow`, `orange`, `red`):

### Base Severity Specifications

| Incident Type | Trigger Condition | Severity | Description |
|---|---|---|---|
| `MULTIPLE_FACES` | Face count $> 1$ | **RED** | Unauthorized third-party detected in camera feed. |
| `IDENTITY_MISMATCH` | Embedding distance $> 0.50$ | **RED** | Candidate face does not match enrolled biometric baseline (impersonation risk). |
| `PROHIBITED_OBJECT` | `cell phone`, `book`, `laptop`, `tv` detected | **RED** | Unauthorized communication device or secondary computer in frame. |
| `NO_FACE` | Face missing $\ge 1.2\text{s}$ | **YELLOW** | Candidate momentarily out of camera frame. |
| `NO_FACE` | Face missing $\ge 3.0\text{s}$ | **ORANGE** | Prolonged camera absence. |
| `NO_FACE` | Face missing $\ge 6.0\text{s}$ | **RED** | Abandoned assessment workstation. |
| `LOOKING_AWAY` | Yaw $> 25^\circ$, Pitch $> 20^\circ$, or Iris offset $> 0.25$ for $\ge 1.5\text{s}$ | **YELLOW** | Off-screen gaze detected. |
| `LOOKING_AWAY` | Sustained gaze deviation $\ge 3.5\text{s}$ | **ORANGE** | Prolonged secondary monitor or peripheral viewing. |

### Multi-Strike Escalation

The Web Worker maintains rolling infraction counters:
- **3 YELLOW infractions** escalate the 3rd event to **ORANGE**.
- **3 ORANGE infractions** escalate the 3rd event to **RED**.
- Any **RED** infraction triggers an urgent alert, sounds an advisory chime, lowers the certified trust score, and reports directly to the recruiter live monitor.

---

## 5. Fail-Loudly & Performance Safeguards

### Fail-Loudly Policy (No Simulation Fallback)
Simulated fallback modes represent a critical vulnerability in proctoring platforms. AdaptIQ enforces strict gatekeeping:
- If model assets fail to load (e.g., missing weights, corrupted bundle, or disabled WebGL/WASM):
  - Pre-interview diagnostics lock the "Start Interview" button.
  - A prominent error banner displays: *"Vision Models Loading Error: AI Proctoring models failed to load. The interview cannot proceed without computer vision integrity models."*
  - A "Retry Models" button permits re-initialization once network/device issues are resolved.
- If model failure occurs inside an active interview room:
  - An un-dismissible blocking modal freezes the interview timer and answers.
  - The assessment does not silently fall back to synthetic data.

### Low Performance Mode Guard
To support low-tier client devices without crashing the browser:
- If the moving average inference latency across consecutive frames exceeds **400 ms**:
  - The sampling loop automatically throttles landmark frequency to ~1.5 FPS.
  - Object detection (COCO-SSD) frequency is reduced to ~0.2 FPS.
  - A non-intrusive status pill notifies the candidate: *"Low Performance Mode: Vision inference exceeded 400ms. Reduced frame rate to preserve device responsiveness."*

---

## 6. Viva Demonstration Controls

For examination demonstrations, viva evaluations, and offline assessor grading:
- A floating proctoring simulation panel is mounted **exclusively** when `import.meta.env.VITE_DEMO_MODE === 'true'`.
- Testers can inject test events (`cell phone`, `multiple faces`, `identity mismatch`).
- All injected events are stamped with `source: 'demo'`.
- Recruiter live monitors and candidate audit logs render a distinct purple **"SIMULATED"** tag.
- Algorithmic fairness reports (`server/src/services/fairness/proctorFairnessMetrics.js`) strictly filter out all sessions and events carrying `source: 'demo'`, ensuring artificial tests never bias demographic fairness statistics.

---

## 7. Known Proctoring Limitations & Technical Mitigations

While computer vision dramatically increases assessment integrity, client-side browser proctoring has inherent physical boundaries. Assessor awareness of these limits is essential:

### 1. Second Device Out of Camera Frame
- **Limitation**: A secondary monitor, tablet, or mobile phone positioned directly behind the webcam or below the camera view angle cannot be detected by computer vision bounding boxes.
- **System Mitigations**:
  - **Full-Screen Enforcement**: The browser triggers an immediate blur/tab-switch penalty if candidate clicks outside the viewport.
  - **3D Head Yaw/Pitch & Iris Tracking**: Continuous gaze vector analysis detects subtle eye and head downward or peripheral angles exceeding $25^\circ$.
  - **Adaptive Questioning**: Adaptive IRT (Item Response Theory) dynamically introduces personalized follow-up deep-dives based on candidate answers, making static crib notes ineffective.

### 2. Concealed Audio Devices (Earphones / Bone-Conduction)
- **Limitation**: Ultra-miniature in-ear monitors (IEMs), long hair obscuring ears, or bone-conduction headbands can transmit answers from a third-party accomplice.
- **System Mitigations**:
  - **Audio Frequency & Spectral Monitoring**: WebAudio analyser continuously measures background ambient noise and secondary conversational harmonics.
  - **Speed & Cadence Analysis**: Keystroke burst vs. natural typing analysis detects unnatural pauses followed by pre-composed answers.

### 3. External HDMI Splitters & Virtual Displays
- **Limitation**: Hardware HDMI splitters clone candidate video output to an external solver without triggering operating system display detection.
- **System Mitigations**:
  - Web-based proctoring cannot detect physical hardware splitters. AdaptIQ balances automated computer vision with live human recruiter oversight via the `RecruiterLiveMonitor` WebRTC video feed, along with explainable evidence trails for post-interview review.

### 4. Sub-Threshold Micro-Glances
- **Limitation**: Candidates looking away for $< 1.2$ seconds (e.g., natural thinking pauses or brief glances at a physical notepad) fall below the duration threshold to prevent false positives.
- **System Mitigations**:
  - Natural human thinking patterns involve occasional saccadic eye movements. AdaptIQ's duration thresholds ($1.5\text{s}$ for looking away, $1.2\text{s}$ for missing face) prevent candidate penalization for normal cognitive reflection while catching sustained cheating.
