import React, { useState, useEffect } from 'react';
import { Clock, AlertTriangle } from 'lucide-react';

export const QuestionTimer = ({ totalSeconds = 90, onTimeUp, isRunning = true }) => {
  const [timeLeft, setTimeLeft] = useState(totalSeconds);

  useEffect(() => {
    setTimeLeft(totalSeconds);
  }, [totalSeconds]);

  useEffect(() => {
    if (!isRunning || timeLeft <= 0) return;

    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (onTimeUp) onTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, timeLeft, onTimeUp]);

  const percentage = Math.max(0, (timeLeft / totalSeconds) * 100);

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins}:${remainingSecs < 10 ? '0' : ''}${remainingSecs}`;
  };

  const isWarning = timeLeft <= 30 && timeLeft > 10;
  const isDanger = timeLeft <= 10;

  return (
    <div className="flex items-center gap-3 bg-slate-900/90 border border-slate-800 rounded-xl px-3.5 py-2">
      <Clock
        className={`w-4 h-4 ${
          isDanger ? 'text-rose-400 animate-bounce' : isWarning ? 'text-amber-400' : 'text-slate-400'
        }`}
      />
      <div>
        <div className="text-[10px] uppercase font-semibold text-slate-500">Time Remaining</div>
        <div
          className={`text-sm font-mono font-bold ${
            isDanger ? 'text-rose-400 animate-pulse' : isWarning ? 'text-amber-400' : 'text-white'
          }`}
        >
          {formatTime(timeLeft)}
        </div>
      </div>

      {/* Mini Progress Bar */}
      <div className="w-16 h-1.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
        <div
          className={`h-full transition-all duration-1000 ${
            isDanger ? 'bg-rose-500' : isWarning ? 'bg-amber-500' : 'bg-indigo-500'
          }`}
          style={{ width: `${percentage}%` }}
        ></div>
      </div>
    </div>
  );
};

export default QuestionTimer;
