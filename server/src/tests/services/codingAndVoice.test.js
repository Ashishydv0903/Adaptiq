/**
 * @file Unit & Integration Tests for Coding Round & Voice Mode Services
 * Tests Judge0 execution, hidden test cases, 3-level costed hints, LLM code review,
 * Whisper transcription, speech delivery metrics (WPM, filler words, pause ratio).
 */

import {
  normalizeLanguage,
  executeJudge0Submission,
  executeAllTestCases
} from '../../services/judge0/judge0Service.js';
import {
  getSanitizedHintLadder,
  unlockHintLevel,
  DEFAULT_HINT_PENALTIES
} from '../../services/scoring/hintLadder.js';
import { reviewCodeWithLLM } from '../../services/scoring/codeReviewer.js';
import { calculateSpeechMetrics, STANDARD_FILLER_WORDS } from '../../services/speech/speechMetrics.js';
import { transcribeAudioBuffer } from '../../services/speech/whisperService.js';

describe('Coding Round & Voice Mode Engine', () => {
  // 1. JUDGE0 EXECUTION & TEST CASES
  describe('Judge0 Multi-Language Execution & Test Cases', () => {
    test('normalizeLanguage maps language aliases correctly', () => {
      expect(normalizeLanguage('js')).toBe('javascript');
      expect(normalizeLanguage('py')).toBe('python');
      expect(normalizeLanguage('c++')).toBe('cpp');
      expect(normalizeLanguage('java')).toBe('java');
    });

    test('executeJudge0Submission runs JavaScript code and captures stdout & runtime', async () => {
      const code = `
        function solution(a, b) {
          return a + b;
        }
      `;
      const res = await executeJudge0Submission({
        sourceCode: code,
        language: 'javascript',
        stdin: '[4, 6]',
        expectedOutput: '10'
      });

      expect(res.success).toBe(true);
      expect(res.passed).toBe(true);
      expect(res.stdout).toBe('10');
      expect(res.executionTimeMs).toBeGreaterThan(0);
      expect(res.memoryKb).toBeGreaterThan(0);
    });

    test('executeAllTestCases evaluates visible test cases in sample run', async () => {
      const code = `
        function solution(nums) {
          return nums.length;
        }
      `;
      const testCases = [
        { input: '[1, 2, 3]', expectedOutput: '3', isHidden: false },
        { input: '[]', expectedOutput: '0', isHidden: false },
        { input: '[1, 2, 3, 4, 5]', expectedOutput: '5', isHidden: true }
      ];

      const res = await executeAllTestCases({
        sourceCode: code,
        language: 'javascript',
        testCases,
        isSubmission: false // visible only
      });

      expect(res.totalCount).toBe(2);
      expect(res.passedCount).toBe(2);
      expect(res.allPassed).toBe(true);
      expect(res.results.every((r) => !r.isHidden)).toBe(true);
    });

    test('executeAllTestCases evaluates hidden test cases on submission and redacts hidden inputs/outputs', async () => {
      const code = `
        function solution(x) {
          return x * 2;
        }
      `;
      const testCases = [
        { input: '5', expectedOutput: '10', isHidden: false },
        { input: '100', expectedOutput: '200', isHidden: true }
      ];

      const res = await executeAllTestCases({
        sourceCode: code,
        language: 'javascript',
        testCases,
        isSubmission: true // all test cases
      });

      expect(res.totalCount).toBe(2);
      expect(res.passedCount).toBe(2);
      expect(res.allPassed).toBe(true);

      const hiddenResult = res.results.find((r) => r.isHidden);
      expect(hiddenResult.input).toBe('[Hidden Test Case]');
      expect(hiddenResult.expectedOutput).toBe('[Hidden Test Case]');
      expect(hiddenResult.passed).toBe(true);
    });
  });

  // 2. 3-LEVEL COSTED HINT LADDER
  describe('3-Level Costed Hint Ladder', () => {
    const mockQuestion = {
      title: 'Two Sum',
      hints: [
        { level: 1, penaltyPoints: 2, hintText: 'Use a hash map' },
        { level: 2, penaltyPoints: 5, hintText: 'Store complements target - nums[i]' },
        { level: 3, penaltyPoints: 10, hintText: 'Map lookup is O(1)' }
      ]
    };

    test('getSanitizedHintLadder redacts locked hint text', () => {
      const sanitized = getSanitizedHintLadder(mockQuestion, [{ level: 1, penaltyPoints: 2 }]);
      expect(sanitized.length).toBe(3);

      // Level 1 is unlocked
      expect(sanitized[0].isUnlocked).toBe(true);
      expect(sanitized[0].hintText).toBe('Use a hash map');

      // Level 2 is locked
      expect(sanitized[1].isUnlocked).toBe(false);
      expect(sanitized[1].hintText).toBeNull();
      expect(sanitized[1].penaltyPoints).toBe(5);
    });

    test('unlockHintLevel unlocks levels and accumulates penalty points', () => {
      const unlock1 = unlockHintLevel({
        question: mockQuestion,
        unlockedHints: [],
        requestedLevel: 1
      });

      expect(unlock1.unlockedHint.level).toBe(1);
      expect(unlock1.totalPenaltyPoints).toBe(2);
      expect(unlock1.unlockedHint.hintText).toBe('Use a hash map');

      const unlock2 = unlockHintLevel({
        question: mockQuestion,
        unlockedHints: unlock1.updatedUnlockedList,
        requestedLevel: 2
      });

      expect(unlock2.unlockedHint.level).toBe(2);
      expect(unlock2.totalPenaltyPoints).toBe(7); // 2 + 5 = 7
    });

    test('Rejects invalid hint levels', () => {
      expect(() =>
        unlockHintLevel({ question: mockQuestion, unlockedHints: [], requestedLevel: 5 })
      ).toThrow();
    });
  });

  // 3. LLM CODE REVIEW
  describe('LLM Code Reviewer', () => {
    test('Evaluates code solution for readability, edge cases, and complexity', async () => {
      const sampleCode = `
        function twoSum(nums, target) {
          const map = new Map();
          for (let i = 0; i < nums.length; i++) {
            const comp = target - nums[i];
            if (map.has(comp)) return [map.get(comp), i];
            map.set(nums[i], i);
          }
          return [];
        }
      `;

      const review = await reviewCodeWithLLM({
        question: { title: 'Two Sum', prompt: 'Find indices of two numbers' },
        sourceCode: sampleCode,
        language: 'javascript'
      });

      expect(review.readability.score).toBeGreaterThanOrEqual(6);
      expect(review.edgeCases.score).toBeGreaterThanOrEqual(6);
      expect(review.complexity.timeComplexity).toBeDefined();
      expect(review.complexity.spaceComplexity).toBeDefined();
      expect(review.overallCodeScore).toBeGreaterThanOrEqual(60);
    });
  });

  // 4. VOICE MODE & SPEECH METRICS
  describe('Voice Mode & Speech Delivery Metrics', () => {
    test('calculateSpeechMetrics computes WPM, filler word count, and pause ratio', () => {
      // 150 words in 1 minute (60 seconds) with intentional fillers
      const text =
        'In our microservices system, um, we basically had to, you know, optimize our distributed Redis caching. Um, actually, we reduced query latency by 45 percent and, like, improved our throughput under peak load.';
      const res = calculateSpeechMetrics({
        transcript: text,
        durationSeconds: 15
      });

      expect(res.wpm).toBeGreaterThan(80);
      expect(res.wpmRating).toBeDefined();
      expect(res.fillerCount).toBeGreaterThanOrEqual(3);
      expect(res.fillerRatio).toBeGreaterThan(0);
      expect(res.pauseRatio).toBeGreaterThan(0);
      expect(res.deliveryScore).toBeGreaterThan(0);
      expect(res.coachingTips.length).toBeGreaterThan(0);
    });

    test('transcribeAudioBuffer handles audio buffer with deterministic fallback', async () => {
      const mockAudio = Buffer.from('mock_audio_data_stream_recording_bytes_12345');
      const transcription = await transcribeAudioBuffer({
        audioBuffer: mockAudio,
        mimetype: 'audio/webm',
        filename: 'answer.webm',
        clientDurationSeconds: 45
      });

      expect(transcription.transcript.length).toBeGreaterThan(20);
      expect(transcription.durationSeconds).toBeGreaterThan(0);
      expect(transcription.language).toBe('english');
    });
  });
});
