/**
 * @file aiTextClassifier.js
 * AI-Generated Text Risk Classifier
 * Combines a linguistic burstiness heuristic with an LLM classifier via the existing LLM adapter.
 * IMPORTANT: Strictly labelled as a risk indicator only (not conclusive proof).
 */

import { z } from 'zod';
import { generateStructuredJson } from '../llm/index.js';
import { logger } from '../../config/logger.js';

const aiRiskSchema = z.object({
  isAIGeneratedRisk: z.boolean(),
  aiRiskScore: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  indicators: z.array(z.string()).default([]),
  rationale: z.string().default('')
});

/**
 * Calculates sentence length burstiness (mean, variance, standard deviation)
 * and lexical repetition. AI-generated text typically exhibits very uniform sentence lengths
 * and stereotypical transitional phrases.
 */
export function calculateBurstinessHeuristic(text = '') {
  const clean = text.trim();
  if (clean.length < 50) {
    return {
      burstinessScore: 0.5,
      isUniformCadence: false,
      sentenceCount: 0,
      meanSentenceLength: 0,
      stdDevSentenceLength: 0,
      markersDetected: []
    };
  }

  const sentences = clean.split(/[.!?]+/).map((s) => s.trim()).filter(Boolean);
  const sentenceLengths = sentences.map((s) => s.split(/\s+/).filter(Boolean).length);

  let mean = 0;
  let variance = 0;
  let stdDev = 0;

  if (sentenceLengths.length >= 2) {
    mean = sentenceLengths.reduce((a, b) => a + b, 0) / sentenceLengths.length;
    variance = sentenceLengths.reduce((acc, len) => acc + Math.pow(len - mean, 2), 0) / sentenceLengths.length;
    stdDev = Math.sqrt(variance);
  }

  // Common high-frequency LLM transitional markers
  const lower = clean.toLowerCase();
  const LLM_TRANSITIONS = [
    'in conclusion',
    'furthermore',
    'moreover',
    'delve into',
    'it is important to note',
    'it is worth noting',
    'plays a vital role',
    'a testament to',
    'comprehensive overview',
    'seamlessly integrate'
  ];

  const markersDetected = LLM_TRANSITIONS.filter((marker) => lower.includes(marker));

  // Low burstiness: standard deviation < 3.0 on sentences averaging >= 12 words indicates uniform pacing
  const isUniformCadence = sentenceLengths.length >= 3 && stdDev < 3.2 && mean >= 12;

  // Normalized burstiness index: lower score = more uniform/synthetic, higher score = more varied/natural
  const burstinessScore = sentenceLengths.length >= 3
    ? Number(Math.min(1.0, stdDev / 10).toFixed(3))
    : 0.5;

  return {
    burstinessScore,
    isUniformCadence,
    sentenceCount: sentenceLengths.length,
    meanSentenceLength: Number(mean.toFixed(1)),
    stdDevSentenceLength: Number(stdDev.toFixed(2)),
    markersDetected
  };
}

/**
 * Evaluates candidate text for AI-generated risk using the burstiness heuristic + LLM adapter.
 * All outputs are explicitly marked as a "risk indicator only".
 *
 * @param {string} text - Candidate's written answer
 * @param {string} [questionContext=''] - Interview question prompt
 * @returns {Promise<{ isRiskIndicator: boolean, riskLevel: 'LOW'|'MEDIUM'|'HIGH', riskScore: number, confidence: number, burstiness: Object, rationale: string, disclaimer: string }>}
 */
export async function classifyAITextRisk(text = '', questionContext = '') {
  const burstiness = calculateBurstinessHeuristic(text);

  // If answer is short, skip heavy LLM analysis
  if (text.trim().length < 80) {
    return {
      isRiskIndicator: false,
      riskLevel: 'LOW',
      riskScore: 0.1,
      confidence: 0.9,
      burstiness,
      rationale: 'Text length too brief for reliable stylometric risk classification.',
      disclaimer: 'AI-generated text risk indicator only; not conclusive proof of non-human authorship.'
    };
  }

  const prompt = `You are an impartial academic honesty auditor assessing candidate text for potential AI generation.
Analyze the following interview response for linguistic markers of synthetic/AI generation (e.g. formulaic transitions, low burstiness, synthetic hedging, unnatural structural symmetry).

IMPORTANT: This evaluation is used ONLY as an automated risk indicator to flag for human recruiter review. It is NOT conclusive proof.

QUESTION CONTEXT:
"${questionContext || 'Technical interview question'}"

CANDIDATE'S SUBMITTED ANSWER:
"${text}"

BURSTINESS HEURISTIC METRICS:
- Sentence length std dev: ${burstiness.stdDevSentenceLength}
- Uniform cadence detected: ${burstiness.isUniformCadence}
- Common synthetic transitions detected: ${JSON.stringify(burstiness.markersDetected)}

Evaluate and return ONLY valid JSON matching this schema:
{
  "isAIGeneratedRisk": boolean (true if elevated risk),
  "aiRiskScore": number between 0.0 (strictly human) and 1.0 (highly synthetic),
  "confidence": number between 0.0 and 1.0,
  "indicators": array of string observations,
  "rationale": concise string explanation of the linguistic cues observed
}`;

  try {
    const result = await generateStructuredJson(prompt, aiRiskSchema, { temperature: 0 });
    const llmData = result.data;

    // Combine heuristic burstiness penalty with LLM score
    let blendedRisk = llmData.aiRiskScore;
    if (burstiness.isUniformCadence) {
      blendedRisk = Math.min(1.0, blendedRisk + 0.15);
    }
    if (burstiness.markersDetected.length >= 2) {
      blendedRisk = Math.min(1.0, blendedRisk + 0.15);
    }

    const finalRiskScore = Number(blendedRisk.toFixed(2));
    const isRiskIndicator = finalRiskScore >= 0.65;
    const riskLevel = finalRiskScore >= 0.75 ? 'HIGH' : finalRiskScore >= 0.5 ? 'MEDIUM' : 'LOW';

    return {
      isRiskIndicator,
      riskLevel,
      riskScore: finalRiskScore,
      confidence: llmData.confidence,
      burstiness,
      indicators: llmData.indicators || [],
      rationale: llmData.rationale || 'Linguistic style analysis completed.',
      disclaimer: 'AI-generated text risk indicator only; not conclusive proof of non-human authorship.'
    };
  } catch (error) {
    logger.warn(`AI text classifier fallback: ${error.message}`);
    // Deterministic fallback based on burstiness heuristic
    let fallbackScore = 0.2;
    if (burstiness.isUniformCadence) fallbackScore += 0.35;
    if (burstiness.markersDetected.length >= 2) fallbackScore += 0.3;

    fallbackScore = Number(Math.min(0.95, fallbackScore).toFixed(2));
    const isRiskIndicator = fallbackScore >= 0.65;
    const riskLevel = fallbackScore >= 0.75 ? 'HIGH' : fallbackScore >= 0.5 ? 'MEDIUM' : 'LOW';

    return {
      isRiskIndicator,
      riskLevel,
      riskScore: fallbackScore,
      confidence: 0.75,
      burstiness,
      indicators: burstiness.markersDetected,
      rationale: burstiness.isUniformCadence
        ? 'Uniform sentence lengths and formulaic transitions detected by burstiness heuristic.'
        : 'Natural human sentence variation and pacing observed.',
      disclaimer: 'AI-generated text risk indicator only; not conclusive proof of non-human authorship.'
    };
  }
}

export default {
  calculateBurstinessHeuristic,
  classifyAITextRisk
};
