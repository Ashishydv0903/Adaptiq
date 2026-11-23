import { z } from 'zod';
import { generateEmbedding, generateStructuredJson, PROMPT_VERSIONS } from '../llm/index.js';
import { calculateCosineSimilarity } from '../../ml/scoringModel.js';
import { verifyQuoteInAnswer } from './rubricScorer.js';
import { env } from '../../config/env.js';

export const CONCEPT_PROMPT_VERSION = PROMPT_VERSIONS.CONCEPT_COVERAGE;

export const ConceptItemSchema = z.object({
  concept: z.string(),
  status: z.enum(['covered', 'partially_covered', 'missing']),
  evidenceQuote: z.string().default(''),
  explanation: z.string()
});

export const ConceptCoverageResultSchema = z.object({
  concepts: z.array(ConceptItemSchema)
});

/**
 * Builds prompt for LLM concept verification
 */
function buildConceptPrompt({ question, candidateAnswer, concepts }) {
  const conceptsListStr = concepts.map((c, i) => `${i + 1}. ${c}`).join('\n');

  return `
You are an expert technical interviewer analyzing concept coverage in AdaptIQ.
Prompt Version: ${CONCEPT_PROMPT_VERSION}

QUESTION:
${question.title || ''}
${question.prompt}

EXPECTED KEY CONCEPTS:
${conceptsListStr}

CANDIDATE'S SUBMITTED ANSWER:
"${candidateAnswer}"

TASK:
For each of the expected key concepts listed above, determine whether the candidate addressed it:
- status: "covered" (clearly explained with correct principles), "partially_covered" (mentioned or implied without depth), or "missing" (omitted or incorrect).
- evidenceQuote: If covered or partially covered, provide an exact verbatim quote from the candidate's answer supporting your judgment. If missing, provide "".
- explanation: A concise 1-2 sentence explanation of your decision.

CRITICAL REQUIREMENT:
evidenceQuote MUST be an exact verbatim substring from the candidate's answer. Do not hallucinate or rewrite quotes.

Return pure JSON matching this schema:
{
  "concepts": [
    {
      "concept": "Concept Name",
      "status": "covered" | "partially_covered" | "missing",
      "evidenceQuote": "verbatim quote or empty",
      "explanation": "explanation"
    }
  ]
}
`;
}

/**
 * Detects concept coverage using embedding similarity + LLM confirmation
 *
 * @param {Object} params
 * @param {Object} params.question - Question with keyConcepts and idealAnswer
 * @param {string} params.candidateAnswer - Candidate's written answer
 * @returns {Promise<Object>} Detailed concept coverage breakdown
 */
export async function detectConceptCoverage({ question, candidateAnswer }) {
  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const keyConcepts = question.keyConcepts && question.keyConcepts.length > 0
    ? question.keyConcepts
    : ['Core Architecture', 'Best Practices', 'Edge Case Handling'];

  // Step 1: Compute embedding vectors
  const candidateEmbedding = await generateEmbedding(candidateAnswer);
  const idealEmbedding = question.idealAnswer
    ? await generateEmbedding(question.idealAnswer)
    : candidateEmbedding;

  const semanticSimilarityToIdeal = calculateCosineSimilarity(candidateEmbedding, idealEmbedding);

  // Concept-specific embedding similarities
  const conceptEmbeddings = await Promise.all(
    keyConcepts.map(async (concept) => {
      const emb = await generateEmbedding(concept);
      const similarity = calculateCosineSimilarity(candidateEmbedding, emb);
      return { concept, similarity };
    })
  );

  const similarityMap = new Map();
  for (const item of conceptEmbeddings) {
    similarityMap.set(item.concept, item.similarity);
  }

  // Step 2: LLM Confirmation Pass (temperature 0, strict JSON)
  const prompt = buildConceptPrompt({
    question,
    candidateAnswer,
    concepts: keyConcepts
  });

  const fallbackConcepts = keyConcepts.map((concept) => {
    const candidateLower = candidateAnswer.toLowerCase();
    const conceptWords = concept.toLowerCase().split(/\W+/).filter((w) => w.length > 3);
    const isExact = candidateLower.includes(concept.toLowerCase());
    const isWordMentioned = conceptWords.some((w) => candidateLower.includes(w));
    const sim = similarityMap.get(concept) || 0.5;

    const status = isExact ? 'covered' : (isWordMentioned || sim > 0.45) ? 'partially_covered' : 'missing';
    return {
      concept,
      status,
      evidenceQuote: isExact ? concept : '',
      explanation: isExact
        ? `Directly referenced in answer text.`
        : isWordMentioned
          ? `Partially addressed in response.`
          : `Evaluated via semantic vector distance (similarity: ${sim.toFixed(2)}).`
    };
  });

  const llmResponse = await generateStructuredJson(prompt, ConceptCoverageResultSchema, {
    temperature: 0,
    model,
    fallback: { concepts: fallbackConcepts }
  });

  const rawConceptResults = llmResponse.data?.concepts || fallbackConcepts;

  // Step 3: Verify quotes and merge with embedding similarity
  let coveredCount = 0;
  let partiallyCoveredCount = 0;
  let missingCount = 0;

  const processedConcepts = rawConceptResults.map((item) => {
    const embeddingSim = similarityMap.get(item.concept) ?? 0.5;
    const hasQuote = Boolean(item.evidenceQuote && item.evidenceQuote.trim().length > 0);
    const isQuoteVerified = hasQuote ? verifyQuoteInAnswer(item.evidenceQuote, candidateAnswer) : false;

    if (item.status === 'covered') {
      coveredCount++;
    } else if (item.status === 'partially_covered') {
      partiallyCoveredCount++;
    } else {
      missingCount++;
    }

    return {
      concept: item.concept,
      status: item.status,
      evidenceQuote: item.evidenceQuote,
      isQuoteVerified,
      explanation: item.explanation,
      similarityScore: Number(embeddingSim.toFixed(3))
    };
  });

  // Calculate concept coverage ratio [0, 1]
  const totalConcepts = processedConcepts.length;
  const coverageRatio = totalConcepts > 0
    ? Number(((coveredCount * 1.0 + partiallyCoveredCount * 0.5) / totalConcepts).toFixed(3))
    : 0.5;

  return {
    concepts: processedConcepts,
    coverageRatio,
    coveredCount,
    partiallyCoveredCount,
    missingCount,
    totalConcepts,
    semanticSimilarity: Number(semanticSimilarityToIdeal.toFixed(3)),
    promptVersion: CONCEPT_PROMPT_VERSION,
    model
  };
}

export default {
  detectConceptCoverage,
  CONCEPT_PROMPT_VERSION
};
