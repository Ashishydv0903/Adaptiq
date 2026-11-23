import React, { useState } from 'react';
import { Mic, MessageSquare, ChevronDown, ChevronUp, Sparkles, CheckCircle2 } from 'lucide-react';
import DualInputAnswerBox from './DualInputAnswerBox.jsx';

/**
 * SpokenExplanationBox
 * For coding questions: Allows candidates to add an optional spoken explanation
 * (architecture, algorithm walkthrough, complexity) which is scored separately.
 */
export const SpokenExplanationBox = ({
  sessionId,
  questionId,
  onExplanationChange = () => {},
  submitting = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [explanationText, setExplanationText] = useState('');
  const [explanationTelemetry, setExplanationTelemetry] = useState(null);

  const handleTextChange = (text) => {
    setExplanationText(text);
    onExplanationChange({
      transcript: text,
      audioUrl: explanationTelemetry?.audioUrl || '',
      speechMetrics: explanationTelemetry?.speechMetrics || null,
      editedAfterTranscription: explanationTelemetry?.editedAfterTranscription || false
    });
  };

  const handleTelemetryChange = (telemetry) => {
    setExplanationTelemetry(telemetry);
    onExplanationChange({
      transcript: explanationText || telemetry.transcript || '',
      audioUrl: telemetry.audioUrl || '',
      speechMetrics: telemetry.speechMetrics || null,
      editedAfterTranscription: telemetry.editedAfterTranscription || false
    });
  };

  return (
    <div className="bg-[#0B192C] border border-[#1B3A60] rounded-2xl overflow-hidden transition-all">
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-3.5 flex items-center justify-between text-left hover:bg-[#0F2238] transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-xl bg-[#52D68A]/10 text-[#52D68A] border border-[#52D68A]/30">
            <Mic className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-white">
                Optional: Add Spoken Code Explanation
              </span>
              <span className="text-[10px] uppercase font-bold text-[#52D68A] bg-[#52D68A]/10 px-2 py-0.5 rounded-full border border-[#52D68A]/20">
                Scored Separately
              </span>
            </div>
            <p className="text-[11px] text-slate-400">
              Walk through your algorithmic approach, data structure tradeoffs, and time/space complexity.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-slate-400">
          {explanationText && (
            <span className="text-[11px] text-[#52D68A] flex items-center gap-1 font-semibold">
              <CheckCircle2 className="w-3.5 h-3.5" /> Explanation Added
            </span>
          )}
          {isOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-[#1B3A60] bg-[#071322] space-y-3">
          <DualInputAnswerBox
            value={explanationText}
            onChange={handleTextChange}
            onTelemetryChange={handleTelemetryChange}
            sessionId={sessionId}
            questionId={questionId}
            placeholder="Dictate or type your code walkthrough (e.g., 'I chose a sliding window approach because...')"
            disabled={submitting}
            isCodingExplanation={true}
          />
        </div>
      )}
    </div>
  );
};

export default SpokenExplanationBox;
