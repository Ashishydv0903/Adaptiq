import {
  calculateEvaluationConfidence,
  CONFIDENCE_THRESHOLDS
} from '../../services/scoring/confidenceScorer.js';

describe('Per-Evaluation Confidence Scorer', () => {
  test('Computes HIGH confidence score when rubric variance is low and answer has solid depth', () => {
    const result = calculateEvaluationConfidence({
      rubricVariance: 0.2,
      conceptCoverageRatio: 0.9,
      wordCount: 65,
      semanticSimilarity: 0.88,
      integrityScore: 100,
      isCoding: false
    });

    expect(result.confidenceScore).toBeGreaterThanOrEqual(CONFIDENCE_THRESHOLDS.HIGH);
    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.shouldFlagForHumanReview).toBe(false);
    expect(result.confidencePercentage).toBeGreaterThanOrEqual(85);
  });

  test('Flags evaluation for human review when confidence is low due to high rubric variance and sparse response', () => {
    const result = calculateEvaluationConfidence({
      rubricVariance: 4.5, // High disagreement among LLM rubric runs
      conceptCoverageRatio: 0.4,
      wordCount: 8, // Very sparse
      semanticSimilarity: 0.5,
      integrityScore: 90,
      isCoding: false
    });

    expect(result.confidenceScore).toBeLessThan(CONFIDENCE_THRESHOLDS.HUMAN_REVIEW_TRIGGER);
    expect(result.confidenceLevel).toBe('LOW');
    expect(result.shouldFlagForHumanReview).toBe(true);
    expect(result.flagReason).toContain('Low AI evaluation certainty');
  });

  test('Grants very high confidence for deterministic coding test executions when integrity is clean', () => {
    const result = calculateEvaluationConfidence({
      isCoding: true,
      integrityScore: 100
    });

    expect(result.confidenceScore).toBe(0.95);
    expect(result.confidenceLevel).toBe('HIGH');
    expect(result.shouldFlagForHumanReview).toBe(false);
  });

  test('Flags evaluation for human review if integrity proctoring score drops below 75 regardless of answer', () => {
    const result = calculateEvaluationConfidence({
      rubricVariance: 0.1,
      conceptCoverageRatio: 1.0,
      wordCount: 100,
      integrityScore: 65, // Compromised integrity
      isCoding: false
    });

    expect(result.shouldFlagForHumanReview).toBe(true);
    expect(result.flagReason).toContain('Integrity proctoring score dropped');
  });
});