import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  MarkerType,
  useNodesState,
  useEdgesState
} from 'reactflow';
import 'reactflow/dist/style.css';
import api from '../utils/api';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Skeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';
import { ErrorState } from '../components/ui/ErrorState';
import {
  Layers,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Sparkles,
  Info,
  BookOpen,
  X,
  RefreshCw
} from 'lucide-react';

export default function SkillGraphPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [graphData, setGraphData] = useState({
    nodes: [],
    edges: [],
    categories: [],
    totalSkills: 0,
    totalPrerequisiteEdges: 0,
    provenMasteries: {}
  });

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedNode, setSelectedNode] = useState(null);

  const fetchGraph = useCallback(async (category = null) => {
    try {
      setLoading(true);
      setError(null);
      const params = {};
      if (category && category !== 'All') {
        params.category = category;
      }
      const res = await api.get('/skills/graph', { params });
      if (res.data?.success && res.data?.data) {
        setGraphData(res.data.data);
      }
    } catch (err) {
      console.error('Failed to load skill graph:', err);
      setError(err.response?.data?.message || 'Failed to load skill taxonomy graph.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph(selectedCategory);
  }, [fetchGraph, selectedCategory]);

  // Filtered nodes and edges based on search
  const { nodes, edges } = useMemo(() => {
    if (!graphData.nodes || graphData.nodes.length === 0) {
      return { nodes: [], edges: [] };
    }

    let filtered = graphData.nodes;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.data?.label?.toLowerCase().includes(q) ||
          n.data?.slug?.toLowerCase().includes(q) ||
          n.data?.category?.toLowerCase().includes(q)
      );
    }

    const nodeIds = new Set(filtered.map((n) => n.id));
    const filteredEdges = (graphData.edges || []).filter(
      (e) => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    // Apply custom styling for rich dark-mode nodes
    const styledNodes = filtered.map((n) => {
      const mastery = n.data?.mastery;
      const status = n.data?.status || 'unassessed';

      let bg = '#1e293b';
      let border = '#334155';
      let textColor = '#f1f5f9';

      if (status === 'mastered') {
        bg = '#064e3b';
        border = '#10b981';
        textColor = '#6ee7b7';
      } else if (status === 'developing') {
        bg = '#78350f';
        border = '#f59e0b';
        textColor = '#fcd34d';
      } else if (status === 'gap') {
        bg = '#7f1d1d';
        border = '#ef4444';
        textColor = '#fca5a5';
      }

      return {
        ...n,
        style: {
          background: bg,
          border: `2px solid ${border}`,
          borderRadius: '12px',
          color: textColor,
          fontSize: '12px',
          fontWeight: '600',
          padding: '10px 14px',
          minWidth: '150px',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
          cursor: 'pointer'
        }
      };
    });

    return { nodes: styledNodes, edges: filteredEdges };
  }, [graphData, searchQuery]);

  const [flowNodes, setNodes, onNodesChange] = useNodesState([]);
  const [flowEdges, setEdges, onEdgesChange] = useEdgesState([]);

  useEffect(() => {
    setNodes(nodes);
    setEdges(edges);
  }, [nodes, edges, setNodes, setEdges]);

  const handleNodeClick = (_, node) => {
    setSelectedNode(node.data || null);
  };

  // Compute summary stats
  const stats = useMemo(() => {
    const masteries = graphData.provenMasteries || {};
    let masteredCount = 0;
    let developingCount = 0;
    let gapCount = 0;

    Object.values(masteries).forEach((val) => {
      if (val >= 0.7) masteredCount++;
      else if (val >= 0.4) developingCount++;
      else gapCount++;
    });

    return {
      total: graphData.totalSkills || 84,
      edges: graphData.totalPrerequisiteEdges || 112,
      mastered: masteredCount,
      developing: developingCount,
      gap: gapCount
    };
  }, [graphData]);

  const categories = [
    'All',
    'Frontend',
    'Backend',
    'Database',
    'DevOps',
    'System Design',
    'Data & AI',
    'Security'
  ];

  return (
    <div className="min-h-screen bg-[#0B192C] text-slate-100 flex flex-col font-sans">
      {/* Top Header */}
      <div className="border-b border-[#1E3E62] bg-[#0E2238]/90 backdrop-blur-md px-6 py-6 sticky top-0 z-20">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#52D68A]/10 border border-[#52D68A]/30 flex items-center justify-center text-[#52D68A]">
                <Layers className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl font-bold font-display text-white">Skill Dependency Graph</h1>
                  <Badge variant="mint" size="sm">Directed Acyclic Graph (DAG)</Badge>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Topological skill hierarchy, prerequisite constraints, and verified trait masteries from candidate assessments.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            <Button
              variant="outline"
              size="sm"
              icon={RefreshCw}
              onClick={() => fetchGraph(selectedCategory)}
            >
              Reload Graph
            </Button>
            <Button
              variant="mint"
              size="sm"
              icon={Sparkles}
              onClick={() => navigate('/skills/gap-analysis')}
            >
              View Gap Analysis & Roadmap
            </Button>
          </div>
        </div>

        {/* Stats Strip */}
        <div className="max-w-7xl mx-auto mt-4 pt-4 border-t border-[#1E3E62]/50 grid grid-cols-2 sm:grid-cols-5 gap-3">
          <div className="bg-[#0B192C]/80 border border-[#1E3E62] rounded-xl p-3 text-center">
            <div className="text-lg font-bold font-display text-white">{stats.total}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Total Skills</div>
          </div>
          <div className="bg-[#0B192C]/80 border border-[#1E3E62] rounded-xl p-3 text-center">
            <div className="text-lg font-bold font-display text-indigo-400">{stats.edges}</div>
            <div className="text-[11px] text-slate-400 font-medium uppercase tracking-wider">Prerequisite Links</div>
          </div>
          <div className="bg-[#0B192C]/80 border border-emerald-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-bold font-display text-emerald-400">{stats.mastered}</div>
            <div className="text-[11px] text-emerald-300 font-medium uppercase tracking-wider">&ge;70% Mastered</div>
          </div>
          <div className="bg-[#0B192C]/80 border border-amber-500/30 rounded-xl p-3 text-center">
            <div className="text-lg font-bold font-display text-amber-400">{stats.developing}</div>
            <div className="text-[11px] text-amber-300 font-medium uppercase tracking-wider">40-69% Developing</div>
          </div>
          <div className="bg-[#0B192C]/80 border border-rose-500/30 rounded-xl p-3 text-center col-span-2 sm:col-span-1">
            <div className="text-lg font-bold font-display text-rose-400">{stats.gap}</div>
            <div className="text-[11px] text-rose-300 font-medium uppercase tracking-wider">&lt;40% Critical Gap</div>
          </div>
        </div>

        {/* Filters and Search Bar */}
        <div className="max-w-7xl mx-auto mt-4 flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-none">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  selectedCategory === cat
                    ? 'bg-[#52D68A] text-[#0B192C] shadow-md shadow-[#52D68A]/20'
                    : 'bg-[#1E3E62]/40 text-slate-300 hover:bg-[#1E3E62] border border-transparent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search skill by name or slug..."
              className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[#0B192C] border border-[#1E3E62] text-xs text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 relative h-[calc(100vh-280px)] min-h-[500px]">
        {loading ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#0B192C]/90 z-10 space-y-3">
            <div className="w-10 h-10 rounded-full border-3 border-[#1E3E62] border-t-[#52D68A] animate-spin" />
            <span className="text-xs text-slate-400">Loading ontology nodes and topological dependencies...</span>
          </div>
        ) : error ? (
          <div className="p-8 max-w-lg mx-auto">
            <ErrorState
              title="Failed to Load Skill Graph"
              message={error}
              onRetry={() => fetchGraph(selectedCategory)}
            />
          </div>
        ) : flowNodes.length === 0 ? (
          <div className="p-8 max-w-lg mx-auto">
            <EmptyState
              title="No Skills Found"
              description="No competencies match your search query or category filter."
              actionLabel="Clear Filters"
              onAction={() => {
                setSelectedCategory('All');
                setSearchQuery('');
              }}
            />
          </div>
        ) : (
          <ReactFlow
            nodes={flowNodes}
            edges={flowEdges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onNodeClick={handleNodeClick}
            fitView
            minZoom={0.2}
            maxZoom={1.8}
            className="bg-[#071322]"
          >
            <Background color="#1E3E62" gap={24} size={1.2} />
            <Controls className="!bg-[#0E2238] !border-[#1E3E62] !rounded-xl !fill-white" />
            <MiniMap
              nodeColor={(n) => {
                const status = n.data?.status;
                if (status === 'mastered') return '#10B981';
                if (status === 'developing') return '#F59E0B';
                if (status === 'gap') return '#EF4444';
                return '#475569';
              }}
              maskColor="rgba(11, 25, 44, 0.75)"
              className="!bg-[#0E2238] !border-[#1E3E62] !rounded-xl"
            />
          </ReactFlow>
        )}

        {/* Legend */}
        <div className="absolute bottom-4 left-4 z-10 bg-[#0E2238]/90 border border-[#1E3E62] rounded-xl p-3 backdrop-blur-md text-xs space-y-1.5 shadow-xl">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Node Status</div>
          <div className="flex items-center gap-2 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &ge;70% Mastered
          </div>
          <div className="flex items-center gap-2 text-amber-400">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 40-69% Developing
          </div>
          <div className="flex items-center gap-2 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &lt;40% Critical Gap
          </div>
          <div className="flex items-center gap-2 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-600" /> Unassessed Baseline
          </div>
        </div>

        {/* Selected Skill Drawer */}
        {selectedNode && (
          <div className="absolute top-4 right-4 z-20 w-80 sm:w-96 bg-[#0E2238]/95 border border-[#1E3E62] rounded-2xl p-5 shadow-2xl backdrop-blur-xl animate-in slide-in-from-right duration-200 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400">
                  {selectedNode.category || 'Skill Competency'}
                </span>
                <h3 className="text-base font-bold text-white font-display mt-0.5">
                  {selectedNode.label || selectedNode.name || selectedNode.slug}
                </h3>
              </div>
              <button
                onClick={() => setSelectedNode(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1E3E62]/40"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 bg-[#0B192C] border border-[#1E3E62] rounded-xl flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase font-bold text-slate-400">Proven Trait Score</div>
                <div className="text-xl font-bold font-display text-white mt-0.5">
                  {selectedNode.mastery !== undefined
                    ? `${Math.round(selectedNode.mastery * 100)}%`
                    : 'Unassessed'}
                </div>
              </div>
              <Badge
                variant={
                  selectedNode.status === 'mastered'
                    ? 'mint'
                    : selectedNode.status === 'developing'
                    ? 'amber'
                    : selectedNode.status === 'gap'
                    ? 'rose'
                    : 'outline'
                }
              >
                {selectedNode.status || 'unassessed'}
              </Badge>
            </div>

            {selectedNode.slug && (
              <div className="text-xs text-slate-300">
                <span className="text-slate-500 font-mono text-[11px]">Slug: {selectedNode.slug}</span>
              </div>
            )}

            <div className="pt-2 flex items-center gap-2">
              <Button
                variant="mint"
                size="sm"
                className="w-full"
                icon={Sparkles}
                onClick={() => navigate('/skills/gap-analysis')}
              >
                Review Learning Path
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
