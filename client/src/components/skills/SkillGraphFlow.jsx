import React, { useState, useMemo, useCallback } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import SkillNode from './SkillNode';
import {
  Search,
  Filter,
  X,
  BookOpen,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  ExternalLink,
  Layers
} from 'lucide-react';

const nodeTypes = {
  skillNode: SkillNode
};

const CATEGORIES = [
  { id: 'all', label: 'All Categories' },
  { id: 'frontend', label: 'Frontend' },
  { id: 'backend', label: 'Backend' },
  { id: 'database', label: 'Databases' },
  { id: 'cloud-devops', label: 'Cloud & DevOps' },
  { id: 'system-design', label: 'System Design' },
  { id: 'data-ai', label: 'Data & AI' },
  { id: 'security', label: 'Security' }
];

export const SkillGraphFlow = ({ skills = [], edges = [], onSelectSkill = () => {} }) => {
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSkillModal, setActiveSkillModal] = useState(null);

  // Compute Layout: Topological Layering or Category Grid
  const { initialNodes, initialEdges } = useMemo(() => {
    if (!skills || skills.length === 0) {
      return { initialNodes: [], initialEdges: [] };
    }

    // Build adjacency and in-degree map for topological depth
    const inDegree = {};
    const adj = {};
    const skillMap = {};

    skills.forEach((s) => {
      const id = s.skillId || s.id;
      inDegree[id] = 0;
      adj[id] = [];
      skillMap[id] = s;
    });

    edges.forEach((e) => {
      if (adj[e.source] && inDegree[e.target] !== undefined) {
        adj[e.source].push(e.target);
        inDegree[e.target] = (inDegree[e.target] || 0) + 1;
      }
    });

    // Compute depths
    const depths = {};
    const queue = [];

    Object.keys(inDegree).forEach((id) => {
      if (inDegree[id] === 0) {
        depths[id] = 0;
        queue.push(id);
      }
    });

    while (queue.length > 0) {
      const curr = queue.shift();
      const currDepth = depths[curr] || 0;
      (adj[curr] || []).forEach((nxt) => {
        depths[nxt] = Math.max(depths[nxt] || 0, currDepth + 1);
        inDegree[nxt]--;
        if (inDegree[nxt] === 0) {
          queue.push(nxt);
        }
      });
    }

    // Group by depth
    const depthBuckets = {};
    skills.forEach((s) => {
      const id = s.skillId || s.id;
      const d = depths[id] || 0;
      if (!depthBuckets[d]) depthBuckets[d] = [];
      depthBuckets[d].push(s);
    });

    // Create ReactFlow Nodes
    const flowNodes = [];
    Object.keys(depthBuckets).forEach((dStr) => {
      const d = parseInt(dStr, 10);
      const items = depthBuckets[d];
      items.forEach((skill, idx) => {
        const id = skill.skillId || skill.id;
        const xOffset = (idx - items.length / 2) * 230 + 400;
        const yOffset = d * 180 + 50;

        flowNodes.push({
          id,
          type: 'skillNode',
          position: { x: xOffset, y: yOffset },
          data: {
            ...skill,
            name: skill.name || id,
            category: skill.category || 'general',
            masteryPercentage: skill.masteryPercentage ?? 0,
            isAssessed: skill.isAssessed ?? false
          }
        });
      });
    });

    // Create ReactFlow Edges
    const flowEdges = edges.map((e, idx) => ({
      id: `e-${e.source}-${e.target}-${idx}`,
      source: e.source,
      target: e.target,
      animated: true,
      style: { stroke: '#6366f1', strokeWidth: 1.5, opacity: 0.65 },
      markerEnd: {
        type: MarkerType.ArrowClosed,
        color: '#6366f1',
        width: 16,
        height: 16
      }
    }));

    return { initialNodes: flowNodes, initialEdges: flowEdges };
  }, [skills, edges]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Sync state when initialNodes/Edges recompute
  React.useEffect(() => {
    setNodes(initialNodes);
    setFlowEdges(initialEdges);
  }, [initialNodes, initialEdges]);

  // Handle node selection
  const handleNodeClick = useCallback(
    (_, node) => {
      setActiveSkillModal(node.data);
      onSelectSkill(node.data);
    },
    [onSelectSkill]
  );

  // Filtered nodes based on category & search
  const visibleNodes = useMemo(() => {
    return nodes.map((node) => {
      const catMatch =
        selectedCategory === 'all' ||
        (node.data.category || '').toLowerCase().includes(selectedCategory);
      const searchMatch =
        !searchQuery.trim() ||
        node.data.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (node.data.category || '').toLowerCase().includes(searchQuery.toLowerCase());

      const isHidden = !catMatch || !searchMatch;
      return {
        ...node,
        hidden: isHidden
      };
    });
  }, [nodes, selectedCategory, searchQuery]);

  return (
    <div className="relative w-full h-[640px] bg-slate-950 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl">
      {/* Top Filter & Legend HUD */}
      <div className="absolute top-4 left-4 right-4 z-10 flex flex-wrap items-center justify-between gap-3 pointer-events-none">
        {/* Category Pills & Search */}
        <div className="flex flex-wrap items-center gap-2 pointer-events-auto bg-slate-900/90 border border-slate-800 p-2 rounded-2xl backdrop-blur-md shadow-lg">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search 80+ skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 text-xs text-white rounded-xl placeholder-slate-500 focus:outline-none focus:border-indigo-500 w-36 sm:w-48"
            />
          </div>

          {/* Category Filter Pills */}
          <div className="hidden lg:flex items-center gap-1 overflow-x-auto">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-xl transition ${
                  selectedCategory === cat.id
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Legend */}
        <div className="pointer-events-auto flex items-center gap-2 bg-slate-900/90 border border-slate-800 px-3 py-2 rounded-2xl backdrop-blur-md text-[11px] shadow-lg">
          <span className="flex items-center gap-1.5 text-emerald-300">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" /> &ge;70% Mastered
          </span>
          <span className="flex items-center gap-1.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" /> 40-69% Developing
          </span>
          <span className="flex items-center gap-1.5 text-rose-300">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-400" /> &lt;40% Critical Gap
          </span>
          <span className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Unassessed
          </span>
        </div>
      </div>

      {/* React Flow Canvas */}
      <ReactFlow
        nodes={visibleNodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        fitView
        minZoom={0.2}
        maxZoom={1.5}
        className="bg-slate-950"
      >
        <Background color="#334155" gap={20} size={1} />
        <Controls className="!bg-slate-900 !border-slate-800 !rounded-xl !fill-white" />
        <MiniMap
          nodeStrokeColor="#6366f1"
          nodeColor="#1e293b"
          maskColor="rgba(15, 23, 42, 0.7)"
          className="!bg-slate-900 !border-slate-800 !rounded-xl"
        />
      </ReactFlow>

      {/* Skill Inspector Modal Drawer */}
      {activeSkillModal && (
        <div className="absolute top-4 right-4 z-20 w-80 sm:w-96 bg-slate-900/95 border border-slate-800 rounded-3xl p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200 space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <span className="text-[10px] font-mono uppercase font-bold text-indigo-400 tracking-wider">
                {activeSkillModal.category}
              </span>
              <h3 className="text-lg font-bold text-white tracking-tight">
                {activeSkillModal.name}
              </h3>
            </div>
            <button
              onClick={() => setActiveSkillModal(null)}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Mastery status & score */}
          <div className="p-3 bg-slate-950 rounded-2xl border border-slate-800 space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-400">Assessment Status:</span>
              <span className="font-semibold text-white">
                {activeSkillModal.isAssessed
                  ? `${Math.round(activeSkillModal.masteryPercentage)}% Mastery`
                  : 'Pending Verification'}
              </span>
            </div>

            <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${
                  activeSkillModal.masteryPercentage >= 70
                    ? 'bg-emerald-400'
                    : activeSkillModal.masteryPercentage >= 40
                    ? 'bg-amber-400'
                    : 'bg-rose-400'
                }`}
                style={{
                  width: `${Math.min(100, Math.max(5, activeSkillModal.masteryPercentage || 0))}%`
                }}
              />
            </div>
          </div>

          {/* Prerequisites */}
          <div className="space-y-1.5">
            <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
              Prerequisites (Dependencies):
            </span>
            {activeSkillModal.prerequisites && activeSkillModal.prerequisites.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {activeSkillModal.prerequisites.map((prereq, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 rounded-lg text-xs bg-slate-800 border border-slate-700 text-slate-200"
                  >
                    {prereq}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">No foundational prerequisites required.</p>
            )}
          </div>

          {/* Description */}
          {activeSkillModal.description && (
            <p className="text-xs text-slate-300 leading-relaxed">
              {activeSkillModal.description}
            </p>
          )}

          {/* Recommended Resources */}
          {activeSkillModal.resources && activeSkillModal.resources.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <span className="text-[11px] font-semibold text-indigo-300 flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5" /> Curated Learning Resource:
              </span>
              {activeSkillModal.resources.slice(0, 2).map((res, idx) => (
                <a
                  key={idx}
                  href={res.url || '#'}
                  target="_blank"
                  rel="noreferrer"
                  className="p-2.5 bg-slate-950 hover:bg-slate-800/80 rounded-xl border border-slate-800 flex items-center justify-between text-xs text-slate-200 group transition"
                >
                  <span className="truncate max-w-[200px]">{res.title}</span>
                  <ExternalLink className="w-3.5 h-3.5 text-slate-500 group-hover:text-indigo-400" />
                </a>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillGraphFlow;