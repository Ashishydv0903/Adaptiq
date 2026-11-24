/**
 * @file poseMath.js
 * Pure mathematical functions for 3D head pose estimation, iris gaze tracking,
 * and biometric vector distance calculation.
 */

const RAD_TO_DEG = 180 / Math.PI;

/**
 * Extracts 3D Euler angles (yaw, pitch, roll) in degrees from MediaPipe's 4x4 facial transformation matrix.
 * Supports flat 16-element array/Float32Array (column-major or row-major) or 4x4 matrix.
 *
 * @param {Array<number>|Float32Array|Object} matrixData - 4x4 transformation matrix or { data: Float32Array }
 * @returns {{ yaw: number, pitch: number, roll: number }} Angles in degrees rounded to 1 decimal place.
 */
export function deriveHeadPoseFromMatrix(matrixData) {
  if (!matrixData) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  const raw = Array.isArray(matrixData)
    ? matrixData
    : matrixData.data
      ? Array.from(matrixData.data)
      : Array.isArray(matrixData.rows)
        ? matrixData.rows.flat()
        : null;

  if (!raw || raw.length < 16) {
    return { yaw: 0, pitch: 0, roll: 0 };
  }

  // MediaPipe facial transformation matrix convention:
  // Column-major indices:
  // [0] m00, [1] m10, [2] m20, [3] m30
  // [4] m01, [5] m11, [6] m21, [7] m31
  // [8] m02, [9] m12, [10] m22, [11] m32
  // [12] tx, [13] ty, [14] tz, [15] 1
  const m00 = raw[0];
  const m10 = raw[1];
  const m20 = raw[2];
  const m01 = raw[4];
  const m11 = raw[5];
  const m21 = raw[6];
  const m02 = raw[8];
  const m12 = raw[9];
  const m22 = raw[10];

  // Pitch (X-rotation): tilt up/down
  // Yaw (Y-rotation): turn left/right
  // Roll (Z-rotation): tilt sideways
  let pitchRad = 0;
  let yawRad = 0;
  let rollRad = 0;

  // Gimbal lock safe decomposition
  if (Math.abs(m20) < 0.9999) {
    yawRad = Math.atan2(m02, m22);
    pitchRad = Math.atan2(-m12, Math.sqrt(m02 * m02 + m22 * m22));
    rollRad = Math.atan2(m10, m11);
  } else {
    // Gimbal lock
    yawRad = Math.atan2(-m01, m00);
    pitchRad = m20 > 0 ? -Math.PI / 2 : Math.PI / 2;
    rollRad = 0;
  }

  return {
    yaw: Number((yawRad * RAD_TO_DEG).toFixed(1)),
    pitch: Number((pitchRad * RAD_TO_DEG).toFixed(1)),
    roll: Number((rollRad * RAD_TO_DEG).toFixed(1))
  };
}

/**
 * Calculates normalized iris offset from landmarks.
 * Canonical MediaPipe landmark indices:
 * Left Eye: 33 (outer corner), 133 (inner corner), 468 (iris center)
 * Right Eye: 263 (outer corner), 362 (inner corner), 473 (iris center)
 *
 * @param {Array<{ x: number, y: number, z?: number }>} landmarks - 478 face mesh landmarks
 * @param {number} [threshold=0.25] - Threshold above which gaze is considered looking away
 * @returns {{ leftIrisOffset: number, rightIrisOffset: number, irisOffset: number, isLookingAway: boolean }}
 */
export function calculateIrisOffset(landmarks, threshold = 0.25) {
  if (!landmarks || landmarks.length < 474) {
    return { leftIrisOffset: 0, rightIrisOffset: 0, irisOffset: 0, isLookingAway: false };
  }

  // Left Eye
  const leftOuter = landmarks[33];
  const leftInner = landmarks[133];
  const leftIris = landmarks[468];

  let leftIrisOffset = 0;
  if (leftOuter && leftInner && leftIris) {
    const eyeCenterLeft = (leftOuter.x + leftInner.x) / 2;
    const eyeWidthLeft = Math.abs(leftInner.x - leftOuter.x);
    if (eyeWidthLeft > 0.005) {
      leftIrisOffset = (leftIris.x - eyeCenterLeft) / eyeWidthLeft;
    }
  }

  // Right Eye
  const rightOuter = landmarks[263];
  const rightInner = landmarks[362];
  const rightIris = landmarks[473];

  let rightIrisOffset = 0;
  if (rightOuter && rightInner && rightIris) {
    const eyeCenterRight = (rightOuter.x + rightInner.x) / 2;
    const eyeWidthRight = Math.abs(rightOuter.x - rightInner.x);
    if (eyeWidthRight > 0.005) {
      rightIrisOffset = (rightIris.x - eyeCenterRight) / eyeWidthRight;
    }
  }

  const avgOffset = (Math.abs(leftIrisOffset) + Math.abs(rightIrisOffset)) / 2;
  const isLookingAway = avgOffset > threshold;

  return {
    leftIrisOffset: Number(leftIrisOffset.toFixed(3)),
    rightIrisOffset: Number(rightIrisOffset.toFixed(3)),
    irisOffset: Number(avgOffset.toFixed(3)),
    isLookingAway
  };
}

/**
 * Euclidean distance between two biometric descriptor vectors
 *
 * @param {Array<number>|Float32Array} vecA
 * @param {Array<number>|Float32Array} vecB
 * @returns {number}
 */
export function calculateEuclideanDistance(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 1.0;
  }

  let sum = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sum += diff * diff;
  }
  return Number(Math.sqrt(sum).toFixed(4));
}

/**
 * Averages multiple biometric descriptors and unit-normalizes the result
 *
 * @param {Array<Array<number>|Float32Array>} descriptors - Array of 128-d descriptor vectors
 * @returns {Array<number>} 128-d normalized average vector
 */
export function averageDescriptors(descriptors) {
  if (!descriptors || descriptors.length === 0) {
    return [];
  }

  const len = descriptors[0].length;
  const avg = new Float64Array(len);

  for (const desc of descriptors) {
    for (let i = 0; i < len; i++) {
      avg[i] += desc[i];
    }
  }

  const count = descriptors.length;
  let norm = 0;
  for (let i = 0; i < len; i++) {
    avg[i] /= count;
    norm += avg[i] * avg[i];
  }

  const magnitude = Math.sqrt(norm) || 1;
  const result = new Array(len);
  for (let i = 0; i < len; i++) {
    result[i] = Number((avg[i] / magnitude).toFixed(5));
  }

  return result;
}
