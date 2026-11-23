/**
 * @file Job Description (JD) Analysis Service
 * Parses JD text with LLM, extracts required skill profiles, computes role-fit scores,
 * identifies top-3 actionable gaps with root-cause insights, and generates JD-targeted assessments.
 */

import { z } from 'zod';
import { generateStructuredJson } from '../llm/index.js';
import { normalizeSkill } from '../resume/resumeParser.js';
import { detectRootCauseGaps } from '../skillGraph.js';
import { calculateCosineSimilarity } from '../../ml/scoringModel.js';
import { comprehensiveSkills } from '../../seed/skillsData.js';
import { env } from '../../config/env.js';

export const JDAnalysisSchema = z.object({
  roleTitle: z.string().default('Software Engineer'),
  company: z.string().default('Tech Company'),
  track: z.enum(['frontend', 'backend', 'fullstack', 'devops', 'datascience']).default('fullstack'),
  experienceLevel: z.enum(['entry', 'mid', 'senior', 'lead']).default('mid'),
  summary: z.string().default(''),
  requiredSkills: z
    .array(
      z.object({
        name: z.string(),
        slug: z.string().optional(),
        minProficiency: z.number().min(0).max(1).default(0.7),
        weight: z.number().default(1.0),
        isMandatory: z.boolean().default(true)
      })
    )
    .default([])
});

/**
 * Heuristic fallback JD parser in case LLM is offline
 */
function getDeterministicJDFallback(jdText) {
  const textLower = jdText.toLowerCase();

  let track = 'fullstack';
  if (textLower.includes('devops') || textLower.includes('sre') || textLower.includes('infrastructure')) track = 'devops';
  else if (textLower.includes('data science') || textLower.includes('machine learning') || textLower.includes('ai engineer')) track = 'datascience';
  else if (textLower.includes('frontend') || textLower.includes('ui engineer')) track = 'frontend';
  else if (textLower.includes('backend') || textLower.includes('api engineer')) track = 'backend';

  const required = [
    { name: 'JavaScript Core Fundamentals', slug: 'javascript-core', minProficiency: 0.8, weight: 1.2, isMandatory: true },
    { name: 'Node.js Runtime & Architecture', slug: 'nodejs-runtime', minProficiency: 0.8, weight: 1.2, isMandatory: true },
    { name: 'React Fundamentals', slug: 'react-fundamentals', minProficiency: 0.75, weight: 1.1, isMandatory: true },
    { name: 'Distributed Caching with Redis', slug: 'distributed-caching-redis', minProficiency: 0.70, weight: 1.0, isMandatory: false },
    { name: 'Microservices Architecture', slug: 'microservices-architecture', minProficiency: 0.75, weight: 1.2, isMandatory: true },
    { name: 'Docker & Containerization Fundamentals', slug: 'docker-containers', minProficiency: 0.70, weight: 1.0, isMandatory: false }
  ];

  return {
    roleTitle: 'Senior Fullstack Software Engineer',
    company: 'Enterprise Cloud Corp',
    track,
    experienceLevel: 'senior',
    summary: 'Role requires deep proficiency in React, Node.js, distributed microservices, and containerized deployments.',
    requiredSkills: required
  };
}

/**
 * Parses and extracts structured requirements from Job Description text using LLM.
 *
 * @param {string} jdText - Job description raw text
 * @returns {Promise<Object>} Structured JD analysis matching JDAnalysisSchema
 */
export async function parseJobDescription(jdText) {
  if (!jdText || jdText.trim().length === 0) {
    return getDeterministicJDFallback('');
  }

  const model = env.GEMINI_MODEL || 'gemini-1.5-flash';
  const fallback = getDeterministicJDFallback(jdText);

  const prompt = `
You are an expert talent architect and job requirement analyzer.
Analyze the following Job Description (JD) text and extract structured technical requirements adhering to the schema.

JOB DESCRIPTION:
"""
${jdText.slice(0, 10000)}
"""

INSTRUCTIONS:
- Identify roleTitle, company, track ('frontend' | 'backend' | 'fullstack' | 'devops' | 'datascience'), and experienceLevel.
- Extract required technical skills. For each skill:
  - assign a realistic minProficiency between 0.40 and 0.95
  - assign weight (1.0 to 1.5 for core competencies)
  - mark isMandatory as true for primary stack requirements.
`;

  try {
    const result = await generateStructuredJson(prompt, JDAnalysisSchema, {
      temperature: 0,
      model,
      fallback
    });

    const parsed = result.data || fallback;

    // Normalize all extracted skills to taxonomy slugs
    parsed.requiredSkills = parsed.requiredSkills.map((req) => {
      const canonical = normalizeSkill(req.name);
      return {
        ...req,
        slug: canonical ? canonical.slug : req.name.toLowerCase().replace(/\s+/g, '-'),
        canonicalName: canonical ? canonical.name : req.name,
        category: canonical ? canonical.category : 'General'
      };
    });

    return parsed;
  } catch (err) {
    return fallback;
  }
}

/**
 * Computes Role-Fit Score between a candidate's proven masteries and JD required skills.
 *
 * Fit Formula:
 * Weighted match = sum(weight_i * min(candidate_i, required_i)) / sum(weight_i * required_i) * 100
 *
 * @param {Array<Object>} requiredSkills - Array of required skills with minProficiency and weight
 * @param {Record<string, number>} candidateMasteryMap - Map of skill slug to candidate mastery [0, 1]
 * @returns {{ roleFitScore: number, cosineFit: number, matchedSkillsCount: number, totalSkillsCount: number }}
 */
