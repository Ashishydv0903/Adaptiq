/**
 * @file faceIdentity.js
 * Biometric face recognition service powered by @vladmandic/face-api:
 * - Loads tinyFaceDetector, faceLandmark68Net, and faceRecognitionNet locally.
 * - enrol(frames[]): rejects if 0 or >1 face in any frame, averages 128-d descriptors.
 * - verify(frame, reference): returns Euclidean distance and match boolean against configurable threshold.
 */

import * as faceapi from '@vladmandic/face-api';
import { calculateEuclideanDistance, averageDescriptors } from './poseMath.js';
import { proctorConfigs } from '../../config/proctorConfig.js';

let isModelLoaded = false;
let initPromise = null;

/**
 * Initializes face-api.js networks from local models directory.
 *
 * @param {Object} [options]
 * @param {string} [options.modelsUri='/models/face-api']
 * @returns {Promise<boolean>}
 */
export async function initFaceIdentity({ modelsUri = '/models/face-api' } = {}) {
  if (isModelLoaded) {
    return true;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(modelsUri),
        faceapi.nets.faceLandmark68Net.loadFromUri(modelsUri),
        faceapi.nets.faceRecognitionNet.loadFromUri(modelsUri)
      ]);
      isModelLoaded = true;
      return true;
    } catch (err) {
      initPromise = null;
      console.error('Fatal: Failed to load face-api networks:', err);
      throw new Error(`Face identity models failed to load from ${modelsUri}: ${err.message}`);
    }
  })();

  return initPromise;
}

/**
 * Helper to ensure an input is a valid image/canvas element for face-api.
 *
 * @param {string|HTMLImageElement|HTMLCanvasElement|HTMLVideoElement} input
 * @returns {Promise<HTMLImageElement|HTMLCanvasElement|HTMLVideoElement>}
 */
async function resolveImageInput(input) {
  if (typeof input === 'string') {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = (e) => reject(new Error('Failed to load image from data URL for face processing'));
      img.src = input;
    });
  }
  return input;
}

/**
 * Enrols candidate biometric identity from 3 captured frames.
 * STRICT: Rejects enrolment if no face or more than 1 face is found in any frame.
 *
 * @param {Array<string|HTMLCanvasElement|HTMLImageElement>} frames - Exactly 3 captured frames
 * @returns {Promise<Array<number>>} 128-dimensional averaged descriptor vector
 */
export async function enrol(frames) {
  if (!isModelLoaded) {
    await initFaceIdentity();
  }

  if (!frames || frames.length < 3) {
    throw new Error('Enrolment requires 3 captured face frames.');
  }

  const descriptors = [];
  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.5
  });

  for (let i = 0; i < frames.length; i++) {
    const element = await resolveImageInput(frames[i]);
    const detections = await faceapi
      .detectAllFaces(element, detectorOptions)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (detections.length === 0) {
      throw new Error(`Enrolment rejected: No face detected in frame ${i + 1}. Please ensure your face is well-lit and directly facing the camera.`);
    }

    if (detections.length > 1) {
      throw new Error(`Enrolment rejected: Multiple faces (${detections.length}) detected in frame ${i + 1}. Ensure only the candidate is visible.`);
    }

    descriptors.push(Array.from(detections[0].descriptor));
  }

  const averagedDescriptor = averageDescriptors(descriptors);
  return averagedDescriptor;
}

/**
 * Verifies live frame against reference 128-d biometric descriptor.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|HTMLImageElement|string} frame
 * @param {Array<number>} referenceDescriptor - 128-d reference descriptor
 * @param {number} [threshold] - Configurable distance threshold (defaults to proctorConfigs.thresholds.identity.maxEmbeddingDistance || 0.5)
 * @returns {Promise<{
 *   isMatch: boolean,
 *   distance: number,
 *   faceFound: boolean,
 *   faceCount: number,
 *   threshold: number,
 *   descriptor: Array<number>|null
 * }>}
 */
export async function verify(
  frame,
  referenceDescriptor,
  threshold = proctorConfigs.thresholds?.identity?.maxEmbeddingDistance || 0.5
) {
  if (!isModelLoaded) {
    await initFaceIdentity();
  }

  if (!referenceDescriptor || referenceDescriptor.length === 0) {
    return {
      isMatch: true,
      distance: 0,
      faceFound: false,
      faceCount: 0,
      threshold,
      descriptor: null
    };
  }

  const element = await resolveImageInput(frame);
  if (!element || (element.readyState !== undefined && element.readyState < 2)) {
    return {
      isMatch: true,
      distance: 0,
      faceFound: false,
      faceCount: 0,
      threshold,
      descriptor: null
    };
  }

  const detectorOptions = new faceapi.TinyFaceDetectorOptions({
    inputSize: 224,
    scoreThreshold: 0.45
  });

  const detections = await faceapi
    .detectAllFaces(element, detectorOptions)
    .withFaceLandmarks()
    .withFaceDescriptors();

  if (detections.length === 0) {
    return {
      isMatch: false,
      distance: 1.0,
      faceFound: false,
      faceCount: 0,
      threshold,
      descriptor: null
    };
  }

  const liveDescriptor = Array.from(detections[0].descriptor);
  const distance = calculateEuclideanDistance(liveDescriptor, referenceDescriptor);
  const isMatch = distance <= threshold;

  return {
    isMatch,
    distance,
    faceFound: true,
    faceCount: detections.length,
    threshold,
    descriptor: liveDescriptor
  };
}

/**
 * Resets the face-api state.
 */
export function resetFaceIdentity() {
  isModelLoaded = false;
  initPromise = null;
}
