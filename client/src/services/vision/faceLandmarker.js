/**
 * @file faceLandmarker.js
 * MediaPipe FaceLandmarker service: loads local model, detects up to 2 faces,
 * extracts 478 3D landmarks, facial transformation matrices, head pose (yaw/pitch),
 * and iris gaze offsets.
 */

import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision';
import { deriveHeadPoseFromMatrix, calculateIrisOffset } from './poseMath.js';

let landmarkerInstance = null;
let initPromise = null;

/**
 * Initializes and returns the MediaPipe FaceLandmarker singleton.
 * Fails loudly if model or wasm assets cannot be loaded.
 *
 * @param {Object} [options]
 * @param {string} [options.wasmPath='/models/mediapipe/wasm']
 * @param {string} [options.modelPath='/models/mediapipe/face_landmarker.task']
 * @returns {Promise<FaceLandmarker>}
 */
export async function initFaceLandmarker({
  wasmPath = '/models/mediapipe/wasm',
  modelPath = '/models/mediapipe/face_landmarker.task'
} = {}) {
  if (landmarkerInstance) {
    return landmarkerInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      const visionWasm = await FilesetResolver.forVisionTasks(wasmPath);

      let landmarker = null;
      // Try GPU delegate first, fallback to CPU if GPU unavailable
      try {
        landmarker = await FaceLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'GPU'
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      } catch (gpuError) {
        console.warn('MediaPipe GPU delegate initialization failed, falling back to CPU:', gpuError);
        landmarker = await FaceLandmarker.createFromOptions(visionWasm, {
          baseOptions: {
            modelAssetPath: modelPath,
            delegate: 'CPU'
          },
          runningMode: 'VIDEO',
          numFaces: 2,
          outputFacialTransformationMatrixes: true,
          outputFaceBlendshapes: false
        });
      }

      landmarkerInstance = landmarker;
      return landmarkerInstance;
    } catch (err) {
      initPromise = null;
      console.error('Fatal: Failed to load MediaPipe FaceLandmarker:', err);
      throw new Error(`MediaPipe FaceLandmarker failed to load from ${modelPath}: ${err.message}`);
    }
  })();

  return initPromise;
}

/**
 * Analyzes a single video frame for face landmarks, pose, and iris gaze.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|ImageData} videoElement
 * @param {number} [timestampMs=performance.now()]
 * @returns {{
 *   faceCount: number,
 *   landmarks: Array<{x: number, y: number, z: number}>,
 *   allFaces: Array<Array<{x: number, y: number, z: number}>>,
 *   yaw: number,
 *   pitch: number,
 *   roll: number,
 *   irisOffset: number,
 *   leftIrisOffset: number,
 *   rightIrisOffset: number,
 *   isLookingAway: boolean
 * }}
 */
export function detectFaceLandmarks(videoElement, timestampMs = performance.now()) {
  if (!landmarkerInstance) {
    throw new Error('FaceLandmarker is not initialized. Call initFaceLandmarker() first.');
  }

  if (!videoElement || (videoElement.readyState !== undefined && videoElement.readyState < 2)) {
    return {
      faceCount: 0,
      landmarks: [],
      allFaces: [],
      yaw: 0,
      pitch: 0,
      roll: 0,
      irisOffset: 0,
      leftIrisOffset: 0,
      rightIrisOffset: 0,
      isLookingAway: false
    };
  }

  const result = landmarkerInstance.detectForVideo(videoElement, timestampMs);

  const faceCount = result.faceLandmarks ? result.faceLandmarks.length : 0;
  if (faceCount === 0) {
    return {
      faceCount: 0,
      landmarks: [],
      allFaces: [],
      yaw: 0,
      pitch: 0,
      roll: 0,
      irisOffset: 0,
      leftIrisOffset: 0,
      rightIrisOffset: 0,
      isLookingAway: false
    };
  }

  const primaryLandmarks = result.faceLandmarks[0] || [];
  const primaryMatrix = result.facialTransformationMatrixes?.[0] || null;

  const pose = deriveHeadPoseFromMatrix(primaryMatrix);
  const iris = calculateIrisOffset(primaryLandmarks);

  const isLookingAway = iris.isLookingAway || Math.abs(pose.yaw) > 25 || Math.abs(pose.pitch) > 20;

  return {
    faceCount,
    landmarks: primaryLandmarks,
    allFaces: result.faceLandmarks,
    yaw: pose.yaw,
    pitch: pose.pitch,
    roll: pose.roll,
    irisOffset: iris.irisOffset,
    leftIrisOffset: iris.leftIrisOffset,
    rightIrisOffset: iris.rightIrisOffset,
    isLookingAway
  };
}

/**
 * Resets / releases the FaceLandmarker instance.
 */
export function resetFaceLandmarker() {
  if (landmarkerInstance) {
    try {
      landmarkerInstance.close();
    } catch (e) {
      // ignore
    }
    landmarkerInstance = null;
  }
  initPromise = null;
}
