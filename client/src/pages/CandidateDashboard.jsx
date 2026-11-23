import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../services/api';
import {
  FileText,
  Compass,
  Award,
  CheckCircle2,
  ChevronRight,
  Zap,
  Sparkles,
  Shield,
  BookOpen,
  Target,
  Upload,
  AlertCircle,
  ArrowRight,
  Terminal,
  Check,
  TrendingUp,
  Lightbulb,
  Layers,
  Code2,
  Cpu,
  Play,
  Clock,
  History
} from 'lucide-react';

export const CandidateDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Resume & JD State
  const [resumeText, setResumeText] = useState('');
  const [resumeFileName, setResumeFileName] = useState('');
  const [resumeUpdatedAt, setResumeUpdatedAt] = useState(null);
  const [jdText, setJdText] = useState('');
  const [saveSuccessMsg, setSaveSuccessMsg] = useState('');

  // Resume Scoring Dashboard State
  const [scoringLoading, setScoringLoading] = useState(false);
  const [resumeScoreResult, setResumeScoreResult] = useState(null);

  // Interview Launch State
  const [startingTargeted, setStartingTargeted] = useState(false);
  const [startingTrack, setStartingTrack] = useState(null);
  const [targetedError, setTargetedError] = useState('');

  // Past Sessions History State
  const [pastSessions, setPastSessions] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  // Load saved resume and past sessions from database on mount
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoadingHistory(true);
        const [resumeRes, historyRes] = await Promise.allSettled([
          api.get('/users/resume'),
          api.get('/sessions/my/history')
        ]);

        if (resumeRes.status === 'fulfilled' && resumeRes.value?.data?.data) {
          const { resumeText: savedText, resumeFileName: savedName, resumeUpdatedAt: savedDate, savedJDText } = resumeRes.value.data.data;
          if (savedText) {
            setResumeText(savedText);
            setResumeFileName(savedName || 'saved_resume.txt');
            setResumeUpdatedAt(savedDate);
          }
          if (savedJDText) {
            setJdText(savedJDText);
          }
        }

        if (historyRes.status === 'fulfilled' && historyRes.value?.data?.data?.sessions) {
          setPastSessions(historyRes.value.data.data.sessions);
        }
      } catch (err) {
        console.warn('Dashboard data fetch warning:', err.message);
      } finally {
        setLoadingHistory(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Save/Replace resume in database
  const saveResumeToDatabase = async (text, fileName = '') => {
    try {
      const res = await api.post('/users/resume', {
        resumeText: text,
        resumeFileName: fileName || resumeFileName || 'resume.txt',
        savedJDText: jdText
      });
      if (res.data?.data) {
        setResumeUpdatedAt(res.data.data.resumeUpdatedAt);
        setSaveSuccessMsg('Resume saved to your account');
        setTimeout(() => setSaveSuccessMsg(''), 4000);
      }
    } catch (err) {
      console.warn('Failed to save resume:', err.message);
    }
  };

  // Upload new resume file and replace old one (supports PDF, DOCX, and TXT)
  const handleResumeFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setResumeFileName(file.name);
    setTargetedError('');

    const isBinaryDoc =
      file.name.toLowerCase().endsWith('.pdf') ||
      file.name.toLowerCase().endsWith('.docx') ||
      file.type === 'application/pdf' ||
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

    if (isBinaryDoc) {
      try {
        const formData = new FormData();
        formData.append('resume', file);
        const res = await api.post('/skills/resume-parse', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        const extracted = res.data?.data?.extractedText || res.data?.data?.extraction?.summary || '';
        if (extracted) {
          setResumeText(extracted);
          await saveResumeToDatabase(extracted, file.name);
          return;
        }
      } catch (err) {
        console.warn('Server resume parse fallback to FileReader:', err.message);
      }
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target.result;
      if (typeof text === 'string') {
        setResumeText(text);
        saveResumeToDatabase(text, file.name);
      }
    };
    reader.readAsText(file);
  };

  // Human, realistic example templates
  const handleFillSampleResume = () => {
    const sample = `Ada Lovelace - Fullstack Software Developer
Email: ada.lovelace@example.com | Portfolio: github.com/adalovelace

SUMMARY:
Software developer with practical experience building modern web applications using React, Node.js, Express, and MongoDB. Strong grasp of programming fundamentals, REST APIs, and core data structures.

KEY PROJECTS:
1. Campus Marketplace & Delivery Service:
   - Developed full-stack web application with React frontend and Express REST API backend.
   - Built shopping cart, order placement, and user authentication using JWT and bcrypt.
   - Structured MongoDB database schemas for fast product catalog filtering and search.
2. Real-Time Chat & Collaboration App:
   - Created multi-room messaging platform using WebSockets (Socket.io) and Node.js.
   - Handled active connection heartbeats, user presence, and persistent chat logs.

TECHNICAL SKILLS:
- Languages: JavaScript (ES6+), TypeScript, Python, HTML5, CSS3
- Frameworks & Tools: React, Node.js, Express, Tailwind CSS, Git, Docker
- Databases: MongoDB, PostgreSQL, Redis`;
    setResumeText(sample);
    setResumeFileName('ada_lovelace_resume.txt');
    saveResumeToDatabase(sample, 'ada_lovelace_resume.txt');
    setTargetedError('');
  };

  const handleFillSampleJD = () => {
    const sampleJD = `Role: Junior / Associate Software Engineer
Company: NextGen Cloud Solutions
Location: Remote / Hybrid

ABOUT THE ROLE:
We are looking for an energetic software engineer to join our engineering team. You will build clean user interfaces, develop backend REST endpoints, and participate in collaborative code reviews.

WHAT WE LOOK FOR:
- Solid programming fundamentals in JavaScript, TypeScript, or Python.
- Practical experience with modern frontend frameworks (React, Vue) and backend runtimes (Node.js/Express).
- Fundamental understanding of web architecture (HTTP methods, REST APIs, client-server flow).
- Familiarity with database storage (SQL vs NoSQL) and basic algorithmic problem solving (Arrays, Strings, HashMaps).
- Good communication skills and ability to walk through past projects.`;
    setJdText(sampleJD);
    setTargetedError('');
  };

  // Score Resume against Job Description
  const handleScoreResumeAgainstJD = async () => {
    if (!resumeText.trim() && !jdText.trim()) {
      setTargetedError('Please provide your resume, a job description, or both to run the match score.');
      return;
    }

    setScoringLoading(true);
    setTargetedError('');
    try {
      const res = await api.post('/skills/score-resume-jd', {
        resumeText: resumeText.trim(),
        jdText: jdText.trim()
      });
      if (res.data?.data) {
        setResumeScoreResult(res.data.data);
      }
    } catch (err) {
      setTargetedError(err.response?.data?.message || 'Failed to score resume against job description.');
    } finally {
      setScoringLoading(false);
    }
  };

  // Start Real-Job Interview (AI Proctored)
  const handleStartInterview = async (e) => {
    if (e) e.preventDefault();
    if (!resumeText.trim() && !jdText.trim()) {
      setTargetedError('Please provide your resume, a job description, or both to conduct your interview.');
      return;
    }

    setStartingTargeted(true);
    setTargetedError('');

    // Ensure latest resume is persisted
    if (resumeText.trim()) {
      await saveResumeToDatabase(resumeText.trim(), resumeFileName);
    }

    try {
      const res = await api.post('/sessions/start-targeted', {
        resumeText: resumeText.trim(),
        jdText: jdText.trim(),
        isProctored: true
      });
      const sessionId = res.data.data.session.id || res.data.data.session._id;
      localStorage.setItem('adaptiq_last_session', sessionId);
      // Resume-based interview is strictly proctored: route through device check and face enrolment gatekeeper
      navigate(`/interview/${sessionId}/system-check`);
    } catch (err) {
      setTargetedError(err.response?.data?.message || 'Failed to start tailored interview session.');
    } finally {
      setStartingTargeted(false);
    }
  };

  // Start Prebuilt Track Practice (Unproctored)
  const handleStartTrackPractice = async (trackKey) => {
    try {
      setStartingTrack(trackKey);
      const res = await api.post('/sessions/start', {
        track: trackKey,
        isProctored: false
      });
      const sessionId = res.data.data.session.id || res.data.data.session._id;
      localStorage.setItem('adaptiq_last_session', sessionId);
      // Practice tracks navigate directly to interview without proctoring/face checks
      navigate(`/interview/${sessionId}`);
    } catch (err) {
      console.error('Failed to start track practice:', err);
      alert(err.response?.data?.message || 'Could not start practice track session.');
    } finally {
      setStartingTrack(null);
    }
  };

  const prebuiltTracks = [
    {
      id: 'fullstack',
      trackKey: 'fullstack',
      title: 'Full-Stack Engineering',
      icon: <Layers className="w-6 h-6 text-[#52D68A]" />,
      description: 'React, Node.js, Express REST APIs, and database fundamentals. Perfect for all-round web developers.',
      topics: ['Variables & Scope', 'Express Routes', 'HTTP GET vs POST', 'SQL vs NoSQL'],
      level: 'All Levels'
    },
    {
      id: 'frontend',
      trackKey: 'frontend',
      title: 'Frontend Mastery',
      icon: <Code2 className="w-6 h-6 text-[#52D68A]" />,
      description: 'Modern JavaScript, UI components, state management, CSS layouts, and web performance.',
      topics: ['DOM & Events', 'Component State', 'Tailwind & Flexbox', 'Async Fetching'],
      level: 'Beginner to Advanced'
    },
    {
      id: 'backend',
      trackKey: 'backend',
      title: 'Backend & Systems',
      icon: <Terminal className="w-6 h-6 text-[#52D68A]" />,
      description: 'Server architecture, API design, data storage, middleware, and backend fundamentals.',
      topics: ['REST APIs', 'Database Storage', 'Middleware', 'Error Handling'],
      level: 'Intermediate'
    },
    {
      id: 'algorithms',
      trackKey: 'fullstack',
      title: 'Algorithms & Data Structures',
      icon: <Cpu className="w-6 h-6 text-[#52D68A]" />,
      description: 'Master arrays, strings, two pointers, and beginner coding problem-solving step-by-step.',
      topics: ['Two Sum', 'Palindrome Strings', 'Array Loops', 'Time Complexity'],
      level: 'Core Fundamentals'
    },
    {
      id: 'behavioral',
      trackKey: 'fullstack',
      title: 'Behavioral & Projects',
      icon: <Award className="w-6 h-6 text-[#52D68A]" />,
      description: 'Master project walkthroughs, overcoming challenges, and communicating effectively using the STAR framework.',
      topics: ['Project Overview', 'Technical Hurdles', 'Team Collaboration', 'Impact'],
      level: 'Essential For All'
    }
  ];

  // Determine current mode label
  const getModeLabel = () => {
    if (resumeText.trim() && jdText.trim()) {
      return {
        badge: 'Tailored to Resume + Job Description • Proctored',
        btnText: 'Start Proctored Interview (Resume & JD)',
        color: 'text-[#52D68A] bg-[#52D68A]/10 border-[#52D68A]/30'
      };
    }
    if (resumeText.trim()) {
      return {
        badge: 'Tailored to Your Resume Experience • Proctored',
        btnText: 'Start Proctored Interview based on Resume',
        color: 'text-amber-300 bg-amber-500/10 border-amber-500/30'
      };
    }
    if (jdText.trim()) {
      return {
        badge: 'Tailored to Target Job Description • Proctored',
        btnText: 'Start Proctored Interview based on JD',
        color: 'text-sky-300 bg-sky-500/10 border-sky-500/30'
      };
    }
    return {
      badge: 'Provide Resume or Job Description',
      btnText: 'Start Proctored Interview',
      color: 'text-slate-400 bg-slate-800 border-slate-700'
    };
  };

  const mode = getModeLabel();

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8 bg-[#0B192C] text-white">
      {/* Top Banner: Student Welcome & Live Stats */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 relative overflow-hidden shadow-xl space-y-5">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#52D68A]/15 border border-[#52D68A]/30 text-[#52D68A] text-xs font-bold">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive AI Interview Platform</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Welcome back, {user?.name || 'Candidate'}!
            </h1>
            <p className="text-slate-300 text-xs sm:text-sm max-w-2xl leading-relaxed">
              Practice real-world technical and behavioral interviews. Take an AI-proctored session tailored to your resume, or practice foundational topics in unproctored mode.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              onClick={() => navigate('/skills/gap-analysis')}
              className="px-4 py-2 bg-[#0B192C] hover:bg-[#132A46] text-[#52D68A] border border-[#52D68A]/40 font-semibold rounded-xl transition flex items-center gap-1.5 text-xs shadow-sm"
            >
              <Compass className="w-4 h-4 text-[#52D68A]" />
              <span>My Study Plan</span>
            </button>
          </div>
        </div>

        {/* Dynamic Candidate Quick Stats Bar */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2 border-t border-[#1B3A60]/60">
          <div className="bg-[#0B192C] p-3 rounded-2xl border border-[#1B3A60]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Interviews Taken</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-white mt-0.5 block">
              {pastSessions.length}
            </span>
          </div>

          <div className="bg-[#0B192C] p-3 rounded-2xl border border-[#1B3A60]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Best Score</span>
            <span className="text-lg sm:text-xl font-bold font-mono text-[#52D68A] mt-0.5 block">
              {pastSessions.length > 0 ? `${Math.max(...pastSessions.map((s) => s.score || 0))}%` : '—'}
            </span>
          </div>

          <div className="bg-[#0B192C] p-3 rounded-2xl border border-[#1B3A60]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Saved Resume</span>
            <span className="text-xs font-semibold text-slate-200 mt-1 block truncate" title={resumeFileName || 'None uploaded'}>
              {resumeFileName || (resumeText ? 'Resume on File' : 'None Uploaded')}
            </span>
          </div>

          <div className="bg-[#0B192C] p-3 rounded-2xl border border-[#1B3A60]">
            <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Status</span>
            <span className="text-xs font-semibold text-emerald-400 mt-1 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-[#52D68A] animate-pulse"></span>
              Interview Ready
            </span>
          </div>
        </div>
      </div>

      {/* ================= PRIMARY CARD: RESUME + JOB DESCRIPTION INTERVIEW SETUP ================= */}
      <div className="bg-[#0F2238] border-2 border-[#52D68A]/40 hover:border-[#52D68A] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl relative overflow-hidden transition-all">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${mode.color}`}>
                {mode.badge}
              </span>
              {saveSuccessMsg && (
                <span className="text-xs text-[#52D68A] font-semibold animate-fade-in flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> {saveSuccessMsg}
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Start Your Proctored Interview
            </h2>
            <p className="text-xs text-slate-300">
              Provide your resume, a job description, or both. Questions are dynamically generated to test your genuine technical background.
            </p>
          </div>

          {resumeUpdatedAt && (
            <div className="text-[11px] text-slate-400 bg-[#0B192C] px-3 py-1.5 rounded-xl border border-[#1B3A60]">
              Active Resume: <strong className="text-white">{resumeFileName || 'resume.txt'}</strong>
            </div>
          )}
        </div>

        {/* Input Columns */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pt-1">
          {/* Column 1: Resume */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-[#52D68A]" />
                <span>1. Your Resume & Experience</span>
              </label>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer text-[11px] font-semibold text-[#52D68A] hover:text-[#45C07A] flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#52D68A]/10 border border-[#52D68A]/20 transition">
                  <Upload className="w-3 h-3" />
                  <span>Upload (PDF, Word, TXT)</span>
                  <input
                    type="file"
                    accept=".txt,.pdf,.docx"
                    className="hidden"
                    onChange={handleResumeFileUpload}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleFillSampleResume}
                  className="text-[11px] text-slate-400 hover:text-slate-200 underline transition"
                >
                  Use Example
                </button>
              </div>
            </div>

            <textarea
              rows={8}
              value={resumeText}
              onChange={(e) => {
                setResumeText(e.target.value);
                saveResumeToDatabase(e.target.value);
              }}
              placeholder="Paste or upload your resume here...&#10;e.g.&#10;• Experience with React, Node.js, Express, MongoDB&#10;• Built a campus delivery app and real-time chat platform&#10;• Data Structures & Algorithms, RESTful APIs"
              className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] font-mono leading-relaxed transition-all resize-y"
            />
            <span className="text-[11px] text-slate-400">
              💡 Your resume is saved securely to your account so you don't have to re-upload each time.
            </span>
          </div>

          {/* Column 2: Job Description */}
          <div className="space-y-3 flex flex-col justify-between">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-200 flex items-center gap-1.5">
                <Terminal className="w-4 h-4 text-[#52D68A]" />
                <span>2. Target Job Description (Optional)</span>
              </label>

              <button
                type="button"
                onClick={handleFillSampleJD}
                className="text-[11px] text-slate-400 hover:text-slate-200 underline transition"
              >
                Use Example JD
              </button>
            </div>

            <textarea
              rows={8}
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              placeholder="Paste the job description from LinkedIn, Indeed, or your target company...&#10;e.g.&#10;Looking for a Software Engineer with experience in React, Node.js, and APIs. Good grasp of foundational algorithms."
              className="w-full bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#52D68A] focus:ring-1 focus:ring-[#52D68A] font-mono leading-relaxed transition-all resize-y"
            />
            <span className="text-[11px] text-slate-400">
              💡 Leave blank if you want an interview focused purely on your resume projects and general engineering basics.
            </span>
          </div>
        </div>

        {/* Error message */}
        {targetedError && (
          <div className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>{targetedError}</span>
          </div>
        )}

        {/* Action Buttons: Score Resume vs Launch Interview */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2 border-t border-[#1B3A60]">
          <button
            type="button"
            onClick={handleScoreResumeAgainstJD}
            disabled={scoringLoading || (!resumeText.trim() && !jdText.trim())}
            className="w-full sm:w-auto px-5 py-3 bg-[#0B192C] hover:bg-[#132A46] text-white border border-[#1B3A60] hover:border-[#52D68A] font-bold text-xs sm:text-sm rounded-2xl shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {scoringLoading ? (
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Target className="w-4 h-4 text-[#52D68A]" />
            )}
            <span>Score Resume against Job Description</span>
          </button>

          <div className="flex flex-col sm:flex-row items-center gap-3 w-full sm:w-auto justify-end">
            <div className="flex items-center gap-2 text-xs text-slate-300 bg-[#0B192C] px-3.5 py-2.5 rounded-xl border border-[#52D68A]/30 w-full sm:w-auto justify-center">
              <Shield className="w-4 h-4 text-[#52D68A]" />
              <span className="font-semibold text-[#52D68A]">AI Proctored Assessment</span>
              <span className="text-slate-400">• Camera & Face Monitored</span>
            </div>

            <button
              onClick={handleStartInterview}
              disabled={startingTargeted || (!resumeText.trim() && !jdText.trim())}
              className="w-full sm:w-auto px-8 py-3.5 bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-extrabold text-sm sm:text-base rounded-2xl shadow-xl shadow-[#52D68A]/20 hover:scale-[1.02] active:scale-[0.98] transition-all flex items-center justify-center gap-2.5 disabled:opacity-50"
            >
              {startingTargeted ? (
                <>
                  <div className="w-5 h-5 border-2 border-[#0B192C] border-t-transparent rounded-full animate-spin" />
                  <span>Preparing Proctored Interview...</span>
                </>
              ) : (
                <>
                  <Shield className="w-5 h-5" />
                  <span>{mode.btnText}</span>
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* ================= RESUME VS. JOB DESCRIPTION SCORING DASHBOARD ================= */}
      {resumeScoreResult && (
        <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 space-y-6 shadow-2xl animate-fade-in">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-[#1B3A60]">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20 text-xs font-bold">
                <Target className="w-3.5 h-3.5" /> Resume Match Report
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
                Resume Scoring & Topic Fit
              </h2>
              <p className="text-xs text-slate-300">
                Here is how well your resume matches the job description, with plain-English topics that are strong vs. weak.
              </p>
            </div>

            {/* Match Percentage Pill */}
            <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-4 text-center min-w-[150px] shadow-lg shrink-0">
              <span className="text-[10px] text-slate-400 uppercase font-semibold block">Resume Match Score</span>
              <div className="text-3xl sm:text-4xl font-mono font-bold text-[#52D68A] my-1">
                {resumeScoreResult.matchPercentage}%
              </div>
              <span className="text-[11px] font-bold text-[#52D68A] block">
                {resumeScoreResult.matchVerdict}
              </span>
            </div>
          </div>

          {/* Plain English Summary */}
          {resumeScoreResult.plainEnglishSummary && (
            <div className="p-4 rounded-2xl bg-[#0B192C] border border-[#1B3A60] text-xs sm:text-sm text-slate-200 leading-relaxed">
              💡 <strong>Summary:</strong> {resumeScoreResult.plainEnglishSummary}
            </div>
          )}

          {/* Side-by-Side: Strong Topics vs. Weak Topics */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* STRONG TOPICS */}
            <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-[#52D68A] pb-2 border-b border-[#1B3A60]">
                <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  These Topics are Strong ({resumeScoreResult.strongTopics?.length || 0})
                </h3>
              </div>

              {resumeScoreResult.strongTopics?.length > 0 ? (
                <ul className="space-y-2.5">
                  {resumeScoreResult.strongTopics.map((t, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-[#0F2238] border border-[#52D68A]/30 text-xs text-slate-200 space-y-1"
                    >
                      <div className="font-bold text-white flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-[#52D68A]" />
                        <span>{t.topic}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed pl-3.5">
                        {t.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 p-2">No matching topics detected yet. Try adding key technologies to your resume.</p>
              )}
            </div>

            {/* WEAK TOPICS */}
            <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-amber-400 pb-2 border-b border-[#1B3A60]">
                <Lightbulb className="w-5 h-5 flex-shrink-0" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  These Topics to Review ({resumeScoreResult.weakTopics?.length || 0})
                </h3>
              </div>

              {resumeScoreResult.weakTopics?.length > 0 ? (
                <ul className="space-y-2.5">
                  {resumeScoreResult.weakTopics.map((t, idx) => (
                    <li
                      key={idx}
                      className="p-3 rounded-xl bg-[#0F2238] border border-amber-500/30 text-xs text-slate-200 space-y-1"
                    >
                      <div className="font-bold text-amber-300 flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-amber-400" />
                        <span>{t.topic}</span>
                      </div>
                      <p className="text-[11px] text-slate-300 leading-relaxed pl-3.5">
                        {t.reason}
                      </p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-xs text-slate-400 p-2">Great job! No major gaps detected between your resume and the JD.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ================= PREBUILT PRACTICE TRACKS (Restored from Landing Page) ================= */}
      <div className="space-y-4 pt-2">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-[#52D68A]" />
              Prebuilt Practice Interview Tracks
            </h2>
            <p className="text-xs text-slate-300">
              Practice foundational topics at your own pace. All prebuilt tracks run with <strong>proctoring disabled</strong> (no camera or face checks required).
            </p>
          </div>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20 self-start sm:self-auto">
            100% Free • Proctoring Off
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {prebuiltTracks.map((trk) => (
            <div
              key={trk.id}
              className="bg-[#0F2238] border border-[#1B3A60] hover:border-[#52D68A]/60 rounded-3xl p-6 flex flex-col justify-between space-y-5 transition-all shadow-xl hover:shadow-[#52D68A]/10 group"
            >
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="p-3 rounded-2xl bg-[#0B192C] border border-[#1B3A60] group-hover:border-[#52D68A]/40 transition">
                    {trk.icon}
                  </div>
                  <span className="text-[11px] font-semibold text-slate-400 bg-[#0B192C] px-2.5 py-1 rounded-full border border-[#1B3A60]">
                    {trk.level}
                  </span>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-white group-hover:text-[#52D68A] transition">
                    {trk.title}
                  </h3>
                  <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                    {trk.description}
                  </p>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  {trk.topics.map((tpc, i) => (
                    <span
                      key={i}
                      className="px-2 py-0.5 rounded-lg bg-[#0B192C] border border-[#1B3A60] text-[10px] text-slate-300 font-medium"
                    >
                      {tpc}
                    </span>
                  ))}
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => handleStartTrackPractice(trk.trackKey)}
                  disabled={startingTrack === trk.trackKey}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {startingTrack === trk.trackKey ? (
                    <>
                      <div className="w-3.5 h-3.5 border-2 border-[#0B192C] border-t-transparent rounded-full animate-spin" />
                      Starting Track...
                    </>
                  ) : (
                    <>
                      <Play className="w-3.5 h-3.5 fill-current" />
                      Start Practice (No Proctoring)
                    </>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ================= REAL RECENT INTERVIEWS HISTORY SECTION ================= */}
      <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl p-6 sm:p-8 space-y-5 shadow-2xl">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-[#1B3A60]">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <Award className="w-5 h-5 text-[#52D68A]" />
              Your Recent Interview Sessions
            </h2>
            <p className="text-xs text-slate-300">
              Track your past interview results, review AI feedback, and see your progress over time.
            </p>
          </div>

          {pastSessions.length > 0 && (
            <span className="text-xs font-semibold px-3 py-1 rounded-full bg-[#0B192C] text-slate-300 border border-[#1B3A60]">
              {pastSessions.length} Session{pastSessions.length === 1 ? '' : 's'} Recorded
            </span>
          )}
        </div>

        {loadingHistory ? (
          <div className="py-8 text-center text-slate-400 flex flex-col items-center justify-center gap-2">
            <div className="w-6 h-6 border-2 border-[#52D68A] border-t-transparent rounded-full animate-spin" />
            <span className="text-xs">Loading your interview history...</span>
          </div>
        ) : pastSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {pastSessions.map((sess) => {
              const formattedDate = sess.createdAt
                ? new Date(sess.createdAt).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  })
                : 'Recent';

              return (
                <div
                  key={sess.id}
                  className="bg-[#0B192C] border border-[#1B3A60] hover:border-[#52D68A]/50 rounded-2xl p-4 flex flex-col justify-between space-y-3 transition shadow-md"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider border ${
                            sess.isProctored
                              ? 'text-[#52D68A] bg-[#52D68A]/10 border-[#52D68A]/30'
                              : 'text-sky-400 bg-sky-500/10 border-sky-500/30'
                          }`}
                        >
                          {sess.isProctored ? 'AI Proctored' : 'Practice Track'}
                        </span>
                        <span className="text-[11px] text-slate-400">{formattedDate}</span>
                      </div>
                      <h3 className="text-sm font-bold text-white mt-1">
                        {sess.targetRole} {sess.targetCompany ? `• ${sess.targetCompany}` : ''}
                      </h3>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-base sm:text-lg font-mono font-bold text-[#52D68A]">
                        {sess.status === 'completed' ? `${sess.score}%` : 'In Progress'}
                      </span>
                      <span className="text-[10px] text-slate-400 block capitalize">
                        {sess.status.replace('_', ' ')}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-[#1B3A60]/60 text-xs">
                    <span className="text-slate-400 text-[11px]">
                      {sess.questionsAnswered} Question{sess.questionsAnswered === 1 ? '' : 's'} Answered
                    </span>
                    <button
                      onClick={() => navigate(`/interview/${sess.id}`)}
                      className="px-3 py-1.5 bg-[#0F2238] hover:bg-[#1B3A60] text-slate-200 hover:text-white font-semibold rounded-xl border border-[#1B3A60] transition flex items-center gap-1 text-[11px]"
                    >
                      <span>{sess.status === 'completed' ? 'View Report' : 'Continue'}</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-6 text-center space-y-3">
            <div className="w-10 h-10 rounded-xl bg-[#52D68A]/10 text-[#52D68A] flex items-center justify-center mx-auto border border-[#52D68A]/20">
              <Award className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-white">No interviews recorded yet</h3>
              <p className="text-xs text-slate-300 max-w-md mx-auto leading-relaxed">
                Start your first interview using your resume above or choose any practice track below. Your scores and personalized feedback will appear here.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CandidateDashboard;
