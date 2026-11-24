import { describe, test, expect } from 'vitest';
import {
  deriveHeadPoseFromMatrix,
  calculateIrisOffset,
  calculateEuclideanDistance,
  averageDescriptors
} from '../../services/vision/poseMath.js';

describe('Vision Pose Math Unit Tests (Fixtures & Edge Cases)', () => {
  describe('deriveHeadPoseFromMatrix', () => {
    test('returns 0 angles for identity matrix', () => {
      // 4x4 Identity matrix in column-major order
      const identityMatrix = [
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ];

      const pose = deriveHeadPoseFromMatrix(identityMatrix);
      expect(pose.yaw).toBe(0);
      expect(pose.pitch).toBe(0);
      expect(pose.roll).toBe(0);
    });

    test('extracts yaw rotation correctly from known rotation matrix', () => {
      // 30 degree rotation around Y-axis (Yaw)
      // cos(30) ~ 0.866, sin(30) = 0.5
      const rad30 = (30 * Math.PI) / 180;
      const cos = Math.cos(rad30);
      const sin = Math.sin(rad30);

      const yaw30Matrix = [
        cos, 0, -sin, 0,
        0, 1, 0, 0,
        sin, 0, cos, 0,
        0, 0, 0, 1
      ];

      const pose = deriveHeadPoseFromMatrix(yaw30Matrix);
      expect(Math.abs(Math.abs(pose.yaw) - 30)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pose.pitch)).toBeLessThanOrEqual(0.5);
    });

    test('extracts pitch rotation correctly from known rotation matrix', () => {
      // 20 degree rotation around X-axis (Pitch)
      const rad20 = (20 * Math.PI) / 180;
      const cos = Math.cos(rad20);
      const sin = Math.sin(rad20);

      const pitch20Matrix = [
        1, 0, 0, 0,
        0, cos, sin, 0,
        0, -sin, cos, 0,
        0, 0, 0, 1
      ];

      const pose = deriveHeadPoseFromMatrix(pitch20Matrix);
      expect(Math.abs(Math.abs(pose.pitch) - 20)).toBeLessThanOrEqual(0.5);
      expect(Math.abs(pose.yaw)).toBeLessThanOrEqual(0.5);
    });

    test('handles MediaPipe Float32Array object { data: Float32Array } safely', () => {
      const data = new Float32Array([
        1, 0, 0, 0,
        0, 1, 0, 0,
        0, 0, 1, 0,
        0, 0, 0, 1
      ]);
      const pose = deriveHeadPoseFromMatrix({ data });
      expect(pose).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    });

    test('returns zero angles gracefully for null or invalid matrix inputs', () => {
      expect(deriveHeadPoseFromMatrix(null)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
      expect(deriveHeadPoseFromMatrix([])).toEqual({ yaw: 0, pitch: 0, roll: 0 });
      expect(deriveHeadPoseFromMatrix([1, 2, 3])).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    });
  });

  describe('calculateIrisOffset', () => {
    // Generate a fixture with 478 canonical landmarks
    const createLandmarkFixture = (irisXOffset = 0) => {
      const landmarks = Array.from({ length: 478 }, () => ({ x: 0.5, y: 0.5, z: 0 }));
      // Left eye outer: 33, inner: 133, iris: 468
      landmarks[33] = { x: 0.40, y: 0.40 };
      landmarks[133] = { x: 0.48, y: 0.40 };
      // Center of left eye = 0.44
      landmarks[468] = { x: 0.44 + irisXOffset, y: 0.40 };

      // Right eye inner: 362, outer: 263, iris: 473
      landmarks[362] = { x: 0.52, y: 0.40 };
      landmarks[263] = { x: 0.60, y: 0.40 };
      // Center of right eye = 0.56
      landmarks[473] = { x: 0.56 + irisXOffset, y: 0.40 };

      return landmarks;
    };

    test('returns centered gaze when irises are centered in eyes', () => {
      const centeredLandmarks = createLandmarkFixture(0.0);
      const res = calculateIrisOffset(centeredLandmarks, 0.25);
      expect(res.irisOffset).toBe(0);
      expect(res.isLookingAway).toBe(false);
    });

    test('flags looking away when iris deviation exceeds threshold', () => {
      // Eye width = 0.08, deviation = 0.03 -> offset = 0.03 / 0.08 = 0.375 (> 0.25)
      const deviatedLandmarks = createLandmarkFixture(0.03);
      const res = calculateIrisOffset(deviatedLandmarks, 0.25);
      expect(res.irisOffset).toBeGreaterThan(0.25);
      expect(res.isLookingAway).toBe(true);
    });

    test('handles missing or incomplete landmark arrays gracefully', () => {
      const res = calculateIrisOffset([]);
      expect(res.isLookingAway).toBe(false);
      expect(res.irisOffset).toBe(0);
    });
  });

  describe('calculateEuclideanDistance & averageDescriptors', () => {
    test('returns 0 distance for identical 128-d descriptors', () => {
      const descA = new Array(128).fill(0.12);
      const descB = new Array(128).fill(0.12);
      expect(calculateEuclideanDistance(descA, descB)).toBe(0);
    });

    test('computes accurate Euclidean distance between distinct vectors', () => {
      const descA = new Array(128).fill(0.0);
      const descB = new Array(128).fill(0.0);
      descB[0] = 0.3;
      descB[1] = 0.4;
      // sqrt(0.3^2 + 0.4^2) = 0.5
      expect(calculateEuclideanDistance(descA, descB)).toBe(0.5);
    });

    test('averageDescriptors produces unit-normalized average of 3 frames', () => {
      const f1 = new Array(128).fill(0.1);
      const f2 = new Array(128).fill(0.2);
      const f3 = new Array(128).fill(0.3);

      const averaged = averageDescriptors([f1, f2, f3]);
      expect(averaged.length).toBe(128);

      // Verify unit norm: sqrt(sum(x^2)) ~= 1.0
      const norm = Math.sqrt(averaged.reduce((sum, x) => sum + x * x, 0));
      expect(Math.abs(norm - 1.0)).toBeLessThan(0.01);
    });

    test('handles empty descriptor lists safely', () => {
      expect(averageDescriptors([])).toEqual([]);
      expect(calculateEuclideanDistance(null, null)).toBe(1.0);
    });
  });
});
