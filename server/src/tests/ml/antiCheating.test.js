import {
  detectTypingAnomaly,
  calculateAITextRisk,
  calculateSessionIntegrityScore,
  REVIEW_THRESHOLD
} from '../../ml/integrityEngine.js';

describe('Anti-Cheating & Integrity Proctoring Engine', () => {
  describe('detectTypingAnomaly', () => {
    test('Flags superhuman typing velocity (> 190 WPM) as potential automated paste', () => {
      // 100 words in 10 seconds = 600 WPM
      const longText = 'This is an example text for the adaptive platform '.repeat(10);
      const result = detectTypingAnomaly({
        text: longText,
        durationSeconds: 10,
        keystrokeCount: 500,
        pasteCount: 0
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.calculatedWpm).toBeGreaterThan(190);
      expect(result.reason).toContain('Inhuman typing speed');
    });

    test('Flags severe character to physical keystroke disparity', () => {
      const text = 'A detailed architecture with Redis pub sub, MongoDB sharding, and Kafka streaming pipelines.';
      // 94 chars from only 5 keystrokes
      const result = detectTypingAnomaly({
        text,
        durationSeconds: 30,
        keystrokeCount: 5,
        pasteCount: 1
      });

      expect(result.isAnomaly).toBe(true);
      expect(result.riskLevel).toBe('HIGH');
      expect(result.reason).toContain('Severe keystroke disparity');
    });

    test('Permits natural human typing cadence within normal distribution', () => {
      const text = 'I solved this problem using a hash map to achieve linear O(N) time complexity.';
      // 14 words in 20 seconds = 42 WPM, 78 chars with 75 keystrokes
      const result = detectTypingAnomaly({
        text,
        durationSeconds: 20,
        keystrokeCount: 75,
        pasteCount: 0
      });

      expect(result.isAnomaly).toBe(false);
      expect(result.riskLevel).toBe('LOW');
      expect(result.calculatedWpm).toBeLessThan(100);
    });
  });

  describe('calculateAITextRisk', () => {
    test('Identifies characteristic LLM transitional markers and uniform sentence cadence', () => {
      const aiText =
        'It is important to note that microservices provide significant scalability. ' +
        'Furthermore, they play a vital role in ensuring system resilience across clusters. ' +
        'Moreover, adopting containerization serves as a testament to modern cloud engineering. ' +
        'In conclusion, we can delve into the metrics to seamlessly integrate distributed tracing.';

      const result = calculateAITextRisk(aiText);

      expect(result.aiProbability).toBeGreaterThan(0.60);
      expect(result.detectedPatterns.length).toBeGreaterThanOrEqual(3);
      expect(result.isFlagged).toBe(true);
    });

    test('Recognizes normal concise developer prose as low AI risk', () => {
      const devText =
        'To fix the memory leak, I removed the dangling event listener in componentWillUnmount. ' +
        'Then I inspected heap dumps using Chrome DevTools memory profiler. Everything looked stable after that.';

      const result = calculateAITextRisk(devText);

      expect(result.aiProbability).toBeLessThan(0.40);
      expect(result.riskLevel).toBe('LOW');
      expect(result.isFlagged).toBe(false);
    });
  });

  describe('calculateSessionIntegrityScore', () => {
    test('Applies weighted penalties and deducts score accurately across event timeline', () => {
      const events = [
        { eventType: 'tab_switch', timestamp: new Date() }, // -2
        { eventType: 'tab_switch', timestamp: new Date() }, // -5
        { eventType: 'fullscreen_exit', timestamp: new Date() }, // -5
        { eventType: 'paste', metadata: { charCount: 150 }, timestamp: new Date() } // -8
      ];

      const result = calculateSessionIntegrityScore(events, 100);

      // 100 - 2 - 5 - 5 - 8 = 80
      expect(result.finalScore).toBe(80);
      expect(result.totalDeductions).toBe(20);
      expect(result.timeline.length).toBe(4);
      expect(result.isFlaggedForReview).toBe(false);
    });

    test('Automatically flags session for human review when integrity score drops below 75 or has critical AI detection', () => {
      const events = [
        { eventType: 'tab_switch' }, // -2
        { eventType: 'tab_switch' }, // -5
        { eventType: 'paste_anomaly', metadata: { charCount: 200 } }, // -8
        { eventType: 'ai_text_risk_indicator', metadata: { aiProbability: 0.85 } } // -15
      ];

      const result = calculateSessionIntegrityScore(events, 100);

      // 100 - 2 - 5 - 8 - 15 = 70 (< 75)
      expect(result.finalScore).toBeLessThan(REVIEW_THRESHOLD);
      expect(result.isFlaggedForReview).toBe(true);
      expect(result.primaryFlagReason).toBeTruthy();
    });
  });
});