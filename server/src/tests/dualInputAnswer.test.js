import { calculateSpeechMetrics, STANDARD_FILLER_WORDS } from '../services/speech/speechMetrics.js';
import { transcribeAudioBuffer } from '../services/speech/whisperService.js';
import { executeScoringPipeline } from '../services/scoring/index.js';

describe('Dual-Input Answer Component & Speech Metrics Suite', () => {
  describe('Speech Metrics Calculation', () => {
    test('computes WPM, filler words, and pause ratio for standard English delivery', () => {
      const transcript =
        'In our architecture we like deployed Redis because um it gave us sub millisecond latency actually.';
      const metrics = calculateSpeechMetrics({
        transcript,
        durationSeconds: 12
      });

      expect(metrics.wordCount).toBe(16);
      expect(metrics.wpm).toBeGreaterThan(0);
      expect(metrics.fillerCount).toBeGreaterThanOrEqual(3); // 'like', 'um', 'actually'
      expect(metrics.fillerBreakdown.like).toBe(1);
      expect(metrics.fillerBreakdown.um).toBe(1);
      expect(metrics.fillerBreakdown.actually).toBe(1);
      expect(metrics.pauseRatio).toBeGreaterThan(0);
      expect(metrics.deliveryScore).toBeDefined();
    });

    test('detects Hindi and Hinglish filler words (matlab, yaani, achha, bhai, toh)', () => {
      const hinglishTranscript =
        'Hamne caching implement kiya matlab Redis use kiya and yaani response time bahut improve hua bhai, toh latency drop ho gayi.';
      const metrics = calculateSpeechMetrics({
        transcript: hinglishTranscript,
        durationSeconds: 15
      });

      expect(metrics.fillerBreakdown.matlab).toBe(1);
      expect(metrics.fillerBreakdown.yaani).toBe(1);
      expect(metrics.fillerBreakdown.bhai).toBe(1);
      expect(metrics.fillerBreakdown.toh).toBe(1);
      expect(metrics.fillerCount).toBeGreaterThanOrEqual(4);
    });

    test('standard filler word dictionary includes both English and Hindi/Hinglish idioms', () => {
      expect(STANDARD_FILLER_WORDS).toContain('um');
      expect(STANDARD_FILLER_WORDS).toContain('like');
      expect(STANDARD_FILLER_WORDS).toContain('matlab');
      expect(STANDARD_FILLER_WORDS).toContain('yaani');
      expect(STANDARD_FILLER_WORDS).toContain('achha');
    });

    test('handles clean delivery with zero fillers and optimal pacing', () => {
      const crispTranscript =
        'We decoupled the event stream using Apache Kafka with three distributed partitions and consumer groups.';
      const metrics = calculateSpeechMetrics({
        transcript: crispTranscript,
        durationSeconds: 6
      });

      expect(metrics.fillerCount).toBe(0);
      expect(metrics.fillerRatio).toBe(0);
      expect(metrics.deliveryScore).toBeGreaterThanOrEqual(80);
      expect(metrics.coachingTips[0]).toContain('Exceptional');
    });
  });

  describe('Whisper Transcription Service', () => {
    test('transcribeAudioBuffer returns transcript with confidence and language metadata', async () => {
      const dummyBuffer = Buffer.from('RIFF....WAVEfmt ....data....');
      const result = await transcribeAudioBuffer({
        audioBuffer: dummyBuffer,
        mimetype: 'audio/webm',
        filename: 'answer_clip.webm',
        clientDurationSeconds: 18
      });

      expect(result.transcript).toBeDefined();
      expect(typeof result.transcript).toBe('string');
      expect(result.transcript.length).toBeGreaterThan(0);
      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0.5);
      expect(result.language).toBeDefined();
      expect(result.durationSeconds).toBeGreaterThan(0);
    });

    test('handles empty audio buffer gracefully', async () => {
      const emptyResult = await transcribeAudioBuffer({ audioBuffer: null });
      expect(emptyResult.transcript).toBe('');
      expect(emptyResult.durationSeconds).toBe(0);
      expect(emptyResult.confidence).toBe(1.0);
    });
  });

  describe('Content Scoring Equality & Dual-Input Evaluation', () => {
    const mockQuestion = {
      _id: 'q123',
      title: 'Distributed Cache Invalidation',
      roundType: 'technical',
      keyConcepts: ['cache-aside', 'TTL', 'eventual consistency', 'Redis'],
      sampleAnswer:
        'We implement a cache-aside pattern with TTL expiration and publish invalidation messages on Redis pub/sub.'
    };

    const identicalText =
      'We implemented a cache-aside pattern with TTL expiration and publish invalidation messages over Redis pub/sub.';

    test('scoring pipeline produces identical content score whether submitted via typing or voice', async () => {
      // 1. Simulating Type Mode (no speech telemetry)
      const typedScoring = await executeScoringPipeline({
        question: mockQuestion,
        candidateAnswer: identicalText,
        telemetry: {}
      });

      // 2. Simulating Speak / Hybrid Mode (with speech telemetry)
      const spokenScoring = await executeScoringPipeline({
        question: mockQuestion,
        candidateAnswer: identicalText,
        telemetry: {
          wpm: 145,
          fillerRatio: 2.1,
          pauseRatio: 0.18
        }
      });

      // Content rubric and concept coverage must match identically
      expect(typedScoring.score).toBe(spokenScoring.score);
      expect(typedScoring.conceptCoverage.coverageRatio).toBe(spokenScoring.conceptCoverage.coverageRatio);
    });

    test('scores optional spoken explanation for coding questions separately', async () => {
      const codingQuestion = {
        _id: 'code123',
        title: 'Two Sum Problem',
        roundType: 'coding',
        keyConcepts: ['hash map', 'time complexity O(n)', 'complement']
      };

      const spokenExplanationText =
        'I used a hash map to store the complement of each number. This achieves O(n) time complexity and O(n) space.';

      const explanationScoring = await executeScoringPipeline({
        question: codingQuestion,
        candidateAnswer: spokenExplanationText,
        telemetry: { wpm: 140 }
      });

      expect(explanationScoring.score).toBeGreaterThan(0);
      expect(explanationScoring.conceptCoverage.coverageRatio).toBeGreaterThan(0);
    });
  });
});
