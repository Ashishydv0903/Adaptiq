import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { AdaptIQLogo } from '../components/common/AdaptIQLogo';
import { MascotRobot } from '../components/mascot/MascotRobot';
import {
  Sparkles,
  ArrowRight,
  CheckCircle2,
  Code2,
  Layers,
  Terminal,
  Cpu,
  Award,
  Users,
  ShieldCheck,
  Zap,
  HelpCircle,
  MessageSquare,
  Play,
  ChevronDown,
  Activity,
  GitBranch,
  Eye,
  FileCheck2,
  Scale,
  BrainCircuit,
  Sliders,
  ExternalLink
} from 'lucide-react';
import { Button, Card, Badge } from '../components/ui';

export const LandingPage = () => {
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Dynamic platform statistics with curated build-time seed fallbacks
  const [stats, setStats] = useState({
    questionsCount: 160,
    skillsCount: 84,
    tracksCount: 7,
    roundsCount: 5
  });

  // "See it in action" active screenshot tab
  const [activeScreenshotTab, setActiveScreenshotTab] = useState('interview');

  // FAQ accordion state
  const [openFaq, setOpenFaq] = useState(null);

  // Contact email from env var or clean placeholder
  const contactEmail = import.meta.env.VITE_CONTACT_EMAIL || 'team@adaptiq.dev';

  useEffect(() => {
    let isMounted = true;
    axios
      .get('/api/public/stats')
      .then((res) => {
        if (isMounted && res.data?.success && res.data?.data) {
          setStats((prev) => ({
            ...prev,
            questionsCount: res.data.data.questionsCount || prev.questionsCount,
            skillsCount: res.data.data.skillsCount || prev.skillsCount,
            tracksCount: res.data.data.tracksCount || prev.tracksCount,
            roundsCount: res.data.data.roundsCount || prev.roundsCount
          }));
        }
      })
      .catch(() => {
        // Retain build-time seed defaults
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const handleStartPractice = () => {
    if (isAuthenticated) {
      navigate('/candidate/dashboard');
    } else {
      navigate('/register');
    }
  };

  const audienceCards = [
    {
      role: 'Candidate',
      badge: 'Job Seekers & Students',
      title: 'Practice with Real Pacing & Evidence',
      description:
        'Engage in adaptive technical interview stages tailored to your target job. Receive transparent score breakdowns with direct evidence excerpts and a topological skill-gap roadmap.',
      icon: <Users className="w-6 h-6 text-[#52D68A]" />,
      actionText: 'Start Free Assessment',
      actionPath: '/register'
    },
    {
      role: 'Recruiter',
      badge: 'Hiring Teams & Interviewers',
      title: 'Live Proctoring & Tamper-Proof Audits',
      description:
        'Monitor active candidate assessments with real-time WebRTC streams, client-side computer vision telemetry, and immutable audit logs that automatically flag security anomalies.',
      icon: <Eye className="w-6 h-6 text-[#38BDF8]" />,
      actionText: 'Recruiter Portal',
      actionPath: '/login'
    },
    {
      role: 'Admin / Institution',
      badge: 'Academic & Enterprise',
      title: 'Psychometrics, Item Response & Fairness',
      description:
        'Calibrate question difficulty with 3PL Item Response Theory, audit demographic parity across cohorts with Disparate Impact Ratio (DIR), and inspect system health.',
      icon: <Scale className="w-6 h-6 text-[#A78BFA]" />,
      actionText: 'Admin Dashboard',
      actionPath: '/login'
    }
  ];

  const featureBlocks = [
    {
      id: 'irt',
      title: 'Adaptive IRT Engine',
      subtitle: 'Dynamic 3-Parameter Logistic Calibrations',
      description:
        'Rather than fixed linear tests, AdaptIQ models candidate proficiency (θ) using Item Response Theory. Questions dynamically adapt in difficulty (b), discrimination (a), and guessing pseudo-chance (c) to measure true competency in fewer questions.',
      icon: <BrainCircuit className="w-6 h-6 text-[#52D68A]" />,
      badge: 'Psychometric Precision'
    },
    {
      id: 'shap',
      title: 'Explainable Scoring with SHAP',
      subtitle: 'Direct Evidence Excerpts & Counterfactuals',
      description:
        'Zero black-box decisions. Every evaluation is broken down into SHAP feature attributions with exact quotation verification. If a score has room for improvement, actionable counterfactual guidance tells the candidate what points would be gained.',
      icon: <Sliders className="w-6 h-6 text-[#38BDF8]" />,
      badge: 'Interpretable AI'
    },
    {
      id: 'proctoring',
      title: 'Client-Side AI Proctoring',
      subtitle: 'Real Computer Vision with Policy Escalation',
      description:
        'Runs MediaPipe Face Mesh, head-pose yaw/pitch estimation, and COCO-SSD object detection locally in the candidate browser. Repeated infractions escalate to red alerts with rolling video buffer storage.',
      icon: <ShieldCheck className="w-6 h-6 text-[#F59E0B]" />,
      badge: 'Zero-Latency Vision'
    },
    {
      id: 'dag',
      title: 'Skill-Gap Graph & Roadmap',
      subtitle: 'Directed Acyclic Graph (DAG) Prerequisites',
      description:
        'Identified knowledge gaps are mapped against an 84-node skill dependency graph. Topological sorting structures a sequential learning roadmap with curated resources so candidates know what to master first.',
      icon: <GitBranch className="w-6 h-6 text-[#10B981]" />,
      badge: 'Topological Learning'
    },
    {
      id: 'fairness',
      title: 'Fairness & Audit Trail',
      subtitle: 'Demographic Parity & Differential Item Functioning',
      description:
        'Built-in psychometric fairness routines test for Differential Item Functioning (DIF) to ensure questions exhibit equal difficulty across demographic cohorts, backed by tamper-evident append-only audit trails.',
      icon: <Scale className="w-6 h-6 text-[#8B5CF6]" />,
      badge: 'Ethical & Compliant'
    }
  ];

  const screenshots = {
    interview: {
      title: 'Monaco Code Runner & WebRTC Video',
      subtitle: 'Stage 2 & 3 • Full-Screen Sandboxed Coding with Real-Time Proctoring',
      image: '/screenshots/interview-room.svg',
      description:
        'Real-time execution in Judge0 CE sandbox with memory and time benchmarks, paired with non-intrusive client-side face landmark mesh monitoring.'
    },
    feedback: {
      title: 'Explainable Feedback Modal',
      subtitle: 'SHAP Feature Attributions & Direct Answer Verification',
      image: '/screenshots/explainable-feedback.svg',
      description:
        'Transparent multi-dimensional score breakdown. Hallucinated quotes are strictly discarded, and counterfactual suggestions show exactly how to improve.'
    },
    recruiter: {
      title: 'Recruiter Command Center',
      subtitle: 'Real-Time Proctor Alerts & Append-Only Audit Trail',
      image: '/screenshots/recruiter-monitor.svg',
      description:
        'Live multi-candidate surveillance grid displaying head-pose telemetry, focus retention percentages, and automated escalation to red alerts.'
    },
    roadmap: {
      title: 'Skill-Gap Dependency DAG',
      subtitle: 'Interactive Prerequisite Graph & Step-by-Step Study Plan',
      image: '/screenshots/skill-gap-graph.svg',
      description:
        'Visualizes skill mastery and prerequisite relations, generating a step-by-step sequential learning schedule to close skill gaps.'
    }
  };

  const faqs = [
    {
      q: 'How does AdaptIQ calibrate question difficulty during the interview?',
      a: 'AdaptIQ uses psychometric Item Response Theory (3PL IRT). Each question possesses calibrated parameters for difficulty, discrimination, and guessing. After each answer, the engine updates your latent competency estimate (θ) to pick the most informative next question.'
    },
    {
      q: 'How does the proctoring system protect candidate privacy?',
      a: 'All computer vision models (MediaPipe Face Mesh and COCO-SSD) execute locally in your web browser via WebAssembly and WebGL. Biometric facial descriptors are encrypted client-side using AES-256 before transmission. Video buffers are only stored if an escalation occurs.'
    },
    {
      q: 'What makes AdaptIQ feedback explainable instead of a black box?',
      a: 'Evaluations combine multi-dimensional rubric scoring with SHAP feature attributions. Every dimension score is linked to verified verbatim quotes from your answer, along with counterfactual hints that explain the missing details needed to earn full marks.'
    },
    {
      q: 'Can candidates practice freely without recruiter observation?',
      a: 'Yes. In candidate practice mode, your sessions are private learning sandboxes. You can test your skills across frontend, backend, systems, and algorithms, review your plain-English gaps, and prepare at your own pace.'
    },
    {
      q: 'How does AdaptIQ ensure fairness across demographic cohorts?',
      a: 'The platform integrates automated Differential Item Functioning (DIF) and Disparate Impact Ratio (DIR) calculations. Questions that display statistically significant score disparities across protected classes are flagged in the admin panel for calibration.'
    }
  ];

  return (
    <div className="min-h-screen bg-[#0B192C] text-white flex flex-col selection:bg-[#52D68A] selection:text-[#0B192C] font-sans">
      {/* ================= HERO SECTION ================= */}
      <section className="relative overflow-hidden bg-[#0B192C] pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-[#1B3A60]/60">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#52D68A]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Heading, Subtitle, and CTAs */}
            <div className="lg:col-span-7 space-y-8 text-left">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#0F2238] border border-[#1B3A60] text-xs font-semibold text-[#52D68A]">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next-Generation Technical Assessment</span>
              </div>

              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.12] font-display">
                Adaptive Technical Interviews with <br className="hidden sm:inline" />
                <span className="text-[#52D68A]">Explainable AI</span> Feedback
              </h1>

              <p className="text-base sm:text-lg text-slate-300 font-normal max-w-xl leading-relaxed">
                Calibrated to your exact latent competency using Item Response Theory. Backed by real-time computer vision proctoring and evidence-grounded skill gap roadmaps.
              </p>

              {/* CTAs */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <Button
                  size="lg"
                  variant="primary"
                  onClick={handleStartPractice}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Start Assessment
                </Button>

                <Button
                  size="lg"
                  variant="secondary"
                  onClick={() => {
                    const el = document.getElementById('demo-strip');
                    el?.scrollIntoView({ behavior: 'smooth' });
                  }}
                  leftIcon={<Play className="w-4 h-4 text-[#52D68A]" />}
                >
                  See it in Action
                </Button>
              </div>

              {/* Verified Trust Badges */}
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>3PL IRT Adaptive Pacing</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>SHAP Explainable Feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>Client-Side Vision Proctor</span>
                </div>
              </div>
            </div>

            {/* Right Column: AdaptIQ Robot Mascot */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[420px] sm:max-w-[460px]">
                <MascotRobot className="w-full h-auto transform hover:scale-[1.02] transition-transform duration-300" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= REAL PLATFORM STATS STRIP ================= */}
      <section className="bg-[#0F2238] border-b border-[#1B3A60] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#52D68A] font-mono">
                {stats.questionsCount}+
              </div>
              <div className="text-xs sm:text-sm text-slate-300 font-medium">Curated Technical Items</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {stats.skillsCount}+
              </div>
              <div className="text-xs sm:text-sm text-slate-300 font-medium">Mapped Competencies</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#52D68A] font-mono">
                {stats.tracksCount}
              </div>
              <div className="text-xs sm:text-sm text-slate-300 font-medium">Engineering Role Tracks</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white font-mono">
                {stats.roundsCount}
              </div>
              <div className="text-xs sm:text-sm text-slate-300 font-medium">Evaluation Stages</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= THREE AUDIENCE CARDS ================= */}
      <section className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <Users className="w-3.5 h-3.5" />
              <span>Tailored for Every Stakeholder</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-display">
              Built for Candidates, Recruiters &amp; Leadership
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              One unified platform delivering transparency, security, and psychometric rigor.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {audienceCards.map((card, idx) => (
              <Card
                key={idx}
                hover
                className="flex flex-col justify-between p-6 sm:p-8 space-y-6"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-[#0B192C] border border-[#1B3A60]">
                      {card.icon}
                    </div>
                    <Badge variant="neutral" size="sm">
                      {card.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-xl font-bold text-white">{card.role}</h3>
                    <h4 className="text-sm font-semibold text-[#52D68A] mt-1">{card.title}</h4>
                    <p className="text-xs sm:text-sm text-slate-300 mt-2.5 leading-relaxed">
                      {card.description}
                    </p>
                  </div>
                </div>

                <div className="pt-4 border-t border-[#1B3A60]/60">
                  <Link to={card.actionPath}>
                    <Button variant="outline" size="sm" className="w-full justify-between">
                      <span>{card.actionText}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </Button>
                  </Link>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* ================= FIVE CORE FEATURE BLOCKS ================= */}
      <section className="py-20 bg-[#0F2238] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <Cpu className="w-3.5 h-3.5" />
              <span>Core Architecture</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-display">
              Five Architectural Innovations
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Engineered from first principles to replace subjective guesswork with empirical science.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {featureBlocks.map((feat) => (
              <div
                key={feat.id}
                className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-6 sm:p-7 flex flex-col justify-between hover:border-[#52D68A]/60 transition-all group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60] group-hover:border-[#52D68A]/40 transition">
                      {feat.icon}
                    </div>
                    <Badge variant="default" size="sm">
                      {feat.badge}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#52D68A] transition font-display">
                      {feat.title}
                    </h3>
                    <div className="text-xs font-semibold text-slate-400 mt-1">
                      {feat.subtitle}
                    </div>
                    <p className="text-xs text-slate-300 mt-2.5 leading-relaxed">
                      {feat.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= SEE IT IN ACTION STRIP ================= */}
      <section id="demo-strip" className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-3xl mx-auto mb-12 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <Eye className="w-3.5 h-3.5" />
              <span>Live Application Showcase</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-display">
              See AdaptIQ in Action
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Explore the real application interfaces captured from live seeded interview sessions.
            </p>
          </div>

          {/* Interactive Showcase Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mb-8">
            <button
              onClick={() => setActiveScreenshotTab('interview')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeScreenshotTab === 'interview'
                  ? 'bg-[#52D68A] text-[#0B192C] font-bold shadow-md'
                  : 'bg-[#0F2238] text-slate-300 border border-[#1B3A60] hover:text-white'
              }`}
            >
              1. Adaptive Interview &amp; Runner
            </button>
            <button
              onClick={() => setActiveScreenshotTab('feedback')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeScreenshotTab === 'feedback'
                  ? 'bg-[#52D68A] text-[#0B192C] font-bold shadow-md'
                  : 'bg-[#0F2238] text-slate-300 border border-[#1B3A60] hover:text-white'
              }`}
            >
              2. Explainable SHAP Feedback
            </button>
            <button
              onClick={() => setActiveScreenshotTab('recruiter')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeScreenshotTab === 'recruiter'
                  ? 'bg-[#52D68A] text-[#0B192C] font-bold shadow-md'
                  : 'bg-[#0F2238] text-slate-300 border border-[#1B3A60] hover:text-white'
              }`}
            >
              3. Recruiter Live Command Center
            </button>
            <button
              onClick={() => setActiveScreenshotTab('roadmap')}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold transition ${
                activeScreenshotTab === 'roadmap'
                  ? 'bg-[#52D68A] text-[#0B192C] font-bold shadow-md'
                  : 'bg-[#0F2238] text-slate-300 border border-[#1B3A60] hover:text-white'
              }`}
            >
              4. Skill-Gap DAG &amp; Roadmap
            </button>
          </div>

          {/* Active View Display */}
          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-3xl overflow-hidden shadow-2xl">
            <div className="p-4 sm:p-5 bg-[#0B192C] border-b border-[#1B3A60] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base sm:text-lg font-bold text-white">
                  {screenshots[activeScreenshotTab].title}
                </h3>
                <p className="text-xs text-slate-400">
                  {screenshots[activeScreenshotTab].subtitle}
                </p>
              </div>
              <Badge variant="default" size="sm">
                Live App Snapshot
              </Badge>
            </div>

            <div className="p-4 sm:p-6 bg-[#07101B]">
              <img
                src={screenshots[activeScreenshotTab].image}
                alt={screenshots[activeScreenshotTab].title}
                className="w-full h-auto rounded-xl border border-[#1B3A60]/80 shadow-inner"
              />
            </div>

            <div className="p-4 sm:p-5 bg-[#0F2238] border-t border-[#1B3A60] text-xs sm:text-sm text-slate-300">
              {screenshots[activeScreenshotTab].description}
            </div>
          </div>
        </div>
      </section>

      {/* ================= FAQ SECTION ================= */}
      <section className="py-20 bg-[#0F2238] border-b border-[#1B3A60]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Common Inquiries</span>
            </div>
            <h2 className="text-3xl font-bold text-white tracking-tight font-display">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-300">
              Everything you need to know about preparing and assessing with AdaptIQ.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-[#0B192C] border border-[#1B3A60] rounded-xl overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-5 flex items-center justify-between text-sm sm:text-base font-semibold text-white hover:text-[#52D68A] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52D68A]"
                >
                  <span>{faq.q}</span>
                  <ChevronDown
                    className={`w-4 h-4 text-slate-400 transition-transform duration-200 ${
                      openFaq === index ? 'transform rotate-180 text-[#52D68A]' : ''
                    }`}
                  />
                </button>
                {openFaq === index && (
                  <div className="px-5 pb-5 pt-1 text-xs sm:text-sm text-slate-300 border-t border-[#1B3A60]/40 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= CONTACT SECTION ================= */}
      <section id="contact" className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>Project &amp; Team Contact</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight font-display">
            Have Questions or Need an Enterprise Pilot?
          </h2>

          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Reach out to our engineering team regarding campus licenses, custom psychometric calibrations, or platform feedback.
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href={`mailto:${contactEmail}`}
              className="px-6 py-3 rounded-xl bg-[#52D68A] hover:bg-[#42C378] text-[#0B192C] font-semibold text-sm transition shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#52D68A]"
            >
              Email {contactEmail}
            </a>
            <Button
              variant="secondary"
              onClick={handleStartPractice}
            >
              Launch Assessment Portal
            </Button>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-[#07101B] py-12 text-slate-400 text-xs border-t border-[#1B3A60]/40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <AdaptIQLogo size={28} iconColor="#52D68A" eyeColor="#07101B" />
            <span className="text-white font-bold text-base tracking-tight font-display">AdaptIQ</span>
            <span className="text-[11px] text-slate-500">· Transparent Technical Assessments</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <a href="#demo-strip" className="hover:text-[#52D68A] transition">Showcase</a>
            <a href="#contact" className="hover:text-[#52D68A] transition">Contact</a>
            <Link to="/login" className="hover:text-[#52D68A] transition">Sign In</Link>
            <Link to="/register" className="hover:text-[#52D68A] transition">Register</Link>
          </div>

          <div className="text-slate-500 text-[11px]">
            &copy; {new Date().getFullYear()} AdaptIQ Platform. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
