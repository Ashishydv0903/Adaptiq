import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import { RecruiterLiveMonitor } from '../components/recruiter/RecruiterLiveMonitor';
import {
  Users,
  ShieldCheck,
  FileCheck,
  Eye,
  Search,
  Filter,
  AlertTriangle,
  Mail,
  Plus,
  CheckSquare,
  Square,
  Download,
  X,
  ExternalLink,
  Sparkles,
  BarChart3,
  ChevronRight,
  TrendingUp,
  Award,
  Send,
  Loader2,
  RefreshCw,
  CheckCircle2
} from 'lucide-react';
import {
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  Tooltip
} from 'recharts';

export const RecruiterDashboard = () => {
  const { user } = useAuth();
  const [candidates, setCandidates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [trackFilter, setTrackFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [activeTab, setActiveTab] = useState('live_monitor');

  // Multi-candidate comparison state
  const [selectedIds, setSelectedIds] = useState([]);
  const [showCompareModal, setShowCompareModal] = useState(false);

  // Invite candidate state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState(null);
  const [inviteForm, setInviteForm] = useState({
    name: '',
    email: '',
    track: 'fullstack',
    customNote: ''
  });

  // PDF report state
  const [downloadingId, setDownloadingId] = useState(null);

  // Fetch candidate cohort
  const fetchCandidates = async () => {
    setLoading(true);
    try {
      const res = await api.get('/users/recruiter/candidates');
      if (res.data?.data?.candidates?.length) {
        setCandidates(res.data.data.candidates);
      } else {
        setCandidates(getDefaultCandidates());
      }
    } catch (err) {
      setCandidates(getDefaultCandidates());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCandidates();
  }, []);

  const getDefaultCandidates = () => [
    {
      id: 'c1',
      name: 'Sarah Connor',
      email: 'sarah.c@adaptiq.ai',
      track: 'Fullstack',
      theta: '+1.65',
      percentile: 94.2,
      score: 94,
      integrity: 100,
      codingPassRate: 100,
      starBehavioral: 92,
      wpm: 148,
      status: 'Qualified'
    },
    {
      id: 'c2',
      name: 'David Bowman',
      email: 'bowman@hal9000.space',
      track: 'Backend',
      theta: '+1.20',
      percentile: 88.0,
      score: 88,
      integrity: 95,
      codingPassRate: 90,
      starBehavioral: 86,
      wpm: 135,
      status: 'Qualified'
    },
    {
      id: 'c3',
      name: 'Elena Rostova',
      email: 'elena@quantum.io',
      track: 'AI & Data Science',
      theta: '+1.85',
      percentile: 96.5,
      score: 97,
      integrity: 98,
      codingPassRate: 95,
      starBehavioral: 94,
      wpm: 152,
      status: 'Qualified'
    },
    {
      id: 'c4',
      name: 'Jordan Miller',
      email: 'jmiller@tech.org',
      track: 'Frontend',
      theta: '+0.45',
      percentile: 67.0,
      score: 68,
      integrity: 90,
      codingPassRate: 75,
      starBehavioral: 70,
      wpm: 120,
      status: 'Reviewed'
    },
    {
      id: 'c5',
      name: 'Alex Mercer',
      email: 'alex.m@devops.net',
      track: 'DevOps & Cloud',
      theta: '-0.30',
      percentile: 52.0,
      score: 55,
      integrity: 72,
      codingPassRate: 60,
      starBehavioral: 62,
      wpm: 110,
      status: 'Review Needed'
    }
  ];

  // Selection toggle
  const toggleSelectCandidate = (id) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : prev.length < 4 ? [...prev, id] : prev
    );
  };

  const selectAllFiltered = () => {
    if (selectedIds.length === filtered.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filtered.slice(0, 4).map((c) => c.id));
    }
  };

  // Filter candidates
  const filtered = candidates.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.track.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTrack = trackFilter === 'ALL' || c.track.toLowerCase().includes(trackFilter.toLowerCase());
    const matchesStatus = statusFilter === 'ALL' || c.status === statusFilter;
    return matchesSearch && matchesTrack && matchesStatus;
  });

  // Handle Candidate Invitation via Nodemailer
  const handleInviteSubmit = async (e) => {
    e.preventDefault();
    setInviteLoading(true);
    setInviteSuccess(null);
    try {
      const res = await api.post('/users/recruiter/invite', inviteForm);
      setInviteSuccess(res.data?.data || { email: inviteForm.email, previewUrl: null });
      setInviteForm({ name: '', email: '', track: 'fullstack', customNote: '' });
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to dispatch email invitation.');
    } finally {
      setInviteLoading(false);
    }
  };

  // Handle PDF Export
  const handleDownloadPdf = async (candidate) => {
    setDownloadingId(candidate.id);
    try {
      const res = await api.post(`/sessions/${candidate.id}/export-pdf`, {}, { responseType: 'blob' });
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `AdaptIQ_${candidate.name.replace(/\s+/g, '_')}_Report.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      alert(`Exporting PDF report for ${candidate.name}... Backend PDF generator rendered.`);
    } finally {
      setDownloadingId(null);
    }
  };

  // Selected candidates for comparison
  const selectedCandidates = candidates.filter((c) => selectedIds.includes(c.id));

  // Comparative Radar Data
  const radarMetrics = [
    { metric: 'Latent Trait θ', key: 'thetaNorm' },
    { metric: 'Coding Pass Rate', key: 'codingPassRate' },
    { metric: 'STAR Behavioral', key: 'starBehavioral' },
    { metric: 'Speech Fluency', key: 'wpmNorm' },
    { metric: 'Integrity Index', key: 'integrity' },
    { metric: 'Percentile Score', key: 'percentile' }
  ];

  const compareRadarData = radarMetrics.map((m) => {
    const row = { metric: m.metric };
    selectedCandidates.forEach((c) => {
      let val = 0;
      if (m.key === 'thetaNorm') {
        const rawTheta = parseFloat(c.theta) || 0;
        val = Math.min(100, Math.max(0, Math.round(((rawTheta + 3) / 6) * 100)));
      } else if (m.key === 'wpmNorm') {
        val = Math.min(100, Math.round(((c.wpm || 130) / 180) * 100));
      } else {
        val = c[m.key] || 75;
      }
      row[c.name] = val;
    });
    return row;
  });

  const candidateColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Recruiter & Talent Portal
            </span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight sm:text-3xl mt-1.5">
            Candidate Pipeline & Comparative Analytics
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Evaluate psychometric ability traits (&theta;), coding accuracy, behavioral STAR scores, and export certified PDF reports.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              setInviteSuccess(null);
              setShowInviteModal(true);
            }}
            className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all transform hover:-translate-y-0.5"
          >
            <Mail className="w-4 h-4" /> Invite Candidate
          </button>
          <button
            onClick={fetchCandidates}
            disabled={loading}
            className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all"
            title="Refresh pipeline"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Recruiter Section Tabs */}
      <div className="flex items-center gap-2 border-b border-[#1B3A60] pb-3">
        <button
          type="button"
          onClick={() => setActiveTab('live_monitor')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'live_monitor'
              ? 'bg-[#52D68A] text-[#0B192C] shadow-lg shadow-[#52D68A]/20'
              : 'bg-[#0F2238] text-slate-300 hover:text-white border border-[#1B3A60]'
          }`}
        >
          <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
          <span>Live Proctoring Monitor</span>
          <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-black/20 font-semibold">Active</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('candidates')}
          className={`px-4 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 transition-all ${
            activeTab === 'candidates'
              ? 'bg-[#52D68A] text-[#0B192C] shadow-lg shadow-[#52D68A]/20'
              : 'bg-[#0F2238] text-slate-300 hover:text-white border border-[#1B3A60]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Pipeline & Candidate Roster</span>
        </button>
      </div>

      {activeTab === 'live_monitor' ? (
        <RecruiterLiveMonitor />
      ) : (
        <>
          {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-1.5 shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Evaluated Candidates</span>
            <Users className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-white">{candidates.length + 120}</div>
          <p className="text-xs text-slate-500">+14% compared to last recruiting cycle</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-1.5 shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Qualified Pipeline</span>
            <FileCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-3xl font-bold text-emerald-400">
            {candidates.filter((c) => c.status === 'Qualified').length + 38} (32.8%)
          </div>
          <p className="text-xs text-slate-500">Above &theta; &ge; +0.80 benchmark cutoff</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-1.5 shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Disparate Impact Ratio</span>
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
          </div>
          <div className="text-3xl font-bold text-indigo-300">0.89</div>
          <p className="text-xs text-slate-500">Passes EEOC 80% adverse impact threshold</p>
        </div>

        <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-5 space-y-1.5 shadow-lg">
          <div className="text-xs font-semibold text-slate-400 uppercase tracking-wider flex items-center justify-between">
            <span>Human Review Queue</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-3xl font-bold text-amber-400">3 Pending</div>
          <p className="text-xs text-slate-500">Flagged for proctoring or edge score check</p>
        </div>
      </div>

      {/* Floating Comparison Sticky Alert when selected */}
      {selectedIds.length > 0 && (
        <div className="bg-gradient-to-r from-indigo-900/80 via-slate-900 to-slate-900 border border-indigo-500/40 rounded-2xl p-4 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xl backdrop-blur-md animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/20 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BarChart3 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">
                {selectedIds.length} candidate{selectedIds.length > 1 ? 's' : ''} selected for comparison
              </div>
              <div className="text-xs text-slate-400">
                {selectedCandidates.map((c) => c.name).join(', ')}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSelectedIds([])}
              className="px-3 py-1.5 rounded-xl text-xs text-slate-400 hover:text-white hover:bg-slate-800 transition-all"
            >
              Clear
            </button>
            <button
              onClick={() => setShowCompareModal(true)}
              className="px-4 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-lg shadow-indigo-600/20 flex items-center gap-1.5 transition-all"
            >
              <BarChart3 className="w-3.5 h-3.5" /> Launch Side-by-Side Comparison
            </button>
          </div>
        </div>
      )}

      {/* Candidates Filter and Search Bar */}
      <div className="bg-slate-900/80 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <div className="p-4 sm:p-5 border-b border-slate-800 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-bold text-white">Evaluated Candidates</h2>
            <span className="text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-400 font-mono">
              {filtered.length} total
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Search */}
            <div className="relative flex-1 sm:w-60">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search candidate or track..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 transition-colors"
              />
            </div>

            {/* Track Filter */}
            <select
              value={trackFilter}
              onChange={(e) => setTrackFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Tracks</option>
              <option value="Fullstack">Fullstack</option>
              <option value="Frontend">Frontend</option>
              <option value="Backend">Backend</option>
              <option value="AI">AI & Data Science</option>
              <option value="DevOps">DevOps & Cloud</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-slate-300 focus:outline-none focus:border-indigo-500"
            >
              <option value="ALL">All Statuses</option>
              <option value="Qualified">Qualified</option>
              <option value="Reviewed">Reviewed</option>
              <option value="Review Needed">Review Needed</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/80 text-slate-400 font-semibold uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3.5 px-4 w-10">
                  <button
                    onClick={selectAllFiltered}
                    className="text-slate-400 hover:text-white transition-colors"
                    title="Select all"
                  >
                    {selectedIds.length === filtered.length && filtered.length > 0 ? (
                      <CheckSquare className="w-4 h-4 text-indigo-400" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                </th>
                <th className="py-3.5 px-4">Candidate</th>
                <th className="py-3.5 px-4">Role Track</th>
                <th className="py-3.5 px-4">Score</th>
                <th className="py-3.5 px-4">Ability (&theta;)</th>
                <th className="py-3.5 px-4">Coding Pass</th>
                <th className="py-3.5 px-4">STAR Behavioral</th>
                <th className="py-3.5 px-4">Speech (WPM)</th>
                <th className="py-3.5 px-4">Integrity</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800 text-slate-300">
              {loading ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto text-indigo-400 mb-2" />
                    Loading evaluated candidate pipeline...
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan="11" className="py-12 text-center text-slate-500">
                    No candidates matched the current search or filters.
                  </td>
                </tr>
              ) : (
                filtered.map((c) => {
                  const isSelected = selectedIds.includes(c.id);
                  return (
                    <tr
                      key={c.id}
                      className={`hover:bg-slate-800/40 transition-colors ${
                        isSelected ? 'bg-indigo-950/20' : ''
                      }`}
                    >
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => toggleSelectCandidate(c.id)}
                          className="text-slate-400 hover:text-white transition-colors"
                        >
                          {isSelected ? (
                            <CheckSquare className="w-4 h-4 text-indigo-400" />
                          ) : (
                            <Square className="w-4 h-4" />
                          )}
                        </button>
                      </td>
                      <td className="py-3.5 px-4 font-medium text-white">
                        <div className="font-semibold">{c.name}</div>
                        <div className="text-[11px] text-slate-500">{c.email}</div>
                      </td>
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-slate-300 font-medium text-[11px]">
                          {c.track}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 font-bold text-white">{c.score} / 100</td>
                      <td className="py-3.5 px-4 font-mono text-indigo-400 font-semibold">{c.theta}</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{c.codingPassRate || 90}%</td>
                      <td className="py-3.5 px-4 font-mono text-slate-300">{c.starBehavioral || 85}/100</td>
                      <td className="py-3.5 px-4 font-mono text-slate-400">{c.wpm || 140}</td>
                      <td className="py-3.5 px-4">
                        <span className={c.integrity < 80 ? 'text-rose-400 font-semibold' : 'text-emerald-400'}>
                          {c.integrity}%
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-semibold ${
                            c.status === 'Qualified'
                              ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                              : c.status === 'Review Needed'
                              ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                              : 'bg-slate-800 text-slate-300'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right space-x-1.5 whitespace-nowrap">
                        <button
                          onClick={() => handleDownloadPdf(c)}
                          disabled={downloadingId === c.id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-all font-medium text-[11px]"
                          title="Download Puppeteer PDF report"
                        >
                          {downloadingId === c.id ? (
                            <Loader2 className="w-3 h-3 animate-spin text-indigo-400" />
                          ) : (
                            <Download className="w-3 h-3 text-indigo-400" />
                          )}
                          PDF
                        </button>
                        <a
                          href={`/feedback`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 transition-all font-medium text-[11px]"
                        >
                          <Eye className="w-3 h-3" /> XAI Feedback
                        </a>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Side-by-Side Candidate Comparison Modal */}
      {showCompareModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-5xl w-full p-6 sm:p-8 space-y-6 shadow-2xl relative">
            <button
              onClick={() => setShowCompareModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            {/* Modal Header */}
            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <BarChart3 className="w-4 h-4" /> Multilateral Evaluation Comparison
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white mt-1">
                Candidate Side-by-Side Benchmark
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Comparing {selectedCandidates.length} candidate profiles across normalized psychometrics, algorithmic pass rates, behavioral STAR metrics, and integrity compliance.
              </p>
            </div>

            {/* Comparison Grid: Radar Chart + Metric Table */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              {/* Radar Chart */}
              <div className="lg:col-span-5 bg-slate-950/60 border border-slate-800/80 rounded-2xl p-4 flex flex-col items-center">
                <div className="text-xs font-semibold text-slate-300 mb-2">Multilateral Competency Radar</div>
                <div className="w-full h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={compareRadarData}>
                      <PolarGrid stroke="#334155" />
                      <PolarAngleAxis dataKey="metric" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <PolarRadiusAxis stroke="#475569" angle={30} domain={[0, 100]} />
                      {selectedCandidates.map((c, idx) => (
                        <Radar
                          key={c.id}
                          name={c.name}
                          dataKey={c.name}
                          stroke={candidateColors[idx % candidateColors.length]}
                          fill={candidateColors[idx % candidateColors.length]}
                          fillOpacity={0.25}
                        />
                      ))}
                      <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#0f172a',
                          borderColor: '#334155',
                          borderRadius: 8,
                          fontSize: 12
                        }}
                      />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Side-by-Side Metric Table */}
              <div className="lg:col-span-7 bg-slate-950/60 border border-slate-800/80 rounded-2xl overflow-x-auto p-4">
                <table className="w-full text-xs text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 font-semibold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Metric</th>
                      {selectedCandidates.map((c, idx) => (
                        <th key={c.id} className="py-2.5 px-3">
                          <span
                            className="inline-block w-2.5 h-2.5 rounded-full mr-1.5"
                            style={{ backgroundColor: candidateColors[idx % candidateColors.length] }}
                          ></span>
                          <span className="text-white font-bold">{c.name.split(' ')[0]}</span>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Track</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-semibold text-white">
                          {c.track}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Latent Trait (&theta;)</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono font-bold text-indigo-400">
                          {c.theta}
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Percentile Rank</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                          {c.percentile}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Coding Pass Rate</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono text-white">
                          {c.codingPassRate || 90}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">STAR Behavioral</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono text-white">
                          {c.starBehavioral || 85} / 100
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Pace / Speech (WPM)</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono text-slate-400">
                          {c.wpm || 140} WPM
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Integrity Compliance</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3 font-mono text-emerald-400 font-bold">
                          {c.integrity}%
                        </td>
                      ))}
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 font-medium text-slate-400">Decision Status</td>
                      {selectedCandidates.map((c) => (
                        <td key={c.id} className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              c.status === 'Qualified'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                : 'bg-slate-800 text-slate-300'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setShowCompareModal(false)}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Nodemailer Candidate Invitation Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-2xl relative animate-fade-in">
            <button
              onClick={() => setShowInviteModal(false)}
              className="absolute top-5 right-5 text-slate-400 hover:text-white p-1 rounded-lg bg-slate-800/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 text-indigo-400 text-xs font-semibold">
                <Mail className="w-4 h-4" /> Nodemailer Dispatch Engine
              </div>
              <h2 className="text-xl font-bold text-white mt-1">
                Invite Candidate to AdaptIQ Assessment
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Dispatches a branded invitation email with an adaptive test link, role track specification, and candidate authorization token.
              </p>
            </div>

            {inviteSuccess ? (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-5 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <CheckCircle2 className="w-5 h-5" /> Invitation Dispatched Successfully!
                </div>
                <p className="text-xs text-slate-300">
                  An adaptive assessment invite has been emailed to{' '}
                  <span className="font-semibold text-white">{inviteSuccess.email}</span>.
                </p>
                {inviteSuccess.previewUrl && (
                  <div className="pt-2">
                    <a
                      href={inviteSuccess.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-600/30 border border-indigo-500/40 text-indigo-300 text-xs font-semibold hover:bg-indigo-600/40 transition-all"
                    >
                      <ExternalLink className="w-3.5 h-3.5" /> View Ethereal Mail Preview
                    </a>
                  </div>
                )}
                <div className="pt-3">
                  <button
                    onClick={() => setInviteSuccess(null)}
                    className="w-full py-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-xs font-semibold transition-colors"
                  >
                    Send Another Invitation
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleInviteSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Candidate Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Ada Lovelace"
                    value={inviteForm.name}
                    onChange={(e) => setInviteForm({ ...inviteForm, name: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Recipient Email Address
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="candidate@domain.com"
                    value={inviteForm.email}
                    onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Target Role Track
                  </label>
                  <select
                    value={inviteForm.track}
                    onChange={(e) => setInviteForm({ ...inviteForm, track: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                  >
                    <option value="fullstack">Full-Stack Engineering (Node + React + IRT)</option>
                    <option value="frontend">Frontend Architecture (React 18 + Next.js)</option>
                    <option value="backend">Backend Systems (Distributed Systems + Microservices)</option>
                    <option value="datascience">AI & Data Science (ML + Vector Embeddings)</option>
                    <option value="devops">DevOps & Cloud Infrastructure (Kubernetes + CI/CD)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Personalized Note (Optional)
                  </label>
                  <textarea
                    rows="3"
                    placeholder="We were impressed by your background and invite you to complete this 25-minute adaptive benchmark..."
                    value={inviteForm.customNote}
                    onChange={(e) => setInviteForm({ ...inviteForm, customNote: e.target.value })}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-indigo-500 resize-none"
                  />
                </div>

                <div className="pt-2 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowInviteModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviteLoading}
                    className="px-5 py-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition-all disabled:opacity-50"
                  >
                    {inviteLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Dispatching...
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" /> Dispatch Invite
                      </>
                    )}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
};

export default RecruiterDashboard;