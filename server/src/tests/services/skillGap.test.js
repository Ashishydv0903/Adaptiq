/**
 * @file Unit & Integration Tests for Skill Gap Analysis Services
 * Tests Skill Graph (graphology), Topological Sort, Root-Cause Gap Detection,
 * Resume Parser, Skill Normalization, Claimed-vs-Proven Matrix, JD Analyzer, and Roadmap Generator.
 */

import {
  getSkillGraph,
  buildSkillGraph,
  getDirectPrerequisites,
  getAllPrerequisites,
  topologicalSortSkills,
  detectRootCauseGaps,
  toReactFlowGraph
} from '../../services/skillGraph.js';
import {
  normalizeSkill,
  extractTextFromFileBuffer,
  parseResumeWithLLM,
  buildClaimedVsProvenMatrix
} from '../../services/resume/resumeParser.js';
import {
  parseJobDescription,
  calculateRoleFitScore,
  getTop3SkillGaps,
  generateJDBasedAssessmentPlan
} from '../../services/jd/jdAnalyzer.js';
import { generateLearningRoadmap } from '../../services/roadmap/roadmapGenerator.js';
import { comprehensiveSkills } from '../../seed/skillsData.js';

describe('Skill Gap Analysis & Intelligence Engine', () => {
  // 1. SKILL GRAPH & GRAPHOLOGY TESTS
  describe('Skill Graph Taxonomy & Graphology Operations', () => {
    test('Builds directed graph with 80+ skills and prerequisite edges', () => {
      const graph = getSkillGraph();
      expect(graph.order).toBeGreaterThanOrEqual(80);
      expect(graph.size).toBeGreaterThan(50);
      expect(graph.hasNode('javascript-core')).toBe(true);
      expect(graph.hasNode('react-hooks')).toBe(true);
      expect(graph.hasNode('microservices-architecture')).toBe(true);
    });

    test('getDirectPrerequisites and getAllPrerequisites walk upstream dependencies', () => {
      const direct = getDirectPrerequisites('react-hooks');
      expect(direct).toContain('react-fundamentals');

      const all = getAllPrerequisites('react-hooks');
      expect(all).toContain('react-fundamentals');
      expect(all).toContain('javascript-core');
    });

    test('topologicalSortSkills ensures prerequisites always precede dependent skills', () => {
      const subset = ['microservices-architecture', 'nodejs-runtime', 'rest-api-design', 'javascript-core'];
      const sorted = topologicalSortSkills(subset);

      const jsIdx = sorted.indexOf('javascript-core');
      const nodeIdx = sorted.indexOf('nodejs-runtime');
      const restIdx = sorted.indexOf('rest-api-design');
      const microIdx = sorted.indexOf('microservices-architecture');

      expect(jsIdx).toBeLessThan(nodeIdx);
      expect(nodeIdx).toBeLessThan(restIdx);
      expect(restIdx).toBeLessThan(microIdx);
    });

    test('detectRootCauseGaps identifies foundational root-cause bottlenecks', () => {
      const candidateMasteries = {
        'microservices-architecture': 0.20,
        'rest-api-design': 0.35,
        'nodejs-runtime': 0.25,
        'javascript-core': 0.85
      };

      const result = detectRootCauseGaps('microservices-architecture', candidateMasteries);
      expect(result.isDirectFailure).toBe(false);
      expect(result.rootCauseGaps.length).toBeGreaterThan(0);

      // Deepest missing prerequisite should be nodejs-runtime or rest-api-design
      const deepest = result.rootCauseGaps[0];
      expect(deepest.depth).toBeGreaterThanOrEqual(1);
    });

    test('toReactFlowGraph formats nodes with correct color coding and coordinates', () => {
      const candidateMasteries = {
        'javascript-core': 0.85, // Mastered -> Green (#10B981)
        'react-fundamentals': 0.55, // Developing -> Yellow (#F59E0B)
        'kubernetes-architecture': 0.20 // Gap -> Red (#EF4444)
      };

      const flow = toReactFlowGraph(candidateMasteries, { 'kubernetes-architecture': 0.75 });
      expect(flow.nodes.length).toBeGreaterThanOrEqual(80);
      expect(flow.edges.length).toBeGreaterThan(50);

      const jsNode = flow.nodes.find((n) => n.id === 'javascript-core');
      expect(jsNode.data.status).toBe('mastered');
      expect(jsNode.data.statusColor).toBe('#10B981');

      const reactNode = flow.nodes.find((n) => n.id === 'react-fundamentals');
      expect(reactNode.data.status).toBe('developing');
      expect(reactNode.data.statusColor).toBe('#F59E0B');

      const k8sNode = flow.nodes.find((n) => n.id === 'kubernetes-architecture');
      expect(k8sNode.data.status).toBe('gap');
      expect(k8sNode.data.statusColor).toBe('#EF4444');
    });
  });

  // 2. RESUME PARSER & SKILL NORMALIZATION TESTS
  describe('Resume Parsing & Skill Normalization', () => {
    test('normalizeSkill maps common informal aliases to canonical taxonomy slugs', () => {
      expect(normalizeSkill('React.js')?.slug).toBe('react-fundamentals');
      expect(normalizeSkill('NodeJS')?.slug).toBe('nodejs-runtime');
      expect(normalizeSkill('K8s')?.slug).toBe('kubernetes-architecture');
      expect(normalizeSkill('Docker Compose')?.slug).toBe('docker-multi-stage-compose');
      expect(normalizeSkill('Kafka')?.slug).toBe('message-streaming-kafka');
      expect(normalizeSkill('JWT')?.slug).toBe('authentication-jwt-oauth2');
    });

    test('extractTextFromFileBuffer handles text buffers accurately', async () => {
      const sample = Buffer.from('Senior Fullstack Engineer with 5 years in Node and React');
      const text = await extractTextFromFileBuffer(sample, 'text/plain', 'resume.txt');
      expect(text).toContain('Senior Fullstack Engineer');
    });

    test('buildClaimedVsProvenMatrix correctly audits verified, overclaimed, and latent strengths', () => {
      const claimedSkills = [
        { name: 'JavaScript', level: 'Expert', contextQuote: '5 years JS' },
        { name: 'Microservices', level: 'Expert', contextQuote: 'Built microservices' },
        { name: 'Kafka', level: 'Intermediate', contextQuote: 'Stream events' }
      ];

      const provenMasteries = {
        'javascript-core': 0.90, // Verified (Expert claim 0.90, proven 0.90)
        'microservices-architecture': 0.30, // Overclaimed (Expert claim 0.90, proven 0.30)
        'distributed-caching-redis': 0.85 // Latent Strength (unclaimed on resume, proven 0.85)
      };

      const matrix = buildClaimedVsProvenMatrix(claimedSkills, provenMasteries);

      const jsItem = matrix.find((m) => m.skillSlug === 'javascript-core');
      expect(jsItem.status).toBe('verified');

      const microItem = matrix.find((m) => m.skillSlug === 'microservices-architecture');
      expect(microItem.status).toBe('overclaimed');

      const kafkaItem = matrix.find((m) => m.skillSlug === 'message-streaming-kafka');
      expect(kafkaItem.status).toBe('unverified');

      const redisItem = matrix.find((m) => m.skillSlug === 'distributed-caching-redis');
      expect(redisItem.status).toBe('latent_strength');
    });
  });

  // 3. JD ANALYZER & ASSESSMENT GENERATOR TESTS
  describe('Job Description (JD) Analysis & Role-Fit Scoring', () => {
    test('calculateRoleFitScore computes weighted match percentage and cosine similarity', () => {
      const required = [
        { slug: 'javascript-core', minProficiency: 0.8, weight: 1.2 },
        { slug: 'nodejs-runtime', minProficiency: 0.8, weight: 1.2 },
        { slug: 'react-fundamentals', minProficiency: 0.8, weight: 1.0 }
      ];

      const candidateSkills = {
        'javascript-core': 0.85,
        'nodejs-runtime': 0.80,
        'react-fundamentals': 0.40
      };

      const fit = calculateRoleFitScore(required, candidateSkills);
      expect(fit.roleFitScore).toBeGreaterThan(60);
      expect(fit.roleFitScore).toBeLessThan(100);
      expect(fit.cosineFit).toBeGreaterThan(0.7);
      expect(fit.matchedSkillsCount).toBe(2);
    });

    test('getTop3SkillGaps identifies the 3 highest impact gaps with recommendations', () => {
      const required = [
        { slug: 'javascript-core', minProficiency: 0.8, weight: 1.0, isMandatory: false },
        { slug: 'microservices-architecture', minProficiency: 0.85, weight: 1.3, isMandatory: true },
        { slug: 'distributed-caching-redis', minProficiency: 0.80, weight: 1.2, isMandatory: true },
        { slug: 'kubernetes-architecture', minProficiency: 0.75, weight: 1.1, isMandatory: true }
      ];

      const candidate = {
        'javascript-core': 0.85,
        'microservices-architecture': 0.20,
        'distributed-caching-redis': 0.30,
        'kubernetes-architecture': 0.25
      };

      const topGaps = getTop3SkillGaps(required, candidate);
      expect(topGaps.length).toBe(3);
      expect(topGaps[0].impactScore).toBeGreaterThanOrEqual(topGaps[1].impactScore);
      expect(topGaps[0].recommendation).toBeDefined();
    });

    test('generateJDBasedAssessmentPlan selects questions targeting candidate gaps', () => {
      const mockJD = { track: 'fullstack', roleTitle: 'Senior Fullstack', requiredSkills: [{ slug: 'react-fundamentals' }] };
      const mockQuestions = [
        { _id: 'q1', track: 'fullstack', skillSlug: 'react-fundamentals', title: 'React Hooks' },
        { _id: 'q2', track: 'fullstack', skillSlug: 'nodejs-runtime', title: 'Event Loop' }
      ];
      const topGaps = [{ slug: 'react-fundamentals' }];

      const plan = generateJDBasedAssessmentPlan(mockJD, mockQuestions, topGaps);
      expect(plan.length).toBeGreaterThanOrEqual(1);
      expect(plan[0].title).toBe('React Hooks');
    });
  });

  // 4. ROADMAP GENERATOR TESTS
  describe('Learning Roadmap Generation with Topological Ordering', () => {
    test('generateLearningRoadmap produces sequential milestones with curated resources', async () => {
      const gaps = [
        { slug: 'microservices-architecture', currentMastery: 0.3, requiredMastery: 0.8, gap: 0.5 },
        { slug: 'nodejs-runtime', currentMastery: 0.4, requiredMastery: 0.8, gap: 0.4 }
      ];

      const roadmap = await generateLearningRoadmap({
        candidateId: 'test_candidate_1',
        targetRole: 'Senior Cloud Engineer',
        skillGaps: gaps,
        matchPercentage: 68
      });

      expect(roadmap.milestones.length).toBeGreaterThanOrEqual(2);
      expect(roadmap.totalEstimatedWeeks).toBeGreaterThan(0);
      expect(roadmap.milestones[0].resources.length).toBeGreaterThan(0);

      // Verify foundational skills are in earlier milestone than advanced dependent
      const m1Skills = roadmap.milestones[0].skillsTargeted;
      expect(m1Skills.some((s) => s.toLowerCase().includes('javascript') || s.toLowerCase().includes('node'))).toBe(true);
    });
  });
});
