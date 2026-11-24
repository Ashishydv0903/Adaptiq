/**
 * @file objectDetector.js
 * TensorFlow.js COCO-SSD object detection service: detects prohibited items
 * (cell phone, book, laptop, tv) with confidence scores using local model weights.
 */

import * as tf from '@tensorflow/tfjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';

let detectorInstance = null;
let initPromise = null;

const PROHIBITED_CLASSES = new Set([
  'cell phone',
  'phone',
  'book',
  'laptop',
  'tv',
  'television'
]);

/**
 * Initializes and returns the COCO-SSD object detector using local weights.
 *
 * @param {Object} [options]
 * @param {string} [options.modelUrl='/models/coco-ssd/model.json']
 * @param {string} [options.base='lite_mobilenet_v2']
 * @returns {Promise<cocoSsd.ObjectDetection>}
 */
export async function initObjectDetector({
  modelUrl = '/models/coco-ssd/model.json',
  base = 'lite_mobilenet_v2'
} = {}) {
  if (detectorInstance) {
    return detectorInstance;
  }
  if (initPromise) {
    return initPromise;
  }

  initPromise = (async () => {
    try {
      await tf.ready();
      const model = await cocoSsd.load({
        base,
        modelUrl
      });
      detectorInstance = model;
      return detectorInstance;
    } catch (err) {
      initPromise = null;
      console.error('Fatal: Failed to load COCO-SSD Object Detector:', err);
      throw new Error(`COCO-SSD Object Detector failed to load from ${modelUrl}: ${err.message}`);
    }
  })();

  return initPromise;
}

/**
 * Detects prohibited objects in a video or canvas element.
 *
 * @param {HTMLVideoElement|HTMLCanvasElement|ImageData} inputElement
 * @param {number} [minScore=0.50] - Confidence threshold
 * @returns {Promise<{
 *   hasProhibitedObject: boolean,
 *   prohibitedDetections: Array<{ class: string, score: number, bbox: number[] }>,
 *   allDetections: Array<{ class: string, score: number, bbox: number[] }>,
 *   primaryViolation: { class: string, score: number } | null
 * }>}
 */
export async function detectProhibitedObjects(inputElement, minScore = 0.5) {
  if (!detectorInstance) {
    throw new Error('ObjectDetector is not initialized. Call initObjectDetector() first.');
  }

  if (!inputElement || (inputElement.readyState !== undefined && inputElement.readyState < 2)) {
    return {
      hasProhibitedObject: false,
      prohibitedDetections: [],
      allDetections: [],
      primaryViolation: null
    };
  }

  try {
    const predictions = await detectorInstance.detect(inputElement, 10, minScore);

    const prohibitedDetections = [];
    for (const pred of predictions) {
      const label = (pred.class || '').toLowerCase();
      if (PROHIBITED_CLASSES.has(label) && pred.score >= minScore) {
        prohibitedDetections.push({
          class: label === 'phone' ? 'cell phone' : label === 'television' ? 'tv' : label,
          score: Number(pred.score.toFixed(3)),
          bbox: pred.bbox
        });
      }
    }

    const hasProhibitedObject = prohibitedDetections.length > 0;
    const primaryViolation = hasProhibitedObject
      ? prohibitedDetections.reduce((max, d) => (d.score > max.score ? d : max), prohibitedDetections[0])
      : null;

    return {
      hasProhibitedObject,
      prohibitedDetections,
      allDetections: predictions,
      primaryViolation
    };
  } catch (err) {
    console.warn('Object detection frame error:', err);
    return {
      hasProhibitedObject: false,
      prohibitedDetections: [],
      allDetections: [],
      primaryViolation: null
    };
  }
}

/**
 * Resets / releases the ObjectDetector instance.
 */
export function resetObjectDetector() {
  if (detectorInstance) {
    try {
      if (detectorInstance.dispose) detectorInstance.dispose();
    } catch (e) {
      // ignore
    }
    detectorInstance = null;
  }
  initPromise = null;
}
