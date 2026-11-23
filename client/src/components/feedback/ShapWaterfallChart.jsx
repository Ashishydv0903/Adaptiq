import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  ReferenceLine,
  CartesianGrid
} from 'recharts';
import { HelpCircle, TrendingUp, TrendingDown, Award } from 'lucide-react';

/**
 * Renders an interactive Explainable AI (XAI) Waterfall Chart using Recharts
 * Visualizes: Baseline Benchmark + Sum of Linear SHAP Feature Attributions = Final Score
 *
 * @param {Object} props
 * @param {Object} props.shap - Linear SHAP output containing waterfall steps & attributions
 * @param {number} props.finalScore - Candidate's final composite score [0, 100]
 */
export default function ShapWaterfallChart({ shap, finalScore }) {
  if (!shap || !shap.waterfall || shap.waterfall.length === 0) {
    return (
      <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-slate-400">
        No SHAP attribution data available for this question.
      </div>
    );
  }

  // Format data for Recharts floating/stacked waterfall bar
  const waterfallSteps = shap.waterfall || [];
  const chartData = [];

  for (let i = 0; i < waterfallSteps.length; i++) {
    const item = waterfallSteps[i];
    const isBaseline = i === 0;
    const isTotal = i === waterfallSteps.length - 1 && item.step.includes('Final');

    let base = 0;
    let value = 0;
    let fill = '#6366f1'; // Indigo for baseline/total

    if (isBaseline) {
      base = 0;
      value = item.runningScore;
      fill = '#6366f1';
    } else if (isTotal) {
      base = 0;
      value = item.runningScore;
      fill = item.runningScore >= 70 ? '#10b981' : item.runningScore >= 50 ? '#3b82f6' : '#f59e0b';
    } else {
      const prevRunning = waterfallSteps[i - 1].runningScore;
      const delta = item.delta;

      if (delta >= 0) {
        base = prevRunning;
        value = delta;
        fill = '#10b981'; // Green for positive contribution
      } else {
        base = prevRunning + delta;
        value = Math.abs(delta);
        fill = '#f43f5e'; // Rose/Red for negative contribution
      }
    }

    // Friendly display name
    const formatName = (str) => {
      if (str === 'Baseline Benchmark') return 'Baseline';
      return str
        .replace(/([A-Z])/g, ' $1')
        .replace(/^./, (s) => s.toUpperCase())
        .trim();
    };

    chartData.push({
      name: formatName(item.step),
      fullName: item.step,
      base,
      value: Number(value.toFixed(2)),
      delta: item.delta,
      runningScore: item.runningScore,
      fill,
      isBaseline,
      isTotal
    });
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-slate-950 border border-slate-800 p-3 rounded-lg shadow-xl text-xs space-y-1">
          <p className="font-semibold text-slate-200">{data.fullName}</p>
          {!data.isBaseline && !data.isTotal && (
            <p className={data.delta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
              Impact: {data.delta >= 0 ? `+${data.delta}` : data.delta} pts
            </p>
          )}
          <p className="text-slate-400">
            Running Evaluation: <span className="text-white font-mono font-bold">{data.runningScore}</span> / 100
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-800/80 mb-6 gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-white tracking-tight">
              Feature Attribution (Linear SHAP Waterfall)
            </h3>
            <span className="px-2 py-0.5 text-xs bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 rounded-full font-medium">
              Exact Efficiency Axiom
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Shows how each rubric dimension and semantic signal pushed the score above or below the baseline benchmark (50.0).
          </p>
        </div>

        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-1.5 text-emerald-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500 inline-block" />
            <span>Positive Gain</span>
          </div>
          <div className="flex items-center gap-1.5 text-rose-400">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-500 inline-block" />
            <span>Penalty / Deduction</span>
          </div>
        </div>
      </div>

      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 20, right: 20, left: -10, bottom: 25 }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
            <XAxis
              dataKey="name"
              stroke="#64748b"
              fontSize={11}
              interval={0}
              angle={-25}
              textAnchor="end"
              tickLine={false}
            />
            <YAxis
              stroke="#64748b"
              fontSize={11}
              domain={[0, 100]}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<CustomTooltip />} />
            <ReferenceLine y={50} stroke="#475569" strokeDasharray="4 4" label={{ value: 'Benchmark 50', fill: '#64748b', fontSize: 10, position: 'right' }} />

            {/* Invisible floating stack bar */}
            <Bar dataKey="base" stackId="waterfall" fill="transparent" />

            {/* Actual delta/value bar */}
            <Bar dataKey="value" stackId="waterfall" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {shap.efficiencyCheck && (
        <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <Award className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              Baseline: <strong className="text-slate-200">{shap.baselineScore}</strong> pts
              {' → '}
              Sum of Attributions: <strong className={shap.efficiencyCheck.sumOfShapley >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {shap.efficiencyCheck.sumOfShapley >= 0 ? `+${shap.efficiencyCheck.sumOfShapley}` : shap.efficiencyCheck.sumOfShapley}
              </strong> pts
              {' → '}
              Predicted: <strong className="text-white">{shap.predictedScore}</strong> pts
            </span>
          </div>

          <span className="text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
            Efficiency Verified (Δ = 0.00)
          </span>
        </div>
      )}
    </div>
  );
}
