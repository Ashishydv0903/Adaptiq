import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../services/api';
import {
  Layers,
  FileText,
  Briefcase,
  MapPin,
  Upload,
  CheckCircle2,
  AlertTriangle,
  Download,
  Sparkles,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Award,
  Shield,
  BarChart2,
  Clock,
  Compass,
  Check,
  Target,
  GraduationCap,
  Calendar,
  ChevronRight,
  Lightbulb
} from 'lucide-react';

export const SkillGapAnalysis = () => {
  const navigate = useNavigate();

  // Active tab: 'interview-summary' | 'resume' | 'jd' | 'roadmap'
  const [activeTab, setActiveTab] = useState('interview-summary');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Interview Summary State (Fresh real results from candidate session)
  const [interviewSummary, setInterviewSummary] = useState(null);
  const [loadingSummary, setLoadingSummary] = useState(true);

  // Resume Parse state
  const [resumeFile, setResumeFile] = useState(null);
  const [uploadingResume, setUploadingResume] = useState(false);
  const [resumeResults, setResumeResults] = useState(null);

  // JD Analysis state
  const [jdText, setJdText] = useState('');
  const [analyzingJd, setAnalyzingJd] = useState(false);
  const [jdResult, setJdResult] = useState(null);
  const [generatingAssessment, setGeneratingAssessment] = useState(false);

  // Roadmap state
  const [roadmap, setRoadmap] = useState(null);
  const [exportingPdf, setExportingPdf] = useState(false);

  // Fetch initial data
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);

        // Fetch candidate's interview summary & gaps
        try {
          const summaryRes = await api.get('/skills/my-interview-summary');
          if (summaryRes.data?.data) {
            setInterviewSummary(summaryRes.data.data);
          }
        } catch (e) {
          console.warn('Failed to fetch interview summary:', e.message);
        }

        // Fetch initial roadmap
        generateInitialRoadmap();
      } catch (err) {
        console.error('Failed to load study data:', err);
        setError('Failed to load study data.');
      } finally {
        setLoading(false);
        setLoadingSummary(false);
      }
    };

    fetchData();
  }, []);

  const generateInitialRoadmap = async () => {
    try {
      const res = await api.post('/skills/roadmap', {
        targetRole: 'Fullstack Engineer',
        matchPercentage: 74,
        skillGaps: [
          { skillId: 'system-design', name: 'System Design & Scalability', gapSeverity: 'critical' },
          { skillId: 'docker-containers', name: 'Docker & Containerization', gapSeverity: 'moderate' },
          { skillId: 'react-advanced', name: 'Advanced React Patterns', gapSeverity: 'minor' }
        ]
      });
      setRoadmap(res.data.data.roadmap);
    } catch (err) {
      console.warn('Roadmap initial fetch failed:', err.message);
    }
  };

  // Resume Upload Handler
  const handleResumeUpload = async (e) => {
    e.preventDefault();
    if (!resumeFile) {
      alert('Please select a PDF or DOCX resume file.');
      return;
    }

    setUploadingResume(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('resume', resumeFile);

      const res = await api.post('/skills/resume-parse', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setResumeResults(res.data.data);
    } catch (err) {
      console.error('Resume upload error:', err);
      setError(err.response?.data?.message || 'Failed to parse resume.');
    } finally {
      setUploadingResume(false);
    }
  };

  // JD Analysis Handler
  const handleAnalyzeJD = async () => {
    if (!jdText.trim() || jdText.length < 15) {
      alert('Please paste a job description.');
      return;
    }

    setAnalyzingJd(true);
    setError('');

    try {
      const res = await api.post('/skills/jd-analyze', { jdText });
      setJdResult(res.data.data);
    } catch (err) {
      console.error('JD analysis error:', err);
      setError(err.response?.data?.message || 'Failed to analyze job description.');
    } finally {
      setAnalyzingJd(false);
    }
  };

  // Generate Tailored Assessment from JD
  const handleGenerateJdAssessment = async () => {
    if (!jdResult) return;
    setGeneratingAssessment(true);

    try {
      const res = await api.post('/skills/jd-generate-assessment', {
        targetRole: jdResult.targetRole,
        topGaps: jdResult.topGaps
      });

      const session = res.data.data.session;
      navigate(`/interview/${session._id || session.id}`);
    } catch (err) {
      console.error('Failed to generate assessment:', err);
      alert('Failed to launch targeted assessment.');
    } finally {
      setGeneratingAssessment(false);
    }
  };

  // Roadmap toggle progress
  const handleToggleRoadmapStep = async (milestoneIndex, resourceIndex, currentCompleted) => {
    if (!roadmap) return;

    try {
      const nextCompleted = !currentCompleted;
      const updatedRoadmap = { ...roadmap };
      updatedRoadmap.milestones[milestoneIndex].resources[resourceIndex].isCompleted = nextCompleted;
      setRoadmap(updatedRoadmap);

      if (roadmap._id) {
        await api.patch(`/skills/roadmap/${roadmap._id}/progress`, {
          milestoneIndex,
          resourceIndex,
          isCompleted: nextCompleted
        });
      }
    } catch (err) {
      console.warn('Progress update sync error:', err.message);
    }
  };

  // PDF Export
  const handleExportPdf = async () => {
    setExportingPdf(true);
    try {
      const res = await api.post(
        '/skills/roadmap/export-pdf',
        {
          targetRole: roadmap?.targetRole || 'Fullstack Engineer',
          matchPercentage: roadmap?.matchPercentage || 75,
          roadmap
        },
        { responseType: 'blob' }
      );

      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `Study_Roadmap_${Date.now()}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('PDF export error:', err);
      alert('Failed to generate PDF roadmap.');
    } finally {
      setExportingPdf(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-300">
        <div className="w-10 h-10 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-sm font-medium">Loading your skill assessment report...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6 bg-[#0B192C] text-white">
      {/* Friendly Human Header Banner */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[#1B3A60] pb-6">
        <div>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20 mb-2">
            <GraduationCap className="w-4 h-4 text-[#52D68A]" /> Student Career & Skills Center
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
            Skill Breakdown & Study Guide
          </h1>
          <p className="text-slate-300 text-xs sm:text-sm mt-1">
            See the skills you proved in your interview, where you have room to grow, and what to study next.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate('/candidate/dashboard')}
            className="px-4 py-2 bg-[#0F2238] hover:bg-[#132A46] text-slate-200 text-xs font-semibold rounded-xl border border-[#1B3A60] transition"
          >
            Back to Dashboard
          </button>
          {roadmap && (
            <button
              type="button"
              onClick={handleExportPdf}
              disabled={exportingPdf}
              className="px-4 py-2 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 flex items-center gap-2 transition disabled:opacity-50"
            >
              {exportingPdf ? (
                <div className="w-3.5 h-3.5 border-2 border-[#0B192C] border-t-transparent rounded-full animate-spin" />
              ) : (
                <Download className="w-3.5 h-3.5" />
              )}
              Save Study Plan (PDF)
            </button>
          )}
        </div>
      </div>

      {/* Tabs Navigation in Plain Everyday English */}
      <div className="flex border-b border-[#1B3A60] space-x-2 overflow-x-auto pb-1">
        <button
          onClick={() => setActiveTab('interview-summary')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'interview-summary'
              ? 'border-[#52D68A] text-[#52D68A] bg-[#52D68A]/10 rounded-t-xl font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Award className="w-4 h-4 text-[#52D68A]" />
          My Interview Skills & Gaps
        </button>

        <button
          onClick={() => setActiveTab('resume')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'resume'
              ? 'border-[#52D68A] text-[#52D68A] bg-[#52D68A]/10 rounded-t-xl font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <FileText className="w-4 h-4" />
          Resume vs. Interview Check
        </button>

        <button
          onClick={() => setActiveTab('jd')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'jd'
              ? 'border-[#52D68A] text-[#52D68A] bg-[#52D68A]/10 rounded-t-xl font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <Briefcase className="w-4 h-4" />
          Job Description Matcher
        </button>

        <button
          onClick={() => setActiveTab('roadmap')}
          className={`py-2.5 px-4 text-xs sm:text-sm font-semibold flex items-center gap-2 border-b-2 transition whitespace-nowrap ${
            activeTab === 'roadmap'
              ? 'border-[#52D68A] text-[#52D68A] bg-[#52D68A]/10 rounded-t-xl font-bold'
              : 'border-transparent text-slate-400 hover:text-slate-200'
          }`}
        >
          <MapPin className="w-4 h-4" />
          Study Checklist & Resources
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 1: MY INTERVIEW SKILLS & GAPS (DEFAULT, CLEAR, NEVER SAYS NONE) */}
      {/* ========================================================================= */}
      {activeTab === 'interview-summary' && (
        <div className="space-y-6">
          {/* Top Overview Banner */}
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 space-y-4 shadow-xl">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-1.5">
                <span className="text-xs font-bold text-[#52D68A] uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-[#52D68A]" />
                  Your Plain-English Interview Performance Breakdown
                </span>
                <h2 className="text-xl sm:text-2xl font-bold text-white">
                  {interviewSummary?.track || 'Full-Stack Engineering'} Assessment
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 max-w-2xl leading-relaxed">
                  No confusing math or academic jargon. Below are the skills you did great on, exactly what you missed, and the simple words to say next time to pass your real interviews.
                </p>
              </div>

              <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 text-center min-w-[150px] shadow-lg shrink-0">
                <span className="text-[10px] text-slate-400 uppercase font-semibold block">Your Overall Rating</span>
                <span className="text-3xl sm:text-4xl font-bold font-mono text-[#52D68A] my-0.5 block">
                  {interviewSummary?.overallScore || 78}%
                </span>
                <span className="text-[11px] font-bold text-emerald-400 block">
                  {interviewSummary?.overallScore >= 80 ? 'Interview Ready' : 'Ready with Quick Practice'}
                </span>
              </div>
            </div>
          </div>

          {/* Side by side: Proven Strengths vs Identified Gaps */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Column 1: Proven Strengths */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1B3A60] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-[#52D68A]/20 text-[#52D68A] flex items-center justify-center font-bold">
                      <Check className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white">Skills You Nailed</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
                    {interviewSummary?.provenSkills?.length || 3} Confirmed
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  You answered these questions cleanly and proved strong understanding:
                </p>

                <div className="space-y-3">
                  {(interviewSummary?.provenSkills || []).map((skill, idx) => (
                    <div
                      key={idx}
                      className="p-4 sm:p-5 rounded-2xl bg-[#0B192C] border border-[#1B3A60] space-y-3 hover:border-[#52D68A]/40 transition-colors shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded-full mb-1 border border-[#52D68A]/20">
                            {skill.category}
                          </span>
                          <h4 className="text-sm font-bold text-white">{skill.name}</h4>
                        </div>
                        <span className="text-xs font-mono font-bold text-[#52D68A] bg-[#0F2238] px-2.5 py-1 rounded-xl border border-[#1B3A60] shrink-0">
                          {skill.score}%
                        </span>
                      </div>

                      {/* Plain English meaning */}
                      {skill.plainEnglishConcept && (
                        <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60] text-xs text-slate-300 leading-relaxed">
                          <strong className="text-[#52D68A] block mb-0.5">💡 In simple words:</strong>
                          <span>{skill.plainEnglishConcept}</span>
                        </div>
                      )}

                      <div className="p-3 rounded-xl bg-[#0F2238]/60 border border-[#1B3A60] text-xs text-emerald-200/90 leading-relaxed flex items-start gap-2">
                        <Check className="w-4 h-4 text-[#52D68A] shrink-0 mt-0.5" />
                        <span><strong>What you proved:</strong> {skill.summary}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Identified Gaps to Practice */}
            <div className="bg-[#0F2238] border-2 border-amber-500/30 rounded-3xl p-6 space-y-4 shadow-lg flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-[#1B3A60] pb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center font-bold">
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <h3 className="text-base font-bold text-white">Skills to Brush Up On Next</h3>
                  </div>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    {interviewSummary?.skillGaps?.length || 3} Recommendations
                  </span>
                </div>

                <p className="text-xs text-slate-300">
                  Reviewing these simple pointers will give you the biggest score boost on your next interview:
                </p>

                <div className="space-y-4">
                  {(interviewSummary?.skillGaps || []).map((gap, idx) => (
                    <div
                      key={idx}
                      className="p-5 rounded-2xl bg-[#0B192C] border border-[#1B3A60] hover:border-amber-500/40 space-y-3.5 transition-colors shadow-md"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="inline-block text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full mb-1 border border-amber-500/20">
                            {gap.category}
                          </span>
                          <h4 className="text-sm font-bold text-white">{gap.name}</h4>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {gap.estimatedMinutes && (
                            <span className="text-[10px] font-mono text-slate-400 bg-[#0F2238] px-2 py-0.5 rounded-md border border-[#1B3A60]">
                              ~{gap.estimatedMinutes}m
                            </span>
                          )}
                          <span
                            className={`px-2 py-0.5 rounded-lg text-[10px] font-semibold border shrink-0 ${
                              gap.gapSeverity?.includes('Focus') || gap.gapSeverity?.includes('Priority')
                                ? 'bg-rose-500/15 text-rose-300 border-rose-500/30'
                                : 'bg-amber-500/10 text-amber-300 border-amber-500/20'
                            }`}
                          >
                            {gap.gapSeverity || 'Focus Here First'}
                          </span>
                        </div>
                      </div>

                      {/* 1. Plain English Concept Analogy */}
                      <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60] text-xs text-slate-200 leading-relaxed">
                        <strong className="text-[#52D68A] block mb-1">💡 What this actually means in simple words:</strong>
                        <span>{gap.plainEnglishConcept || gap.advice || 'A core pattern frequently evaluated during technical and fullstack interviews.'}</span>
                      </div>

                      {/* 2. What was missing in candidate answer */}
                      <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <div>
                          <strong className="text-amber-300 block mb-0.5">What was missing in your answer:</strong>
                          <span>{gap.whatYouLacked || gap.advice}</span>
                        </div>
                      </div>

                      {/* 3. The Winning Answer to say next time */}
                      {gap.winningAnswer && (
                        <div className="p-3 rounded-xl bg-[#071322] border border-[#52D68A]/30 text-xs text-emerald-200 leading-relaxed flex items-start gap-2">
                          <Check className="w-4 h-4 text-[#52D68A] shrink-0 mt-0.5" />
                          <div>
                            <strong className="text-[#52D68A] block mb-0.5">What to say next time (Say this!):</strong>
                            <span className="italic">{gap.winningAnswer}</span>
                          </div>
                        </div>
                      )}

                      {/* 4. Quick fix & Resource */}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1B3A60]/80 text-xs">
                        <span className="text-slate-400 text-[11px] truncate max-w-[240px]">
                          <strong>Quick fix:</strong> {gap.howToFix}
                        </span>
                        {gap.recommendedResource && (
                          <a
                            href={gap.recommendedResource}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-[11px] text-[#52D68A] hover:underline font-semibold"
                          >
                            <BookOpen className="w-3.5 h-3.5" /> Read Free 5-Min Guide &rarr;
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Actionable 3-Step Study Plan */}
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 space-y-4 shadow-lg">
            <div className="flex items-center gap-2 border-b border-[#1B3A60] pb-3">
              <Calendar className="w-5 h-5 text-[#52D68A]" />
              <div>
                <h3 className="text-base font-bold text-white">Your Simple 3-Step Action Plan</h3>
                <p className="text-xs text-slate-300">Spend just 15-20 minutes a day following these steps to pass your next interview:</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
              {(interviewSummary?.studyPlan || []).map((step, idx) => (
                <div key={idx} className="p-4 rounded-2xl bg-[#0B192C] border border-[#1B3A60] space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-[#52D68A]">{step.day}</span>
                    <span className="text-slate-400 font-mono text-[11px]">{step.duration}</span>
                  </div>
                  <h4 className="text-xs font-bold text-white">{step.title}</h4>
                  <p className="text-xs text-slate-300 leading-relaxed">{step.task}</p>
                </div>
              ))}
            </div>

            <div className="pt-2 flex flex-wrap items-center justify-end gap-3">
              <button
                onClick={() => navigate('/candidate/dashboard')}
                className="px-5 py-2.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] text-xs font-bold rounded-xl shadow-lg shadow-[#52D68A]/20 flex items-center gap-1.5 transition"
              >
                <Sparkles className="w-3.5 h-3.5" /> Start Practice on These Topics
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: RESUME VS INTERVIEW CHECK */}
      {/* ========================================================================= */}
      {activeTab === 'resume' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Resume vs. Interview Skills Check</h3>
              <p className="text-xs text-slate-400">
                Upload your resume (PDF or Word DOCX). We will check the skills you listed on your resume against what you proved during your interview.
              </p>
            </div>

            <form onSubmit={handleResumeUpload} className="flex flex-wrap items-center gap-3">
              <input
                type="file"
                accept=".pdf,.docx,.doc"
                onChange={(e) => setResumeFile(e.target.files[0])}
                className="text-xs text-slate-300 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-semibold file:bg-slate-800 file:text-slate-200 hover:file:bg-slate-700 cursor-pointer"
              />

              <button
                type="submit"
                disabled={uploadingResume || !resumeFile}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {uploadingResume ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Checking Resume...
                  </>
                ) : (
                  <>
                    <Upload className="w-3.5 h-3.5" /> Check My Resume
                  </>
                )}
              </button>
            </form>
          </div>

          {resumeResults && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-base font-bold text-white">
                    {resumeResults.candidateName || 'Candidate Profile'}
                  </h3>
                  <div className="flex items-center gap-3 text-xs text-slate-400 mt-1">
                    <span>Experience: <strong className="text-white">{resumeResults.experienceYears || '3+'} Years</strong></span>
                    <span>&bull;</span>
                    <span>Role: <strong className="text-indigo-400">{resumeResults.targetRole || 'Fullstack Developer'}</strong></span>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full font-semibold">
                    {resumeResults.provenCount || 3} Proven
                  </span>
                  <span className="px-3 py-1 bg-amber-500/10 text-amber-400 border border-amber-500/20 rounded-full font-semibold">
                    {resumeResults.unverifiedCount || 2} Unverified
                  </span>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-800 text-slate-400 uppercase font-mono text-[10px]">
                      <th className="py-3 px-3">Skill</th>
                      <th className="py-3 px-3">On Your Resume</th>
                      <th className="py-3 px-3">Proven in Interview</th>
                      <th className="py-3 px-3">Result</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-sans">
                    {(resumeResults.claimedVsProven || []).map((row, idx) => (
                      <tr key={idx} className="hover:bg-slate-950/40 transition">
                        <td className="py-3 px-3 font-semibold text-white">{row.skill}</td>
                        <td className="py-3 px-3 text-slate-300">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                            {row.claimed ? 'Claimed' : 'Not Listed'}
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          {row.proven ? (
                            <span className="inline-flex items-center gap-1 text-emerald-400 font-medium">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Proven ({Math.round(row.mastery || 75)}%)
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-400 font-medium">
                              <AlertTriangle className="w-3.5 h-3.5" /> Needs Practice
                            </span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              row.status === 'verified'
                                ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
                            }`}
                          >
                            {row.status === 'verified' ? 'Verified Match' : 'Skill Gap'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: JOB DESCRIPTION FIT & MATCHER */}
      {/* ========================================================================= */}
      {activeTab === 'jd' && (
        <div className="space-y-6">
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">Target Job Fit Matcher</h3>
              <p className="text-xs text-slate-400">
                Found a job on LinkedIn or Indeed? Paste the job description below to see your match score and top gaps.
              </p>
            </div>

            <textarea
              rows={5}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste a job description here (e.g. We are seeking a Full Stack Engineer with experience in React, Node.js, REST APIs, Docker, and Redis)..."
              className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3.5 text-xs text-slate-100 placeholder-slate-600 focus:outline-none focus:border-indigo-500 leading-relaxed font-sans"
            />

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleAnalyzeJD}
                disabled={analyzingJd || !jdText.trim()}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition flex items-center gap-2 disabled:opacity-50"
              >
                {analyzingJd ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Calculating Match...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" /> Check Job Match
                  </>
                )}
              </button>
            </div>
          </div>

          {jdResult && (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
                <div>
                  <span className="text-[10px] font-mono uppercase text-indigo-400 font-bold">Target Position</span>
                  <h3 className="text-xl font-bold text-white">{jdResult.targetRole || 'Fullstack Engineer'}</h3>
                </div>

                <div className="text-right">
                  <span className="text-[10px] uppercase text-slate-400 block font-semibold">Your Match Score</span>
                  <span className="text-2xl font-bold font-mono text-emerald-400">
                    {Math.round(jdResult.fitPercentage || 74)}%
                  </span>
                </div>
              </div>

              <div className="space-y-3">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Key Skills to Strengthen for this Role:
                </span>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {(jdResult.topGaps || []).map((gap, idx) => (
                    <div key={idx} className="p-4 bg-slate-950 rounded-xl border border-rose-500/20 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-white">{gap.name || gap.skillId}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-rose-500/10 text-rose-400 border border-rose-500/20 font-semibold">
                          Gap #{idx + 1}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        {gap.reason || 'Needed for this role. Practice questions available.'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={handleGenerateJdAssessment}
                  disabled={generatingAssessment}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-lg shadow-indigo-600/25 flex items-center gap-2 transition"
                >
                  <ArrowRight className="w-4 h-4" />
                  Practice Questions for This Job
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: STUDY ROADMAP & FREE RESOURCES */}
      {/* ========================================================================= */}
      {activeTab === 'roadmap' && (
        <div className="space-y-6">
          {roadmap && (
            <div className="space-y-6">
              <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 flex flex-wrap items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <CheckCircle2 className="w-3 h-3" /> Step-by-Step Learning Plan
                  </div>
                  <h3 className="text-lg font-bold text-white">
                    Target Goal: {roadmap.targetRole || 'Fullstack Engineer'}
                  </h3>
                  <p className="text-xs text-slate-400">
                    Follow these sequential learning milestones to reach interview readiness.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={handleExportPdf}
                  disabled={exportingPdf}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium rounded-xl border border-slate-700 flex items-center gap-1.5 transition"
                >
                  <Download className="w-3.5 h-3.5" /> Save as PDF
                </button>
              </div>

              <div className="space-y-4">
                {(roadmap.milestones || []).map((ms, mIdx) => (
                  <div key={mIdx} className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4">
                    <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                      <div className="flex items-center gap-2.5">
                        <span className="w-7 h-7 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center font-bold text-xs">
                          {mIdx + 1}
                        </span>
                        <div>
                          <h4 className="text-sm font-bold text-white">{ms.title}</h4>
                          <span className="text-[10px] text-slate-400 uppercase font-mono">
                            {ms.durationWeeks || 2} Weeks &bull; {ms.skillCategory || 'Core Track'}
                          </span>
                        </div>
                      </div>

                      <span className="text-xs font-semibold text-indigo-300">
                        {ms.resources?.filter((r) => r.isCompleted).length || 0}/
                        {ms.resources?.length || 0} Modules Completed
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {(ms.resources || []).map((res, rIdx) => (
                        <div
                          key={rIdx}
                          className={`p-3 rounded-xl border transition flex items-start gap-3 ${
                            res.isCompleted
                              ? 'bg-slate-950/40 border-emerald-500/20 text-slate-400'
                              : 'bg-slate-950 border-slate-800 text-slate-200'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={res.isCompleted || false}
                            onChange={() => handleToggleRoadmapStep(mIdx, rIdx, res.isCompleted)}
                            className="mt-1 w-4 h-4 rounded text-indigo-600 bg-slate-900 border-slate-700 focus:ring-0 cursor-pointer"
                          />
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-semibold text-white">{res.title}</span>
                              <span className="text-[10px] text-slate-400">{res.estimatedHours || 3} hrs</span>
                            </div>
                            <span className="text-[10px] uppercase font-mono text-indigo-400 block">
                              {res.type || 'Guide'} &bull; {res.provider || 'Free'}
                            </span>
                            {res.url && (
                              <a
                                href={res.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition"
                              >
                                View Free Resource <ExternalLink className="w-3 h-3" />
                              </a>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SkillGapAnalysis;