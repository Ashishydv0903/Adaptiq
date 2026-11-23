/**
 * @file Roadmap Generator Service
 * Constructs personalized learning roadmaps using topological sort on the skill graph
 * and admin-maintained learning resources, with milestone progression and progress tracking.
 */

import mongoose from 'mongoose';
import { topologicalSortSkills, getAllPrerequisites } from '../skillGraph.js';
import { Resource } from '../../models/Resource.js';
import { sampleResources } from '../../seed/sampleResources.js';
import { comprehensiveSkills } from '../../seed/skillsData.js';

/**
 * Generates a structured learning roadmap for a candidate based on identified skill gaps.
 *
 * Algorithm:
 * 1. Collects all gap skills and their transitive upstream prerequisites.
 * 2. Runs topological sort on the subgraph so prerequisites are learned before dependents.
 * 3. Partitions skills into sequential milestones (Foundations -> Intermediate -> Advanced).
 * 4. Attaches curated admin-maintained resources to each skill.
 *
 * @param {Object} params
 * @param {string} params.candidateId
 * @param {string} params.targetRole
 * @param {Array<Object>} params.skillGaps - Array of gap objects { slug, currentMastery, requiredMastery, gap, priority }
 * @param {number} [params.matchPercentage=65]
 * @returns {Promise<Object>} Structured Roadmap object
 */
export async function generateLearningRoadmap({
  candidateId,
  targetRole = 'Fullstack Engineer',
  skillGaps = [],
  matchPercentage = 65
}) {
  // 1. Gather all gap slugs and their prerequisites
  const gapSlugs = skillGaps.map((g) => g.slug || g.skillId);
  const allNeededSlugsSet = new Set(gapSlugs);

  for (const slug of gapSlugs) {
    const prereqs = getAllPrerequisites(slug);
    for (const p of prereqs) {
      allNeededSlugsSet.add(p);
    }
  }

  const allSlugs = Array.from(allNeededSlugsSet);

  // 2. Topologically sort the skill subgraph
  const orderedSlugs = topologicalSortSkills(allSlugs);

  // 3. Retrieve admin-maintained resources for these skills
  let resources = [];
  if (mongoose.connection.readyState === 1) {
    try {
      resources = await Resource.find({ skillSlug: { $in: orderedSlugs } }).maxTimeMS(2000).catch(() => []);
    } catch (err) {
      resources = [];
    }
  }

  if (!resources || resources.length === 0) {
    resources = sampleResources.filter((r) => orderedSlugs.includes(r.skillSlug));
  }

  const resourcesBySlug = new Map();
  for (const r of resources) {
    const list = resourcesBySlug.get(r.skillSlug) || [];
    list.push({
      title: r.title,
      type: r.type || 'article',
      url: r.url,
      provider: r.provider || 'Official',
      difficulty: r.difficulty || 'Intermediate',
      estimatedHours: r.estimatedHours || 4,
      isCompleted: false
    });
    resourcesBySlug.set(r.skillSlug, list);
  }

  // Fallback resource generator for skills without explicit seeds
  const getResourcesForSkill = (slug, skillName) => {
    const existing = resourcesBySlug.get(slug);
    if (existing && existing.length > 0) return existing;

    return [
      {
        title: `${skillName} Official Documentation & Best Practices`,
        type: 'doc',
        url: `https://devdocs.io/#q=${encodeURIComponent(skillName)}`,
        provider: 'Official Documentation',
        difficulty: 'Intermediate',
        estimatedHours: 4,
        isCompleted: false
      },
      {
        title: `Deep Dive: Mastering ${skillName} in Production`,
        type: 'article',
        url: `https://github.com/topics/${encodeURIComponent(slug)}`,
        provider: 'Engineering Community',
        difficulty: 'Advanced',
        estimatedHours: 6,
        isCompleted: false
      }
    ];
  };

  // 4. Partition ordered skills into 3 progressive milestones
  const totalSkills = orderedSlugs.length;
  const chunkSize = Math.max(1, Math.ceil(totalSkills / 3));

  const phase1Slugs = orderedSlugs.slice(0, chunkSize);
  const phase2Slugs = orderedSlugs.slice(chunkSize, chunkSize * 2);
  const phase3Slugs = orderedSlugs.slice(chunkSize * 2);

  const createMilestone = (title, description, durationWeeks, slugs) => {
    const skillsTargeted = [];
    const milestoneResources = [];

    for (const slug of slugs) {
      const skillObj = comprehensiveSkills.find((s) => s.slug === slug);
      const skillName = skillObj ? skillObj.name : slug;
      skillsTargeted.push(skillName);

      const skillRes = getResourcesForSkill(slug, skillName);
      milestoneResources.push(...skillRes);
    }

    return {
      title,
      description,
      durationWeeks,
      skillsTargeted,
      resources: milestoneResources.slice(0, 5), // Keep top 5 resources per milestone
      isCompleted: false
    };
  };

  const milestones = [];

  if (phase1Slugs.length > 0) {
    milestones.push(
      createMilestone(
        'Milestone 1: Core Foundations & Root Prerequisites',
        'Strengthen prerequisite fundamentals and resolve foundational blockers before moving to advanced architecture.',
        2,
        phase1Slugs
      )
    );
  }

  if (phase2Slugs.length > 0) {
    milestones.push(
      createMilestone(
        'Milestone 2: Intermediate Architectural Competencies',
        'Master core engineering workflows, state boundaries, indexing, and service communication.',
        3,
        phase2Slugs
      )
    );
  }

  if (phase3Slugs.length > 0) {
    milestones.push(
      createMilestone(
        'Milestone 3: High Scale & Production Systems',
        'Synthesize advanced system design, distributed transactions, resilience patterns, and high availability.',
        3,
        phase3Slugs
      )
    );
  }

  return {
    candidateId,
    targetRole,
    matchPercentage: Number(matchPercentage.toFixed(1)),
    skillGaps: skillGaps.map((g) => {
      const skillObj = comprehensiveSkills.find((s) => s.slug === g.slug);
      return {
        skillName: skillObj ? skillObj.name : (g.slug || 'Skill'),
        slug: g.slug,
        currentMastery: Number((g.currentMastery ?? 0).toFixed(2)),
        requiredLevel: Number((g.requiredMastery ?? 0.7).toFixed(2)),
        gap: Number((g.gap ?? 0.3).toFixed(2)),
        priority: g.priority || (g.gap >= 0.4 ? 'Critical' : 'Medium')
      };
    }),
    milestones,
    overallProgress: 0,
    totalEstimatedWeeks: milestones.reduce((sum, m) => sum + m.durationWeeks, 0)
  };
}
