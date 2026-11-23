import React, { memo } from 'react';
import { Handle, Position } from 'reactflow';
import { Award, AlertCircle, CheckCircle2, Circle } from 'lucide-react';

export const SkillNode = memo(({ data, selected }) => {
  const mastery = data.masteryPercentage ?? 0;
  const isAssessed = data.isAssessed ?? false;

  // Determine badge and color style based on mastery
  let statusBadge;
  let borderStyle = 'border-slate-700 bg-slate-900/90 text-slate-300';
  let badgeColor = 'bg-slate-800 text-slate-400';

  if (!isAssessed) {
    statusBadge = 'Unassessed';
    borderStyle = 'border-slate-800 bg-slate-950/80 text-slate-400';
    badgeColor = 'bg-slate-800/80 text-slate-500';
  } else if (mastery >= 70) {
    statusBadge = 'Mastered';
    borderStyle = 'border-emerald-500/80 bg-emerald-950/40 text-emerald-200 shadow-emerald-500/10';
    badgeColor = 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30';
  } else if (mastery >= 40) {
    statusBadge = 'Developing';
    borderStyle = 'border-amber-500/80 bg-amber-950/40 text-amber-200 shadow-amber-500/10';
    badgeColor = 'bg-amber-500/20 text-amber-300 border border-amber-500/30';
  } else {
    statusBadge = 'Critical Gap';
    borderStyle = 'border-rose-500/80 bg-rose-950/40 text-rose-200 shadow-rose-500/10';
    badgeColor = 'bg-rose-500/20 text-rose-300 border border-rose-500/30';
  }

  return (
    <div
      className={`relative px-4 py-3 rounded-2xl border-2 shadow-lg backdrop-blur-md min-w-[180px] max-w-[220px] transition-all cursor-pointer ${borderStyle} ${
        selected ? 'ring-2 ring-indigo-400 ring-offset-2 ring-offset-slate-950 scale-105' : 'hover:scale-102'
      }`}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="w-2.5 h-2.5 !bg-indigo-400 !border-slate-900"
      />

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-1 text-[10px]">
          <span className="uppercase tracking-wider font-mono font-medium opacity-70 truncate">
            {data.category || 'Skill'}
          </span>
          <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold ${badgeColor}`}>
            {statusBadge}
          </span>
        </div>

        <div className="font-bold text-xs tracking-tight text-white line-clamp-1">
          {data.name}
        </div>

        <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5">
          <span className="opacity-75">Mastery:</span>
          <span className="font-mono font-bold">
            {isAssessed ? `${Math.round(mastery)}%` : '--'}
          </span>
        </div>

        {/* Progress bar */}
        {isAssessed && (
          <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${
                mastery >= 70
                  ? 'bg-emerald-400'
                  : mastery >= 40
                  ? 'bg-amber-400'
                  : 'bg-rose-400'
              }`}
              style={{ width: `${Math.min(100, Math.max(5, mastery))}%` }}
            />
          </div>
        )}
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="w-2.5 h-2.5 !bg-indigo-400 !border-slate-900"
      />
    </div>
  );
});

export default SkillNode;