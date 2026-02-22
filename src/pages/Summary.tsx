import React, { useState } from 'react';
import { SessionState, FullSummary } from '../types';
import { Sparkles, CheckCircle2, AlertTriangle, Lightbulb, Clock, ArrowRight, Download } from 'lucide-react';
import { generateFullSummary } from '../services/geminiService';
import { motion } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SummaryProps {
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
}

export default function Summary({ session, setSession }: SummaryProps) {
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async () => {
    if (!session.sessionMetrics) return;
    
    // Check if API key is selected if using a platform that requires it
    if (window.aistudio && !(await window.aistudio.hasSelectedApiKey())) {
      await window.aistudio.openSelectKey();
      // After opening, we proceed. The platform handles the injection.
    }

    setIsGenerating(true);
    try {
      // Get top 3 emotions for prompt
      const emotionSums: Record<string, number> = {
        happy: 0, neutral: 0, sad: 0, anger: 0, fear: 0, surprise: 0, disgust: 0
      };
      session.timeseries.forEach(item => {
        Object.keys(emotionSums).forEach(key => {
          emotionSums[key] += (item as any)[key];
        });
      });
      const topEmotions = Object.entries(emotionSums)
        .map(([emotion, value]) => ({ emotion, value }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 3);

      const summary = await generateFullSummary(session.sessionMetrics, session.flags, topEmotions);
      setSession(prev => ({ ...prev, fullSummary: summary }));
    } catch (err: any) {
      const errorMessage = err.message || "Unknown error";
      if (errorMessage.includes("API_KEY") || errorMessage.includes("key")) {
        alert("Gemini API Key issue: " + errorMessage + ". Please ensure you have selected a valid API key.");
        if (window.aistudio) await window.aistudio.openSelectKey();
      } else {
        alert("Failed to generate summary: " + errorMessage);
      }
      console.error(err);
    } finally {
      setIsGenerating(false);
    }
  };

  const exportSummary = () => {
    if (!session.fullSummary) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session.fullSummary));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `emotion_ai_summary_${session.sessionId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  if (!session.fullSummary && !isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="w-20 h-20 bg-rose-100 rounded-3xl flex items-center justify-center">
          <Sparkles className="w-10 h-10 text-rose-500" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-zinc-900 mb-2">Generate Your AI Report</h2>
          <p className="text-zinc-500">
            Gemini will analyze your entire session, including engagement trends and key emotional spikes, to provide actionable coaching.
          </p>
        </div>
        <button 
          onClick={handleGenerate}
          className="bg-rose-500 text-white px-8 py-4 rounded-2xl font-bold text-lg hover:bg-rose-600 transition-all shadow-xl shadow-rose-200 flex items-center gap-3"
        >
          <Sparkles className="w-5 h-5" />
          Generate Full Summary
        </button>
      </div>
    );
  }

  if (isGenerating) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-6">
        <div className="relative">
          <div className="w-24 h-24 border-4 border-zinc-100 rounded-full" />
          <div className="absolute inset-0 w-24 h-24 border-4 border-rose-500 border-t-transparent rounded-full animate-spin" />
          <Sparkles className="absolute inset-0 m-auto w-8 h-8 text-rose-500 animate-pulse" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-zinc-900">Analyzing Session Data...</h2>
          <p className="text-zinc-500 text-sm animate-pulse">Gemini is crafting your personalized coaching report.</p>
        </div>
      </div>
    );
  }

  const summary = session.fullSummary!;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-12 pb-20"
    >
      <div className="flex justify-between items-end">
        <div>
          <h1 className="text-4xl font-black text-zinc-900 tracking-tight mb-2">Executive Report</h1>
          <p className="text-zinc-500 font-medium">AI-Generated insights for Session {session.sessionId}</p>
        </div>
        <div className="flex gap-3">
          <button 
            onClick={handleGenerate}
            className="px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"
          >
            Regenerate
          </button>
          <button 
            onClick={exportSummary}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-bold hover:bg-zinc-800 transition-colors shadow-lg"
          >
            <Download className="w-4 h-4" />
            Export JSON
          </button>
        </div>
      </div>

      {/* Executive Summary */}
      <section className="bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
        <h3 className="text-sm font-bold text-zinc-400 uppercase tracking-[0.2em] mb-6">Executive Summary</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {summary.executive_summary.map((text, i) => (
            <div key={i} className="relative pl-6">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-rose-500 rounded-full opacity-20" />
              <p className="text-zinc-700 leading-relaxed italic">"{text}"</p>
            </div>
          ))}
        </div>
      </section>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="bg-emerald-50/50 p-8 rounded-3xl border border-emerald-100">
          <div className="flex items-center gap-3 mb-6">
            <CheckCircle2 className="text-emerald-600 w-6 h-6" />
            <h3 className="text-lg font-bold text-emerald-900">Core Strengths</h3>
          </div>
          <ul className="space-y-4">
            {summary.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-emerald-800 font-medium">
                <div className="mt-1.5 w-1.5 h-1.5 bg-emerald-500 rounded-full shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="bg-rose-50/50 p-8 rounded-3xl border border-rose-100">
          <div className="flex items-center gap-3 mb-6">
            <AlertTriangle className="text-rose-600 w-6 h-6" />
            <h3 className="text-lg font-bold text-rose-900">Areas for Growth</h3>
          </div>
          <ul className="space-y-4">
            {summary.weaknesses.map((w, i) => (
              <li key={i} className="flex items-start gap-3 text-rose-800 font-medium">
                <div className="mt-1.5 w-1.5 h-1.5 bg-rose-500 rounded-full shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Recommendations */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <Lightbulb className="text-amber-500 w-6 h-6" />
          <h3 className="text-2xl font-bold text-zinc-900">Strategic Recommendations</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {summary.recommendations.map((rec, i) => (
            <div key={i} className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm flex flex-col">
              <div className="mb-4">
                <span className={cn(
                  "px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest",
                  rec.expected_impact === 'high' ? "bg-rose-100 text-rose-700" :
                  rec.expected_impact === 'medium' ? "bg-amber-100 text-amber-700" : "bg-zinc-100 text-zinc-700"
                )}>
                  {rec.expected_impact} Impact
                </span>
              </div>
              <h4 className="text-lg font-bold text-zinc-900 mb-2">{rec.title}</h4>
              <p className="text-sm text-zinc-500 mb-4 flex-1">{rec.why}</p>
              <div className="pt-4 border-t border-zinc-100">
                <p className="text-[10px] font-bold text-zinc-400 uppercase mb-2">How to implement</p>
                <p className="text-xs font-medium text-zinc-700">{rec.how}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Notable Moments */}
      <section>
        <div className="flex items-center gap-3 mb-8">
          <Clock className="text-rose-500 w-6 h-6" />
          <h3 className="text-2xl font-bold text-zinc-900">Notable Moments</h3>
        </div>
        <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-b border-zinc-200">
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Time</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Label</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Interpretation</th>
                <th className="px-6 py-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Suggested Fix</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {summary.moment_commentary.map((moment, i) => (
                <tr key={i} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                    {Math.floor(moment.t_s / 60)}:{(moment.t_s % 60).toString().padStart(2, '0')}
                  </td>
                  <td className="px-6 py-4 font-bold text-zinc-900 text-sm">{moment.label}</td>
                  <td className="px-6 py-4 text-sm text-zinc-600 leading-relaxed">{moment.interpretation}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-rose-500 font-semibold text-xs">
                      <ArrowRight className="w-3 h-3" />
                      {moment.fix}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* One Big Thing */}
      <section className="bg-zinc-900 p-10 rounded-[3rem] text-white relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-500 rounded-full blur-[100px] opacity-20 -mr-32 -mt-32" />
        <div className="relative z-10 max-w-2xl">
          <span className="inline-block px-3 py-1 bg-rose-500/20 border border-rose-500/30 rounded-full text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            The Priority Action
          </span>
          <h3 className="text-4xl font-bold mb-4 tracking-tight">{summary.one_thing_to_change.title}</h3>
          <p className="text-zinc-400 text-lg leading-relaxed">{summary.one_thing_to_change.rationale}</p>
        </div>
      </section>
    </motion.div>
  );
}