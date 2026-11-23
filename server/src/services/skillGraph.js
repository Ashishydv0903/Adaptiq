/**
 * @file Skill Graph Service using Graphology
 * Manages the 80+ skill prerequisite DAG, topological sorting, prerequisite traversal,
 * root-cause gap detection, and React Flow graph formatting.
 */

import Graphology from 'graphology';
const DirectedGraph = Graphology.DirectedGraph || Graphology.default?.DirectedGraph || Graphology;
import { comprehensiveSkills } from '../seed/skillsData.js';

let graphInstance = null;

/**
 * Initializes and populates the Graphology directed graph from the skill taxonomy.
 *
 * @param {Array<Object>} [skillsData] - Optional custom skills dataset (defaults to comprehensiveSkills)
 * @returns {DirectedGraph} Populated directed graph instance
 */
export function buildSkillGraph(skillsData = comprehensiveSkills) {
  const graph = new DirectedGraph();

  // 1. Add all skills as nodes
  for (const skill of skillsData) {
    if (!graph.hasNode(skill.slug)) {
      graph.addNode(skill.slug, {
        name: skill.name,
        slug: skill.slug,
        category: skill.category,
        description: skill.description,
        weight: skill.weight || 1.0,
        prerequisites: skill.prerequisites || []
      });
    }
  }

  // 2. Add prerequisite directed edges: prereq -> dependent
  for (const skill of skillsData) {
    if (skill.prerequisites && Array.isArray(skill.prerequisites)) {
      for (const prereqSlug of skill.prerequisites) {
        if (graph.hasNode(prereqSlug) && graph.hasNode(skill.slug)) {
          if (!graph.hasEdge(prereqSlug, skill.slug)) {
            graph.addDirectedEdge(prereqSlug, skill.slug, {
              relationship: 'prerequisite_of'
            });
          }
        }
      }
    }
  }

  graphInstance = graph;
  return graph;
}

/**
 * Returns the singleton graph instance (builds if not yet initialized)
 *
 * @returns {DirectedGraph}
 */
export function getSkillGraph() {
  if (!graphInstance) {
    graphInstance = buildSkillGraph();
  }
  return graphInstance;
}

/**
 * Retrieves direct prerequisites for a given skill slug (in-neighbors)
 *
 * @param {string} skillSlug
 * @returns {string[]} Array of prerequisite skill slugs
 */
export function getDirectPrerequisites(skillSlug) {
  const graph = getSkillGraph();
  if (!graph.hasNode(skillSlug)) return [];
  return graph.inNeighbors(skillSlug);
}

/**
 * Walks prerequisites backward recursively to discover all upstream dependencies.
 *
 * @param {string} skillSlug
 * @param {Set<string>} [visited]
 * @returns {string[]} All transitive prerequisites (closest to furthest)
 */
export function getAllPrerequisites(skillSlug, visited = new Set()) {
  const graph = getSkillGraph();
  if (!graph.hasNode(skillSlug)) return [];

  const directPrereqs = graph.inNeighbors(skillSlug);
  for (const prereq of directPrereqs) {
    if (!visited.has(prereq)) {
      visited.add(prereq);
      getAllPrerequisites(prereq, visited);
    }
  }

  return Array.from(visited);
}

/**
 * Retrieves all direct dependent skills enabled by a skill (out-neighbors)
 *
 * @param {string} skillSlug
 * @returns {string[]} Array of dependent skill slugs
 */
export function getDirectDependents(skillSlug) {
  const graph = getSkillGraph();
  if (!graph.hasNode(skillSlug)) return [];
  return graph.outNeighbors(skillSlug);
}

/**
 * Performs topological sort on a subset of skills (or entire graph) so that
 * prerequisites always precede dependent skills in learning order.
 * Uses Kahn's algorithm (indegree-based queue).
 *
 * @param {string[]} [subsetSlugs] - Optional subset of skill slugs to sort
 * @returns {string[]} Topologically sorted skill slugs
 */
export function topologicalSortSkills(subsetSlugs = null) {
  const graph = getSkillGraph();
  const targetNodes = subsetSlugs && subsetSlugs.length > 0
    ? new Set(subsetSlugs.filter((s) => graph.hasNode(s)))
    : new Set(graph.nodes());

  // Calculate in-degree relative to the target subgraph
  const inDegree = new Map();
  for (const node of targetNodes) {
    const parents = graph.inNeighbors(node).filter((p) => targetNodes.has(p));
    inDegree.set(node, parents.length);
  }

  // Queue nodes with 0 in-degree
  const queue = [];
  for (const [node, deg] of inDegree.entries()) {
    if (deg === 0) {
      queue.push(node);
    }
  }

  const sorted = [];
  while (queue.length > 0) {
    const current = queue.shift();
    sorted.push(current);

    const children = graph.outNeighbors(current).filter((c) => targetNodes.has(c));
    for (const child of children) {
      const currentDeg = inDegree.get(child) - 1;
      inDegree.set(child, currentDeg);
      if (currentDeg === 0) {
        queue.push(child);
      }
    }
  }

  // If cycle exists, append remaining nodes
  for (const node of targetNodes) {
    if (!sorted.includes(node)) {
      sorted.push(node);
    }
  }

  return sorted;
}

/**
 * Root-Cause Gap Detection:
 * When a candidate fails or shows a gap in an advanced skill, walks backward
 * along the prerequisite tree to detect foundational root causes.
 *
 * @param {string} targetSkillSlug - Advanced skill with low proficiency
 * @param {Record<string, number>} candidateMasteryMap - Map of skill slug to mastery [0, 1]
 * @param {number} [gapThreshold=0.5] - Mastery below this is considered a deficiency
 * @returns {{ targetSkill: string, rootCauseGaps: Array<{ slug: string, name: string, mastery: number, depth: number }>, isDirectFailure: boolean }}
 */
