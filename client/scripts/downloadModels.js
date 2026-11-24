import fs from 'fs';
import path from 'path';
import https from 'https';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const clientDir = path.resolve(__dirname, '..');
const publicModelsDir = path.join(clientDir, 'public', 'models');
const rootDir = path.resolve(clientDir, '..');

const downloadFile = (url, dest) => {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest) && fs.statSync(dest).size > 0) {
      console.log(`✓ Exists: ${path.basename(dest)}`);
      return resolve();
    }
    console.log(`Downloading: ${url} -> ${dest}`);
    const file = fs.createWriteStream(dest);
    const request = https.get(url, (response) => {
      if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
        file.close();
        fs.unlinkSync(dest);
        return downloadFile(response.headers.location, dest).then(resolve).catch(reject);
      }
      if (response.statusCode !== 200) {
        file.close();
        fs.unlinkSync(dest);
        return reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close(() => {
          console.log(`✓ Saved: ${path.basename(dest)} (${fs.statSync(dest).size} bytes)`);
          resolve();
        });
      });
    });
    request.on('error', (err) => {
      file.close();
      if (fs.existsSync(dest)) fs.unlinkSync(dest);
      reject(err);
    });
  });
};

async function main() {
  console.log('🚀 Setting up local vision model assets in client/public/models...');

  const faceApiDest = path.join(publicModelsDir, 'face-api');
  const mediapipeDest = path.join(publicModelsDir, 'mediapipe');
  const mediapipeWasmDest = path.join(mediapipeDest, 'wasm');
  const cocoSsdDest = path.join(publicModelsDir, 'coco-ssd');

  fs.mkdirSync(faceApiDest, { recursive: true });
  fs.mkdirSync(mediapipeWasmDest, { recursive: true });
  fs.mkdirSync(cocoSsdDest, { recursive: true });

  // 1. Copy face-api models from node_modules/@vladmandic/face-api/model
  const possibleFaceApiSrc = [
    path.join(clientDir, 'node_modules', '@vladmandic', 'face-api', 'model'),
    path.join(rootDir, 'node_modules', '@vladmandic', 'face-api', 'model')
  ].find((p) => fs.existsSync(p));

  if (possibleFaceApiSrc) {
    console.log(`Copying face-api models from ${possibleFaceApiSrc}...`);
    const faceApiFiles = [
      'tiny_face_detector_model-weights_manifest.json',
      'tiny_face_detector_model.bin',
      'face_landmark_68_model-weights_manifest.json',
      'face_landmark_68_model.bin',
      'face_recognition_model-weights_manifest.json',
      'face_recognition_model.bin'
    ];
    for (const f of faceApiFiles) {
      const src = path.join(possibleFaceApiSrc, f);
      const dest = path.join(faceApiDest, f);
      if (fs.existsSync(src)) {
        fs.copyFileSync(src, dest);
        console.log(`✓ Copied: face-api/${f}`);
      }
    }
  } else {
    console.warn('⚠️ Could not find @vladmandic/face-api/model in node_modules');
  }

  // 2. Copy MediaPipe tasks-vision wasm assets
  const possibleWasmSrc = [
    path.join(clientDir, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm'),
    path.join(rootDir, 'node_modules', '@mediapipe', 'tasks-vision', 'wasm')
  ].find((p) => fs.existsSync(p));

  if (possibleWasmSrc) {
    console.log(`Copying MediaPipe wasm assets from ${possibleWasmSrc}...`);
    const wasmFiles = fs.readdirSync(possibleWasmSrc);
    for (const f of wasmFiles) {
      fs.copyFileSync(path.join(possibleWasmSrc, f), path.join(mediapipeWasmDest, f));
      console.log(`✓ Copied: mediapipe/wasm/${f}`);
    }
  }

  // 3. Download MediaPipe FaceLandmarker task model
  const faceLandmarkerUrl =
    'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task';
  await downloadFile(faceLandmarkerUrl, path.join(mediapipeDest, 'face_landmarker.task'));

  // 4. Download COCO-SSD (ssdlite_mobilenet_v2) model.json and shards
  const cocoBaseUrl = 'https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/';
  const cocoModelJsonPath = path.join(cocoSsdDest, 'model.json');
  await downloadFile(`${cocoBaseUrl}model.json`, cocoModelJsonPath);

  // Read model.json to find shard files
  const modelJson = JSON.parse(fs.readFileSync(cocoModelJsonPath, 'utf8'));
  const shards = [];
  if (modelJson.weightsManifest) {
    for (const manifest of modelJson.weightsManifest) {
      if (manifest.paths) {
        shards.push(...manifest.paths);
      }
    }
  }

  for (const shard of shards) {
    await downloadFile(`${cocoBaseUrl}${shard}`, path.join(cocoSsdDest, shard));
  }

  // 5. Write README.md with source origins and licenses
  const licenseDoc = `# Computer Vision Models Documentation

All models are downloaded at build time and served locally from this directory (\`client/public/models\`). Exam sessions do NOT make outbound network calls or depend on external CDNs.

## 1. Google MediaPipe FaceLandmarker
- **File**: \`mediapipe/face_landmarker.task\`, \`mediapipe/wasm/*\`
- **Origin**: Google MediaPipe (\`https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/latest/face_landmarker.task\`)
- **License**: Apache 2.0
- **Capabilities**: 478 3D facial landmarks, eye iris tracking (landmarks 468-477), facial transformation matrix for 3D head yaw/pitch/roll.

## 2. TensorFlow COCO-SSD (ssdlite_mobilenet_v2)
- **Files**: \`coco-ssd/model.json\`, \`coco-ssd/group1-shard*of*\`
- **Origin**: TensorFlow.js Models (\`https://storage.googleapis.com/tfjs-models/savedmodel/ssdlite_mobilenet_v2/\`)
- **License**: Apache 2.0
- **Capabilities**: Object detection bounding boxes and confidence scores for 80 COCO classes, specifically monitoring prohibited items: cell phone, book, laptop, tv.

## 3. Face-API.js (@vladmandic/face-api)
- **Files**:
  - \`face-api/tiny_face_detector_model-*\`
  - \`face-api/face_landmark_68_model-*\`
  - \`face-api/face_recognition_model-*\`
- **Origin**: Bundled via \`@vladmandic/face-api\` (maintained fork of face-api.js by Vincent Mühler)
- **License**: MIT
- **Capabilities**: 128-dimensional facial recognition descriptor embedding vector for candidate biometric enrolment and continuous identity verification.
`;

  fs.writeFileSync(path.join(publicModelsDir, 'README.md'), licenseDoc);
  console.log('✅ Local model assets successfully configured in client/public/models!');
}

main().catch((err) => {
  console.error('❌ Failed to download model assets:', err);
  process.exit(1);
});