export function calculateRoleFitScore(requiredSkills = [], candidateMasteryMap = {}) {
  if (!requiredSkills || requiredSkills.length === 0) {
    return { roleFitScore: 100, cosineFit: 1.0, matchedSkillsCount: 0, totalSkillsCount: 0 };
  }

  let totalRequiredWeight = 0;
  let totalMatchWeight = 0;
  let matchedCount = 0;

  const candidateVector = [];
  const requiredVector = [];

  for (const req of requiredSkills) {
    const slug = req.slug || req.name.toLowerCase().replace(/\s+/g, '-');
    const minProf = req.minProficiency || 0.7;
    const weight = req.weight || 1.0;

    const candMastery = candidateMasteryMap[slug] ?? 0;

    totalRequiredWeight += weight * minProf;
    totalMatchWeight += weight * Math.min(candMastery, minProf);

    if (candMastery >= minProf - 0.1) {
      matchedCount++;
    }

    candidateVector.push(candMastery);
    requiredVector.push(minProf);
  }

  const roleFitScore = totalRequiredWeight > 0
    ? Number(((totalMatchWeight / totalRequiredWeight) * 100).toFixed(1))
    : 100;

  const cosineFit = calculateCosineSimilarity(candidateVector, requiredVector);

  return {
    roleFitScore: Math.min(100, Math.max(0, roleFitScore)),
    cosineFit: Number(cosineFit.toFixed(3)),
    matchedSkillsCount: matchedCount,
    totalSkillsCount: requiredSkills.length
  };
}

/**
 * Identifies the Top-3 highest leverage skill gaps for this JD and performs
 * root-cause analysis on each using prerequisite graph walking.
 *
 * @param {Array<Object>} requiredSkills
 * @param {Record<string, number>} candidateMasteryMap
 * @returns {Array<Object>} Top-3 prioritized skill gap recommendations
 */
export function getTop3SkillGaps(requiredSkills = [], candidateMasteryMap = {}) {
  const gaps = [];

  for (const req of requiredSkills) {
    const slug = req.slug || req.name.toLowerCase().replace(/\s+/g, '-');
    const minProf = req.minProficiency || 0.7;
    const candMastery = candidateMasteryMap[slug] ?? 0;

    if (candMastery < minProf) {
      const gapMagnitude = minProf - candMastery;
      const weight = req.weight || 1.0;
      const mandatoryMultiplier = req.isMandatory ? 1.5 : 1.0;
      const impactScore = gapMagnitude * weight * mandatoryMultiplier;

      // Walk prerequisite graph for root causes
      const rootCauseAnalysis = detectRootCauseGaps(slug, candidateMasteryMap);

      const canonical = comprehensiveSkills.find((s) => s.slug === slug);

      gaps.push({
        slug,
        name: canonical ? canonical.name : req.name,
        category: canonical ? canonical.category : 'General',
        currentMastery: Number(candMastery.toFixed(2)),
        requiredMastery: Number(minProf.toFixed(2)),
        gap: Number(gapMagnitude.toFixed(2)),
        impactScore: Number(impactScore.toFixed(3)),
        isMandatory: req.isMandatory,
        rootCauseGaps: rootCauseAnalysis.rootCauseGaps,
        hasPrerequisiteBlockers: rootCauseAnalysis.rootCauseGaps.length > 0,
        recommendation: rootCauseAnalysis.rootCauseGaps.length > 0
          ? `Focus on foundational prerequisite "${rootCauseAnalysis.rootCauseGaps[0].name}" before tackling ${req.name}.`
          : `Directly practice ${req.name} to close the ${Math.round(gapMagnitude * 100)}% gap.`
      });
    }
  }

  // Sort by impact score descending and take top 3
  gaps.sort((a, b) => b.impactScore - a.impactScore);
  return gaps.slice(0, 3);
}

/**
 * Generates JD-Based Assessment Question Plan
 * Filters and prioritizes questions matching JD requirements and top candidate gaps.
 *
 * @param {Object} jdAnalysis
 * @param {Array<Object>} allQuestionsPool
 * @param {Array<Object>} topGaps
 * @returns {Array<Object>} Prioritized questions for targeted assessment
 */
export function generateJDBasedAssessmentPlan(jdAnalysis, allQuestionsPool = [], topGaps = []) {
  const gapSlugs = new Set(topGaps.map((g) => g.slug));
  const reqSlugs = new Set((jdAnalysis.requiredSkills || []).map((r) => r.slug));

  const questions = [];

  // 1. Pick questions that directly test the top gap skills
  for (const q of allQuestionsPool) {
    const isGapQuestion = q.skills?.some((s) => gapSlugs.has(s.slug || s)) || gapSlugs.has(q.skillSlug);
    if (isGapQuestion && !questions.includes(q)) {
      questions.push({ ...q, priorityReason: 'Targets Top Skill Gap' });
    }
  }

  // 2. Pick questions testing remaining required JD skills
  for (const q of allQuestionsPool) {
    const isRequired = q.skills?.some((s) => reqSlugs.has(s.slug || s)) || reqSlugs.has(q.skillSlug);
    if (isRequired && !questions.some((existing) => existing._id === q._id)) {
      questions.push({ ...q, priorityReason: 'Core JD Requirement' });
    }
  }

  // Fallback to track questions if pool is small
  if (questions.length < 5) {
    const trackQuestions = allQuestionsPool.filter((q) => q.track === jdAnalysis.track);
    for (const q of trackQuestions) {
      if (!questions.some((existing) => existing._id === q._id)) {
        questions.push({ ...q, priorityReason: 'Track Alignment' });
        if (questions.length >= 8) break;
      }
    }
  }

  return questions.slice(0, 8);
}