export function detectRootCauseGaps(targetSkillSlug, candidateMasteryMap = {}, gapThreshold = 0.5) {
  const graph = getSkillGraph();
  if (!graph.hasNode(targetSkillSlug)) {
    return {
      targetSkill: targetSkillSlug,
      rootCauseGaps: [],
      isDirectFailure: true
    };
  }

  const rootCauses = [];
  const visited = new Set();
  const queue = [{ slug: targetSkillSlug, depth: 0 }];

  while (queue.length > 0) {
    const { slug, depth } = queue.shift();
    if (visited.has(slug)) continue;
    visited.add(slug);

    const prereqs = graph.inNeighbors(slug);
    let allPrereqsMet = true;

    for (const prereqSlug of prereqs) {
      const prereqMastery = candidateMasteryMap[prereqSlug] ?? 0;
      if (prereqMastery < gapThreshold) {
        allPrereqsMet = false;
        const prereqNode = graph.getNodeAttributes(prereqSlug);
        rootCauses.push({
          slug: prereqSlug,
          name: prereqNode.name || prereqSlug,
          category: prereqNode.category,
          mastery: Number(prereqMastery.toFixed(2)),
          depth: depth + 1
        });
        queue.push({ slug: prereqSlug, depth: depth + 1 });
      }
    }
  }

  // Deduplicate and prioritize deepest root-cause prerequisites first
  const uniqueRootCauses = Array.from(
    new Map(rootCauses.map((item) => [item.slug, item])).values()
  ).sort((a, b) => b.depth - a.depth);

  return {
    targetSkill: targetSkillSlug,
    targetMastery: candidateMasteryMap[targetSkillSlug] ?? 0,
    rootCauseGaps: uniqueRootCauses,
    isDirectFailure: uniqueRootCauses.length === 0
  };
}

/**
 * Formats skill graph nodes and edges into React Flow format with color coding:
 * - Green (#10B981): Mastered (mastery >= 0.70)
 * - Yellow (#F59E0B): Developing / In-Progress (0.40 <= mastery < 0.70)
 * - Red (#EF4444): Critical Gap (required or assessed < 0.40)
 * - Grey (#64748B): Unassessed / Locked
 *
 * @param {Record<string, number>} [candidateMasteryMap={}]
 * @param {Record<string, number>} [requiredSkillsMap={}]
 * @param {string} [categoryFilter=null]
 * @returns {{ nodes: Array<Object>, edges: Array<Object> }}
 */
export function toReactFlowGraph(
  candidateMasteryMap = {},
  requiredSkillsMap = {},
  categoryFilter = null
) {
  const graph = getSkillGraph();

  // Categories and their column X offsets for clean hierarchical layout
  const categoryXMap = {
    'Frontend': 50,
    'Backend': 350,
    'Database': 650,
    'DevOps': 950,
    'System Design': 1250,
    'Data & AI': 1550,
    'Security': 1850
  };

  const categoryYCounters = {
    'Frontend': 50,
    'Backend': 50,
    'Database': 50,
    'DevOps': 50,
    'System Design': 50,
    'Data & AI': 50,
    'Security': 50
  };

  const nodes = [];
  const edges = [];
  const includedNodes = new Set();

  graph.forEachNode((slug, attrs) => {
    if (categoryFilter && attrs.category !== categoryFilter) {
      return;
    }

    includedNodes.add(slug);

    const mastery = candidateMasteryMap[slug];
    const isRequired = slug in requiredSkillsMap;
    const requiredLevel = requiredSkillsMap[slug] || 0.7;

    let status = 'unassessed';
    let statusColor = '#64748B'; // slate grey
    let borderColor = '#475569';

    if (mastery !== undefined && mastery !== null) {
      if (mastery >= 0.70) {
        status = 'mastered';
        statusColor = '#10B981'; // emerald green
        borderColor = '#059669';
      } else if (mastery >= 0.40) {
        status = 'developing';
        statusColor = '#F59E0B'; // amber yellow
        borderColor = '#D97706';
      } else {
        status = 'gap';
        statusColor = '#EF4444'; // rose red
        borderColor = '#DC2626';
      }
    } else if (isRequired) {
      status = 'gap';
      statusColor = '#EF4444';
      borderColor = '#DC2626';
    }

    const cat = attrs.category || 'Backend';
    const x = categoryXMap[cat] || 350;
    const y = categoryYCounters[cat] || 50;
    categoryYCounters[cat] = y + 110;

    nodes.push({
      id: slug,
      type: 'skillNode',
      position: { x, y },
      data: {
        slug,
        label: attrs.name,
        name: attrs.name,
        category: attrs.category,
        description: attrs.description,
        mastery: mastery !== undefined ? Number(mastery.toFixed(2)) : null,
        status,
        statusColor,
        borderColor,
        isRequired,
        requiredLevel
      }
    });
  });

  // Edges
  graph.forEachEdge((edge, attrs, source, target) => {
    if (includedNodes.has(source) && includedNodes.has(target)) {
      const sourceMastery = candidateMasteryMap[source] ?? 0;
      const isSatisfied = sourceMastery >= 0.60;

      edges.push({
        id: `e-${source}-${target}`,
        source,
        target,
        animated: !isSatisfied,
        style: {
          stroke: isSatisfied ? '#10B981' : '#64748B',
          strokeWidth: isSatisfied ? 2 : 1.5,
          opacity: 0.7
        }
      });
    }
  });

  return { nodes, edges };
}
