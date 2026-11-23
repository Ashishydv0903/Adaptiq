/**
 * @file LLM Code Review Service
 * Evaluates candidate code solutions across readability, edge cases,
 * time/space algorithmic complexity, and generates actionable optimization suggestions.
 */

import { z } from 'zod';
import { generateStructuredJson } from '../llm/index.js';
import { env } from '../../config/env.js';

export const CodeReviewSchema = z.object({
  readability: z.object({
    score: z.number().min(0).max(10).default(8),
    feedback: z.string().default('Clean and readable variable naming.')
  }),
  edgeCases: z.object({
    score: z.number().min(0).max(10).default(8),
    feedback: z.string().default('Handles empty and boundary inputs appropriately.')
  }),
  complexity: z.object({
    timeComplexity: z.string().default('O(N)'),
    spaceComplexity: z.string().default('O(1)'),
    analysis: z.string().default('Single pass iteration with constant auxiliary space.')
  }),
  overallCodeScore: z.number().min(0).max(100).default(82),
  optimizationSuggestions: z.array(z.string()).default([])
});

/**
 * Deterministic local fallback code review when LLM is offline or in test mode.
 */
function getDeterministicCodeReviewFallback(code = '', language = 'javascript') {
  const codeLen = code.trim().length;
  const hasNestedLoops = code.includes('for') && (code.match(/for\s*\(/g) || []).length >= 2;
  const hasMapOrSet = code.includes('Map') || code.includes('Set') || code.includes('dict') || code.includes('HashMap');

  const timeComplexity = hasNestedLoops ? 'O(N^2)' : 'O(N)';
  const spaceComplexity = hasMapOrSet ? 'O(N)' : 'O(1)';

  return {
    readability: {
      score: codeLen > 50 ? 8.5 : 7.0,
      feedback: 'Your code is clean, well-formatted, and easy to follow.'
    },
    edgeCases: {
      score: code.includes('length === 0') || code.includes('!nums') || code.includes('null') ? 8.5 : 7.0,
      feedback: 'Good handling of main inputs. Remember to check for empty or null inputs.'
    },
    complexity: {
      timeComplexity,
      spaceComplexity,
      analysis: hasNestedLoops
        ? 'Nested loops mean this will slow down on very large inputs (O(N^2)).'
        : 'Single pass solution (O(N)). Runs quickly and efficiently.'
    },
    overallCodeScore: hasNestedLoops ? 75 : 88,
    optimizationSuggestions: hasNestedLoops
      ? ['Try using an object/dictionary or Set to avoid nested loops and speed up the code.']
      : ['Great solution! Code is optimal and handles the requirements cleanly.']
  };
}

/**
 * Evaluates candidate code using LLM.
 *
 * @param {Object} params
 * @param {Object} params.question - Coding question metadata
 * @param {string} params.sourceCode - Candidate submitted code
 * @param {string} [params.language='javascript']
 * @returns {Promise<Object>} Code review analysis
 */
export async function reviewCodeWithLLM({ question, sourceCode, language = 'javascript' }) {
  if (!sourceCode || sourceCode.trim().length === 0) {
    return getDeterministicCodeReviewFallback('', language);
  }

  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const fallback = getDeterministicCodeReviewFallback(sourceCode, language);

  const prompt = `
You are a Staff Software Engineer and algorithms bar-raiser conducting an automated code review.
Analyze the following candidate code solution for:
1. Readability & Code Style (0-10): variable naming, function modularity, idiomatic patterns.
2. Edge Cases (0-10): null/empty checks, boundary values, duplicate entries, extreme inputs.
3. Algorithmic Complexity: exact Big-O Time Complexity (e.g. O(N), O(N log N)), Space Complexity (e.g. O(1), O(N)), and detailed analysis.
4. Actionable optimization suggestions.

PROBLEM:
${question?.title || 'Coding Problem'}
${question?.prompt || ''}

CANDIDATE CODE (${language}):
"""
${sourceCode.slice(0, 5000)}
"""
`;

  try {
    const result = await generateStructuredJson(prompt, CodeReviewSchema, {
      temperature: 0,
      model,
      fallback
    });
    return result.data || fallback;
  } catch (err) {
    return fallback;
  }
}
