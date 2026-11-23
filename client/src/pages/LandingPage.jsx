import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { MascotRobot } from '../components/mascot/MascotRobot';
import { AdaptiveAILogo } from '../components/common/AdaptiveAILogo';
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
  Heart,
  ChevronDown
} from 'lucide-react';

export const LandingPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  // Mini Interactive Demo State
  const [selectedDemoAnswer, setSelectedDemoAnswer] = useState(null);
  const [demoFeedbackRevealed, setDemoFeedbackRevealed] = useState(false);

  // FAQ Accordion State
  const [openFaq, setOpenFaq] = useState(null);

  const toggleFaq = (index) => {
    setOpenFaq(openFaq === index ? null : index);
  };

  const tracks = [
    {
      id: 'fullstack',
      title: 'Full-Stack Engineering',
      icon: <Layers className="w-6 h-6 text-[#52D68A]" />,
      description: 'React, Node.js, REST APIs, and database fundamentals. Perfect for all-round web developers.',
      topics: ['React Hooks', 'Express APIs', 'Async/Await', 'SQL vs NoSQL'],
      level: 'All Levels'
    },
    {
      id: 'frontend',
      title: 'Frontend Mastery',
      icon: <Code2 className="w-6 h-6 text-[#52D68A]" />,
      description: 'Modern JavaScript, UI components, state management, CSS layouts, and web performance.',
      topics: ['DOM & Event Loop', 'State Optimization', 'Tailwind & Flexbox', 'Accessibility'],
      level: 'Beginner to Senior'
    },
    {
      id: 'backend',
      title: 'Backend & Systems',
      icon: <Terminal className="w-6 h-6 text-[#52D68A]" />,
      description: 'System design, server architecture, caching, microservices, and high-concurrency databases.',
      topics: ['System Design', 'Redis Caching', 'Database Indexing', 'API Security'],
      level: 'Intermediate to Advanced'
    },
    {
      id: 'algorithms',
      title: 'Algorithms & Data Structures',
      icon: <Cpu className="w-6 h-6 text-[#52D68A]" />,
      description: 'Master arrays, trees, dynamic programming, and binary search with step-by-step guidance.',
      topics: ['Two Pointers', 'Graph Traversal', 'Time Complexity', 'Recursion'],
      level: 'Core Fundamentals'
    },
    {
      id: 'behavioral',
      title: 'Behavioral & STAR Stories',
      icon: <Award className="w-6 h-6 text-[#52D68A]" />,
      description: 'Master leadership, conflict resolution, project triumphs, and teamwork questions using the STAR framework.',
      topics: ['Situation & Task', 'Action & Ownership', 'Measurable Results', 'Team Culture'],
      level: 'Essential For All'
    }
  ];

  const faqs = [
    {
      q: 'Is Adaptive AI completely free for students?',
      a: 'Yes! You can take unlimited mock interview sessions, review your plain-English feedback, and access your custom study plan without paying a cent.'
    },
    {
      q: 'How are questions chosen during my mock interview?',
      a: 'The platform starts with approachable questions and automatically adapts to your pace. If you answer easily, it challenges you further. If you find a topic tricky, it provides helpful hints and adjusts without penalizing you.'
    },
    {
      q: 'Will recruiters see my mistakes during practice mode?',
      a: 'No. Your mock interview sessions are 100% private sandbox environments. You can practice as many times as you like until you feel completely ready and confident.'
    },
    {
      q: 'How does the feedback work?',
      a: 'Instead of robotic scores or confusing math, Adaptive AI gives you plain-English pointers: exactly which topic you understand well, and a simple 2-point guide (The Gap & The Quick Fix) on what to review next.'
    }
  ];

  const handleStartPractice = () => {
    if (isAuthenticated) {
      navigate('/candidate/dashboard');
    } else {
      navigate('/register');
    }
  };

  return (
    <div className="min-h-screen bg-[#0B192C] text-white flex flex-col selection:bg-[#52D68A] selection:text-[#0B192C]">
      {/* ================= HERO SECTION (Matches Reference Photo Exactly) ================= */}
      <section className="relative overflow-hidden bg-[#0B192C] pt-12 pb-20 sm:pt-16 sm:pb-28 border-b border-[#1B3A60]/60">
        {/* Subtle background glow */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#52D68A]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-sky-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center">
            
            {/* Left Column: Heading, Subtitle, and Try It Free Pill Button */}
            <div className="lg:col-span-7 space-y-8 text-left">
              {/* Main Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.15]">
                Have your <br className="hidden sm:inline" />
                best Mock <br className="hidden sm:inline" />
                interview session
              </h1>

              {/* Subtitle */}
              <p className="text-base sm:text-lg text-slate-300 font-normal max-w-xl leading-relaxed">
                Ace Your Interviews with AI-Powered Practice Sessions.
              </p>

              {/* CTA Button & Highlights */}
              <div className="pt-2 flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <button
                  onClick={handleStartPractice}
                  className="px-8 py-3.5 rounded-full bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-semibold text-base sm:text-lg shadow-lg shadow-[#52D68A]/20 hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
                >
                  Try it Free
                </button>

                <div className="text-xs text-slate-400 flex items-center gap-2 pl-1">
                  <span className="w-2 h-2 rounded-full bg-[#52D68A] animate-pulse"></span>
                  <span>Instant access • No credit card needed</span>
                </div>
              </div>

              {/* Trust Checkmarks */}
              <div className="pt-4 grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs text-slate-300">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>Plain-English Feedback</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>Resume & JD Tailored</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#52D68A] flex-shrink-0" />
                  <span>Adaptive Questions</span>
                </div>
              </div>
            </div>

            {/* Right Column: Celebratory AI Robot Mascot with Confetti */}
            <div className="lg:col-span-5 flex justify-center lg:justify-end">
              <div className="w-full max-w-[420px] sm:max-w-[460px]">
                <MascotRobot className="w-full h-auto transform hover:scale-[1.03] transition-transform duration-300" />
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= SOCIAL PROOF & STATS STRIP ================= */}
      <section className="bg-[#0F2238] border-b border-[#1B3A60] py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#52D68A]">10,000+</div>
              <div className="text-xs sm:text-sm text-slate-300">Mock Sessions Completed</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">94%</div>
              <div className="text-xs sm:text-sm text-slate-300">Students Feel More Confident</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-[#52D68A]">100%</div>
              <div className="text-xs sm:text-sm text-slate-300">Plain English, No Jargon</div>
            </div>
            <div className="space-y-1">
              <div className="text-2xl sm:text-3xl font-extrabold text-white">0</div>
              <div className="text-xs sm:text-sm text-slate-300">Pressure • Practice Freely</div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= HOW IT WORKS (3 SIMPLE STEPS) ================= */}
      <section className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-16 space-y-3">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <Zap className="w-3.5 h-3.5" />
              <span>Easy 3-Step Flow</span>
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
              How Adaptive AI Works
            </h2>
            <p className="text-sm sm:text-base text-slate-300">
              Designed by students, for students. No robotic tests, just friendly and practical interview prep.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* Step 1 */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-6 sm:p-8 space-y-4 hover:border-[#52D68A]/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#52D68A]/10 border border-[#52D68A]/30 flex items-center justify-center text-[#52D68A] font-extrabold text-xl">
                1
              </div>
              <h3 className="text-xl font-bold text-white">Provide Resume or Job Description</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Paste your resume, a job description from LinkedIn/Indeed, or both. We save your resume in your profile and score your match immediately.
              </p>
            </div>

            {/* Step 2 */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-6 sm:p-8 space-y-4 hover:border-[#52D68A]/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#52D68A]/10 border border-[#52D68A]/30 flex items-center justify-center text-[#52D68A] font-extrabold text-xl">
                2
              </div>
              <h3 className="text-xl font-bold text-white">Live Monitored Practice</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                Practice in realistic conditions with camera on. Write your answers or dictate them naturally using real-time speech recognition.
              </p>
            </div>

            {/* Step 3 */}
            <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-6 sm:p-8 space-y-4 hover:border-[#52D68A]/50 transition-all">
              <div className="w-12 h-12 rounded-xl bg-[#52D68A]/10 border border-[#52D68A]/30 flex items-center justify-center text-[#52D68A] font-extrabold text-xl">
                3
              </div>
              <h3 className="text-xl font-bold text-white">Plain-English Feedback</h3>
              <p className="text-sm text-slate-300 leading-relaxed">
                No robotic statistics. In simple words, see exactly which topics are strong, which are weak, and where to focus next.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TAILORED REAL-JOB INTERVIEWS SECTION ================= */}
      <section id="interviews" className="py-20 bg-[#0F2238] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
                <Code2 className="w-3.5 h-3.5" />
                <span>Tailored Real-Job Interview Engine</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Interviews Tailored to Your Resume & Job Description
              </h2>
              <p className="text-sm text-slate-300 max-w-xl">
                No generic questionnaires. Adaptive AI tests your actual past projects, core systems concepts, and DSA algorithms.
              </p>
            </div>

            <button
              onClick={handleStartPractice}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-[#52D68A] text-[#0B192C] font-semibold text-sm hover:bg-[#45C07A] transition self-start md:self-auto"
            >
              Start Full Assessment <ArrowRight className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {tracks.map((track) => (
              <div
                key={track.id}
                className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-6 flex flex-col justify-between hover:border-[#52D68A] hover:shadow-lg hover:shadow-[#52D68A]/10 transition-all group"
              >
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="p-3 rounded-xl bg-[#0F2238] border border-[#1B3A60] group-hover:border-[#52D68A]/40 transition">
                      {track.icon}
                    </div>
                    <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-[#1B3A60] text-slate-200">
                      {track.level}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-bold text-white group-hover:text-[#52D68A] transition">
                      {track.title}
                    </h3>
                    <p className="text-xs text-slate-300 mt-1.5 leading-relaxed">
                      {track.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-1.5 pt-2">
                    {track.topics.map((t, i) => (
                      <span
                        key={i}
                        className="text-[11px] px-2 py-0.5 rounded-md bg-[#0F2238] text-slate-300 border border-[#1B3A60]"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="pt-6 mt-4 border-t border-[#1B3A60]/80">
                  <button
                    onClick={handleStartPractice}
                    className="w-full py-2.5 rounded-xl bg-[#0F2238] hover:bg-[#52D68A] text-slate-200 hover:text-[#0B192C] font-semibold text-xs transition-colors flex items-center justify-center gap-2 border border-[#1B3A60] hover:border-[#52D68A]"
                  >
                    <Play className="w-3.5 h-3.5" /> Practice this Track
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= INTERACTIVE MINI DEMO (Try a Question Right Here!) ================= */}
      <section className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-10">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Mini Sample</span>
            </div>
            <h2 className="text-3xl font-bold text-white">
              Try a Quick Sample Question
            </h2>
            <p className="text-sm text-slate-300">
              See firsthand how Adaptive AI explains technical concepts in plain, human English.
            </p>
          </div>

          <div className="bg-[#0F2238] border border-[#1B3A60] rounded-2xl p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Question Badge & Title */}
            <div>
              <span className="text-xs font-bold text-[#52D68A] tracking-wider uppercase">
                Frontend & React • Level 1
              </span>
              <h3 className="text-lg sm:text-xl font-bold text-white mt-1">
                "What happens when you update state in React using `useState`?"
              </h3>
            </div>

            {/* Options */}
            <div className="space-y-3">
              {[
                {
                  id: 'A',
                  text: 'It triggers a component re-render with the new state value in the virtual DOM.',
                  correct: true
                },
                {
                  id: 'B',
                  text: 'It immediately mutates the actual browser HTML document without React knowing.',
                  correct: false
                },
                {
                  id: 'C',
                  text: 'It resets all other components in the whole web app back to empty values.',
                  correct: false
                }
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setSelectedDemoAnswer(opt);
                    setDemoFeedbackRevealed(true);
                  }}
                  className={`w-full text-left p-4 rounded-xl border text-sm transition-all flex items-start gap-3 ${
                    selectedDemoAnswer?.id === opt.id
                      ? opt.correct
                        ? 'bg-[#52D68A]/15 border-[#52D68A] text-white font-medium'
                        : 'bg-rose-500/10 border-rose-500/40 text-rose-200'
                      : 'bg-[#0B192C] border-[#1B3A60] text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  <span className={`w-6 h-6 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                    selectedDemoAnswer?.id === opt.id && opt.correct
                      ? 'bg-[#52D68A] text-[#0B192C]'
                      : 'bg-[#1B3A60] text-slate-300'
                  }`}>
                    {opt.id}
                  </span>
                  <span>{opt.text}</span>
                </button>
              ))}
            </div>

            {/* Instant Plain-English Feedback Box */}
            {demoFeedbackRevealed && (
              <div className={`p-4 sm:p-5 rounded-xl border ${
                selectedDemoAnswer?.correct
                  ? 'bg-[#52D68A]/10 border-[#52D68A]/30 text-white'
                  : 'bg-amber-500/10 border-amber-500/30 text-amber-200'
              }`}>
                <div className="flex items-center gap-2 mb-2 font-bold text-sm">
                  {selectedDemoAnswer?.correct ? (
                    <>
                      <CheckCircle2 className="w-5 h-5 text-[#52D68A]" />
                      <span className="text-[#52D68A]">Spot on! Here is how our AI notes it:</span>
                    </>
                  ) : (
                    <>
                      <HelpCircle className="w-5 h-5 text-amber-400" />
                      <span className="text-amber-400">Close try! Here is the plain English breakdown:</span>
                    </>
                  )}
                </div>
                <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
                  <strong>The Concept:</strong> When you call <code className="text-[#52D68A] bg-[#0B192C] px-1 py-0.5 rounded">setState(newVal)</code>, React schedules a re-render so your screen updates automatically with the fresh data. You never touch the browser DOM manually!
                </p>
                <div className="mt-4 pt-3 border-t border-slate-700/50 flex items-center justify-between">
                  <span className="text-xs text-slate-400">Ready for the full adaptive experience?</span>
                  <button
                    onClick={handleStartPractice}
                    className="px-4 py-1.5 rounded-full bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-semibold text-xs transition"
                  >
                    Start Full Session
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= ABOUT SECTION ================= */}
      <section id="about" className="py-20 bg-[#0F2238] border-b border-[#1B3A60]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            <div className="lg:col-span-6 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>Our Philosophy</span>
              </div>
              <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
                Built to replace stressful interviews with confident learning.
              </h2>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Most interview prep sites feel like cold exam proctors. They give you vague rejection emails or intimidating mathematical formulas.
              </p>
              <p className="text-sm sm:text-base text-slate-300 leading-relaxed">
                Adaptive AI was built to be your encouraging sparring partner. It points out what you do right, highlights the exact topic to improve, and builds your confidence so you walk into real interviews with your head held high.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row gap-4">
                <div className="p-4 rounded-xl bg-[#0B192C] border border-[#1B3A60] flex-1">
                  <div className="text-[#52D68A] font-bold text-base mb-1">Fair & Unbiased</div>
                  <div className="text-xs text-slate-300">
                    Questions and feedback are checked for demographic fairness so everyone gets an equal opportunity.
                  </div>
                </div>
                <div className="p-4 rounded-xl bg-[#0B192C] border border-[#1B3A60] flex-1">
                  <div className="text-[#52D68A] font-bold text-base mb-1">Topic-Focused</div>
                  <div className="text-xs text-slate-300">
                    We tell you "Review Redis Caching" instead of just saying "Question #3 was incorrect".
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6">
              <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl p-6 sm:p-8 space-y-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-[#52D68A]" />
                  What Real Candidates Say
                </h3>

                <div className="space-y-4">
                  <div className="p-4 rounded-xl bg-[#0F2238] border border-[#1B3A60] space-y-2">
                    <p className="text-xs sm:text-sm text-slate-200 italic">
                      "I used to get terrified during live coding sessions. Adaptive AI gave me a safe place to practice talking through my thoughts without anyone judging me."
                    </p>
                    <div className="text-xs text-[#52D68A] font-semibold">
                      — Priya S., Junior Frontend Engineer
                    </div>
                  </div>

                  <div className="p-4 rounded-xl bg-[#0F2238] border border-[#1B3A60] space-y-2">
                    <p className="text-xs sm:text-sm text-slate-200 italic">
                      "The 2-point study plan on my skill gap dashboard was a game changer. I knew exactly which backend concepts to spend my weekend revising."
                    </p>
                    <div className="text-xs text-[#52D68A] font-semibold">
                      — Marcus K., Computer Science Graduate
                    </div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* ================= FAQ SECTION ================= */}
      <section className="py-20 bg-[#0B192C] border-b border-[#1B3A60]">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-3 mb-12">
            <h2 className="text-3xl font-bold text-white tracking-tight">
              Frequently Asked Questions
            </h2>
            <p className="text-sm text-slate-300">
              Everything you need to know about preparing with Adaptive AI.
            </p>
          </div>

          <div className="space-y-4">
            {faqs.map((faq, index) => (
              <div
                key={index}
                className="bg-[#0F2238] border border-[#1B3A60] rounded-xl overflow-hidden transition"
              >
                <button
                  onClick={() => toggleFaq(index)}
                  className="w-full text-left p-5 flex items-center justify-between text-sm sm:text-base font-semibold text-white hover:text-[#52D68A] transition"
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
      <section id="contact" className="py-20 bg-[#0F2238] border-b border-[#1B3A60]">
        <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center space-y-6">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/20">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>We Love Hearing From You</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">
            Have Questions or Want a Track Added?
          </h2>

          <p className="text-sm text-slate-300 max-w-xl mx-auto leading-relaxed">
            Whether you want specific interview questions for your dream company or want to give feedback on your session, drop us a line!
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-4">
            <a
              href="mailto:support@adaptiveai.io"
              className="px-6 py-3 rounded-full bg-[#52D68A] hover:bg-[#45C07A] text-[#0B192C] font-semibold text-sm transition shadow-md"
            >
              Email support@adaptiveai.io
            </a>
            <button
              onClick={handleStartPractice}
              className="px-6 py-3 rounded-full bg-[#0B192C] hover:bg-[#132A46] text-white border border-[#1B3A60] font-semibold text-sm transition"
            >
              Try Free Interview Now
            </button>
          </div>
        </div>
      </section>

      {/* ================= FOOTER ================= */}
      <footer className="bg-[#0B192C] py-12 text-slate-400 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-3">
            <AdaptiveAILogo size={28} iconColor="#52D68A" eyeColor="#0B192C" />
            <span className="text-white font-bold text-base tracking-tight">Adaptive AI</span>
            <span className="text-[11px] text-slate-500">· Practice with Confidence</span>
          </div>

          <div className="flex flex-wrap items-center gap-6 text-xs text-slate-300">
            <a href="#interviews" className="hover:text-[#52D68A] transition">Interviews</a>
            <a href="#about" className="hover:text-[#52D68A] transition">About</a>
            <a href="#contact" className="hover:text-[#52D68A] transition">Contact</a>
            <Link to="/login" className="hover:text-[#52D68A] transition">Sign In</Link>
          </div>

          <div className="text-slate-500 text-[11px]">
            &copy; {new Date().getFullYear()} Adaptive AI. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
