# Computer Vision Models Documentation

All models are downloaded at build time and served locally from this directory (`client/public/models`). Exam sessions do NOT make outbound network calls or depend on external CDNs.

## 1. Google MediaPipe FaceLandmarker
- **File**: `mediapipe/face_landmarker.task`, `mediapipe/wasm/*`
- **Origin**: Google MediaPipe (`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task`)
- **License**: Apache 2.0
- **Capabilities**: 478 3D facial landmarks, eye iris tracking (landmarks 468-477), facial transformation matrix for 3D head yaw/pitch/roll.

## 2. TensorFlow COCO-SSD (ssdlite_mobilenet_v2)
- **Files**: `coco-ssd/model.json`, `coco-ssd/group1-shard*of*`
- **Origin**: TensorFlow.js Models (`https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/`)
- **License**: Apache 2.0
- **Capabilities**: Object detection bounding boxes and confidence scores for 80 COCO classes, specifically monitoring prohibited items: cell phone, book, laptop, tv.

## 3. Face-API.js (@vladmandic/face-api)
- **Files**:
  - `face-api/tiny_face_detector_model-*`
  - `face-api/face_landmark_68_model-*`
  - `face-api/face_recognition_model-*`
- **Origin**: Bundled via `@vladmandic/face-api` (maintained fork of face-api.js by Vincent Mühler)
- **License**: MIT
- **Capabilities**: 128-dimensional facial recognition descriptor embedding vector for candidate biometric enrolment and continuous identity verification.
