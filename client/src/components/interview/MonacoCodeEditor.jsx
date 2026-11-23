import React, { useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { api } from '../../services/api';
import {
  Play,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Sparkles,
  Clock,
  Cpu,
  Lock,
  Unlock,
  AlertTriangle,
  Code2,
  ChevronRight,
  Terminal,
  FileCode
} from 'lucide-react';

const LANGUAGE_CONFIGS = [
  { id: 'javascript', name: 'JavaScript (Node.js 20)', monacoLang: 'javascript' },
  { id: 'python', name: 'Python (3.11)', monacoLang: 'python' },
  { id: 'java', name: 'Java (OpenJDK 17)', monacoLang: 'java' },
  { id: 'cpp', name: 'C++ (GCC 13)', monacoLang: 'cpp' }
];

const DEFAULT_STARTER_CODES = {
  javascript: `/**
 * @param {any} input
 * @return {any}
 */
function solution(input) {
  // Write your optimal solution here
  return input;
}
`,
  python: `def solution(input_data):
    # Write your optimal solution here
    return input_data
`,
  java: `public class Solution {
    public static void main(String[] args) {
        // Solution implementation
    }
}
`,
  cpp: `#include <iostream>
#include <vector>
using namespace std;

int main() {
    // Solution implementation
    return 0;
}
`
};

export const MonacoCodeEditor = ({
  question,
  sessionId,
  code,
  onChange,
  onSubmitSolution,
  submitting = false
}) => {
  const [language, setLanguage] = useState('javascript');
  const [activeTab, setActiveTab] = useState('tests'); // 'tests' | 'review' | 'hints'
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState(null);
  const [error, setError] = useState('');

  // Hint ladder state
  const [hintLadder, setHintLadder] = useState(question?.hints || []);
  const [unlockedHints, setUnlockedHints] = useState({});
  const [penaltyPoints, setPenaltyPoints] = useState(0);
  const [unlockingLevel, setUnlockingLevel] = useState(null);

  // Code review state
  const [codeReview, setCodeReview] = useState(null);
  const [reviewing, setReviewing] = useState(false);

  // Synchronize starter code when question or language changes
  useEffect(() => {
    if (question?.starterCodes && question.starterCodes[language]) {
      if (!code || code.trim() === '') {
        onChange(question.starterCodes[language]);
      }
    } else if (!code || code.trim() === '') {
      onChange(DEFAULT_STARTER_CODES[language] || '// Write code here');
    }
    if (question?.hints) {
      setHintLadder(question.hints);
    }
  }, [question, language]);

  const handleLanguageSelect = (newLang) => {
    setLanguage(newLang);
    if (question?.starterCodes?.[newLang]) {
      onChange(question.starterCodes[newLang]);
    } else {
      onChange(DEFAULT_STARTER_CODES[newLang] || '// Write code here');
    }
  };

  // Run Sample / Visible Test Cases
  const handleRunSampleTests = async () => {
    if (!code || !code.trim()) {
      setError('Please write your solution code before running tests.');
      return;
    }
    setError('');
    setRunningTests(true);
    setActiveTab('tests');

    try {
      const res = await api.post(`/sessions/${sessionId}/execute-code`, {
        language,
        code,
        isSubmission: false
      });

      setTestResults(res.data.data.execution);
    } catch (err) {
      setError(err.response?.data?.message || 'Execution failed. Check your syntax or timeout constraints.');
    } finally {
      setRunningTests(false);
    }
  };

  // Unlock Hint Level
  const handleUnlockHint = async (level) => {
    setUnlockingLevel(level);
    try {
      const res = await api.post(`/sessions/${sessionId}/unlock-hint`, {
        questionId: question?._id || question?.id,
        level
      });

      const { hintText, penaltyPoints: newPenalty, hintLadder: updatedLadder } = res.data.data;
      setUnlockedHints((prev) => ({ ...prev, [level]: hintText }));
      setPenaltyPoints(newPenalty);
      if (updatedLadder) setHintLadder(updatedLadder);
    } catch (err) {
      alert(err.response?.data?.message || 'Could not unlock hint');
    } finally {
      setUnlockingLevel(null);
    }
  };

  // Request LLM Code Review
  const handleRequestReview = async () => {
    if (!code || !code.trim()) {
      alert('Please write code before requesting an AI code review.');
      return;
    }
    setReviewing(true);
    setActiveTab('review');
    try {
      const res = await api.post(`/sessions/${sessionId}/review-code`, {
        language,
        code,
        questionTitle: question?.title,
        questionPrompt: question?.prompt
      });
      setCodeReview(res.data.data.review);
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to review code');
    } finally {
      setReviewing(false);
    }
  };

  // Submit Final Code Solution
  const handleSubmitCode = async () => {
    if (!code || !code.trim()) {
      setError('Please provide code before submitting.');
      return;
    }
    onSubmitSolution(code, language, testResults, codeReview);
  };

  return (
    <div className="space-y-4">
      {/* Editor Top Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-3 rounded-2xl">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <FileCode className="w-4 h-4 text-indigo-400" />
            <span className="text-xs font-semibold text-slate-300">Language:</span>
          </div>

          <select
            value={language}
            onChange={(e) => handleLanguageSelect(e.target.value)}
            className="bg-slate-950 border border-slate-800 text-xs text-indigo-300 rounded-xl px-3 py-1.5 focus:outline-none focus:border-indigo-500 font-medium"
          >
            {LANGUAGE_CONFIGS.map((lang) => (
              <option key={lang.id} value={lang.id}>
                {lang.name}
              </option>
            ))}
          </select>

          {penaltyPoints > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
              <AlertTriangle className="w-3 h-3" /> Hints Penalty: -{penaltyPoints} pts
            </span>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* AI Code Review Button */}
          <button
            type="button"
            onClick={handleRequestReview}
            disabled={reviewing || runningTests}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-indigo-300 text-xs font-medium rounded-xl border border-indigo-500/20 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {reviewing ? (
              <div className="w-3.5 h-3.5 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Sparkles className="w-3.5 h-3.5 text-indigo-400" />
                AI Code Review
              </>
            )}
          </button>

          {/* Run Sample Tests */}
          <button
            type="button"
            onClick={handleRunSampleTests}
            disabled={runningTests || submitting}
            className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md shadow-indigo-600/20 flex items-center gap-1.5 transition disabled:opacity-50"
          >
            {runningTests ? (
              <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                Run Sample Tests
              </>
            )}
          </button>
        </div>
      </div>

      {/* Monaco Code Editor Pane */}
      <div className="border border-slate-800 rounded-2xl overflow-hidden bg-slate-950 shadow-inner">
        <Editor
          height="380px"
          language={language === 'c++' ? 'cpp' : language}
          value={code}
          onChange={(val) => onChange(val || '')}
          theme="vs-dark"
          options={{
            fontSize: 13,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            lineNumbers: 'on',
            automaticLayout: true,
            tabSize: 2,
            fontFamily: "Fira Code, Menlo, Monaco, 'Courier New', monospace"
          }}
        />
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/20 rounded-xl text-rose-300 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Tabs: Test Execution | AI Code Review | Hint Ladder */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-4">
          <button
            onClick={() => setActiveTab('tests')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'tests'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            Test Cases & Output
            {testResults && (
              <span
                className={`ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  testResults.allPassed
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                }`}
              >
                {testResults.passedCount}/{testResults.totalCount} Passed
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('review')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'review'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            Code Review & Tips
            {codeReview && (
              <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
                Ready
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('hints')}
            className={`py-3 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition ${
              activeTab === 'hints'
                ? 'border-indigo-500 text-indigo-300 bg-indigo-500/5'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
            Help & Hints
            <span className="ml-1 px-1.5 py-0.5 rounded-md text-[10px] bg-slate-800 text-slate-300">
              3 Levels
            </span>
          </button>
        </div>

        {/* Tab 1: Test Cases & Execution Details */}
        {activeTab === 'tests' && (
          <div className="p-4 space-y-4">
            {!testResults ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                Click <strong className="text-indigo-400">Run Sample Tests</strong> above to verify your solution against example test inputs.
              </div>
            ) : (
              <div className="space-y-3">
                {/* Metrics header */}
                <div className="flex flex-wrap items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <div className="flex items-center gap-4">
                    <span className="text-slate-400">
                      Status:{' '}
                      <strong className={testResults.allPassed ? 'text-emerald-400' : 'text-rose-400'}>
                        {testResults.allPassed ? 'Accepted (Sample Tests)' : 'Failed Test Cases'}
                      </strong>
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Clock className="w-3 h-3 text-indigo-400" />
                      Runtime: <strong className="text-slate-200 font-mono">{testResults.runtimeMs}ms</strong>
                    </span>
                    <span className="text-slate-400 flex items-center gap-1">
                      <Cpu className="w-3 h-3 text-indigo-400" />
                      Memory: <strong className="text-slate-200 font-mono">{testResults.memoryKb}KB</strong>
                    </span>
                  </div>
                </div>

                {/* Per-test case details */}
                <div className="grid grid-cols-1 gap-2.5">
                  {testResults.results?.map((tr, idx) => (
                    <div
                      key={idx}
                      className={`p-3 rounded-xl border text-xs space-y-2 ${
                        tr.passed
                          ? 'bg-slate-950/70 border-emerald-500/20'
                          : 'bg-rose-500/5 border-rose-500/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                          {tr.passed ? (
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                          ) : (
                            <XCircle className="w-3.5 h-3.5 text-rose-400" />
                          )}
                          Test Case #{idx + 1}
                          {tr.isHidden && (
                            <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                              Hidden Benchmark
                            </span>
                          )}
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">{tr.runtimeMs}ms</span>
                      </div>

                      {tr.isHidden ? (
                        <div className="text-[11px] text-slate-400 italic">
                          Benchmark test case input and expected values are confidential. Passed:{' '}
                          <span className={tr.passed ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                            {tr.passed ? 'YES' : 'NO'}
                          </span>
                        </div>
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-mono text-[11px]">
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Input</span>
                            <span className="text-slate-200">{JSON.stringify(tr.input)}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Expected</span>
                            <span className="text-emerald-400">{JSON.stringify(tr.expectedOutput)}</span>
                          </div>
                          <div className="bg-slate-900 p-2 rounded-lg border border-slate-800">
                            <span className="text-slate-500 block text-[10px] uppercase font-sans">Actual Output</span>
                            <span className={tr.passed ? 'text-emerald-400' : 'text-rose-400 font-bold'}>
                              {JSON.stringify(tr.actualOutput)}
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab 2: Code Review & Tips */}
        {activeTab === 'review' && (
          <div className="p-4 space-y-4">
            {!codeReview ? (
              <div className="text-center py-8 space-y-3">
                <p className="text-slate-400 text-xs max-w-md mx-auto">
                  Want to see how clean your code is? Click below for instant feedback and tips to make it faster.
                </p>
                <button
                  type="button"
                  onClick={handleRequestReview}
                  disabled={reviewing}
                  className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl shadow-md transition"
                >
                  {reviewing ? 'Analyzing your code...' : 'Review My Code'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Score meters */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Code Cleanliness</span>
                    <span className="text-xl font-bold font-mono text-indigo-400">
                      {codeReview.readabilityScore}/10
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Edge Cases</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">
                      {codeReview.edgeCasesScore}/10
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Speed (Time)</span>
                    <span className="text-sm font-bold font-mono text-amber-400">
                      {codeReview.timeComplexity || 'O(N)'}
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="text-[10px] uppercase text-slate-400 block font-semibold">Memory (Space)</span>
                    <span className="text-sm font-bold font-mono text-purple-400">
                      {codeReview.spaceComplexity || 'O(1)'}
                    </span>
                  </div>
                </div>

                {/* Recommendations */}
                {codeReview.recommendations && codeReview.recommendations.length > 0 && (
                  <div className="p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl space-y-2">
                    <span className="text-xs font-semibold text-indigo-300 block">
                      💡 Simple Tips to Improve Your Code:
                    </span>
                    <ul className="text-xs text-slate-300 space-y-1.5 list-disc list-inside">
                      {codeReview.recommendations.map((rec, i) => (
                        <li key={i}>{rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: 3-Level Hints */}
        {activeTab === 'hints' && (
          <div className="p-4 space-y-3">
            <div className="text-xs text-slate-400 leading-relaxed">
              Stuck? Unlock clues step-by-step to get back on track.
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { level: 1, name: 'Hint 1: High-Level Approach', cost: 2, defaultDesc: 'Clarifies high-level approach and key data structures.' },
                { level: 2, name: 'Hint 2: Step-by-Step Logic', cost: 5, defaultDesc: 'Outlines the algorithm steps and edge cases to consider.' },
                { level: 3, name: 'Hint 3: Code Blueprint', cost: 10, defaultDesc: 'Provides structured pseudocode or near-complete logic.' }
              ].map((tier) => {
                const hintObj = hintLadder.find((h) => h.level === tier.level) || {};
                const isUnlocked = hintObj.isUnlocked || Boolean(unlockedHints[tier.level]);
                const hintContent = unlockedHints[tier.level] || hintObj.hintText;

                return (
                  <div
                    key={tier.level}
                    className={`p-3.5 rounded-2xl border transition ${
                      isUnlocked
                        ? 'bg-slate-950/80 border-indigo-500/30'
                        : 'bg-slate-950/40 border-slate-800'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isUnlocked ? (
                          <Unlock className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <Lock className="w-4 h-4 text-slate-500" />
                        )}
                        <span className="text-xs font-semibold text-white">{tier.name}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20 font-medium">
                          Cost: -{tier.cost} pts
                        </span>
                      </div>

                      {!isUnlocked && (
                        <button
                          type="button"
                          onClick={() => handleUnlockHint(tier.level)}
                          disabled={unlockingLevel === tier.level}
                          className="px-3 py-1 bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold rounded-lg border border-slate-700 transition"
                        >
                          {unlockingLevel === tier.level ? 'Unlocking...' : `Unlock (-${tier.cost} pts)`}
                        </button>
                      )}
                    </div>

                    {isUnlocked ? (
                      <div className="p-3 bg-slate-900 rounded-xl border border-slate-800 text-xs text-indigo-200 leading-relaxed font-sans">
                        {hintContent || 'Hint revealed: Examine your edge conditions and pointer boundaries.'}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">{tier.defaultDesc}</p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Submit Button for Coding Round */}
      <div className="flex justify-end pt-2">
        <button
          type="button"
          onClick={handleSubmitCode}
          disabled={submitting}
          className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-semibold rounded-xl shadow-lg shadow-indigo-600/25 transition flex items-center gap-2 disabled:opacity-50"
        >
          {submitting ? (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              Submit Solution & Proceed <ChevronRight className="w-4 h-4" />
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default MonacoCodeEditor;