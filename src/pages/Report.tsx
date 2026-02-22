import React from 'react';
import { SessionState } from '../types';
import { Download, TrendingUp, PieChart, Activity, Users } from 'lucide-react';
import { 
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  PieChart as RePieChart, Pie, Cell, Legend 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface ReportProps {
  session: SessionState;
}

export default function Report({ session }: ReportProps) {
  const { timeseries, sessionMetrics } = session;

  // Prepare data for dominant emotions donut
  const emotionSums: Record<string, number> = {
    happy: 0, neutral: 0, sad: 0, anger: 0, fear: 0, surprise: 0, disgust: 0
  };
  timeseries.forEach(item => {
    Object.keys(emotionSums).forEach(key => {
      emotionSums[key] += (item as any)[key];
    });
  });
  const pieData = Object.entries(emotionSums)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 3);

  const downloadJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(session));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", `emotion_ai_report_${session.sessionId}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
  };

  const downloadCSV = () => {
    const headers = ['t_s', 'engagement', 'distraction', 'happy', 'neutral', 'sad', 'anger', 'fear', 'surprise', 'disgust'];
    const rows = timeseries.map(item => [
      item.t_s, item.engagement_mean, item.distracted_mean, 
      item.happy, item.neutral, item.sad, item.anger, item.fear, item.surprise, item.disgust
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `emotion_ai_data_${session.sessionId}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Session Analytics</h1>
          <p className="text-zinc-500 text-sm">Detailed breakdown of audience engagement and emotional response.</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={downloadCSV}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
          <button 
            onClick={downloadJSON}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-xl text-sm font-medium hover:bg-zinc-800 transition-colors shadow-sm"
          >
            <Download className="w-4 h-4" />
            Full JSON
          </button>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Dominant Emotions Donut */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <PieChart className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Top 3 Emotions</h3>
          </div>
          <div className="h-[300px] flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <RePieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={100}
                  paddingAngle={5}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={EMOTION_COLORS[entry.name as keyof typeof EMOTION_COLORS] || '#6366f1'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend verticalAlign="bottom" height={36}/>
              </RePieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Engagement Line Chart */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Engagement Over Time</h3>
          </div>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeseries}>
                <defs>
                  <linearGradient id="colorEngage" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="t_s" hide />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Area type="monotone" dataKey="engagement_mean" stroke="#10b981" fillOpacity={1} fill="url(#colorEngage)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Emotion Intensity Area Chart */}
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm lg:col-span-2">
          <div className="flex items-center gap-2 mb-6">
            <Activity className="w-4 h-4 text-rose-500" />
            <h3 className="text-sm font-semibold text-zinc-900 uppercase tracking-wider">Emotion Intensity Trends</h3>
          </div>
          <div className="h-[400px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeseries}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
                <XAxis dataKey="t_s" hide />
                <YAxis domain={[0, 1]} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="happy" stroke={EMOTION_COLORS.happy} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="neutral" stroke={EMOTION_COLORS.neutral} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="surprise" stroke={EMOTION_COLORS.surprise} dot={false} strokeWidth={2} />
                <Line type="monotone" dataKey="distracted_mean" name="distracted" stroke="#94a3b8" dot={false} strokeWidth={2} strokeDasharray="5 5" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Score Breakdown */}
      <div className="bg-white p-8 rounded-2xl border border-zinc-200 shadow-sm">
        <h3 className="text-lg font-bold text-zinc-900 mb-6">Presentation Score Breakdown</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
          <div className="space-y-6">
            <p className="text-zinc-600 text-sm leading-relaxed">
              The Presentation Score is a weighted metric that combines audience engagement and focus. 
              High scores indicate a session where the audience was consistently attentive and emotionally responsive.
            </p>
            <div className="space-y-4">
              <ScoreComponent label="Engagement Weight" value={70} color="rose" />
              <ScoreComponent label="Focus Weight" value={30} color="emerald" />
            </div>
          </div>
          <div className="flex flex-col items-center justify-center bg-zinc-50 rounded-2xl p-8">
            <div className="text-[10px] font-bold text-zinc-400 uppercase tracking-[0.2em] mb-2">Final Score</div>
            <div className="text-7xl font-black text-rose-500 tracking-tighter">
              {sessionMetrics?.presentation_score_0_100}
            </div>
            <div className="mt-4 px-3 py-1 bg-rose-100 text-rose-700 text-xs font-bold rounded-full uppercase tracking-wider">
              Excellent
            </div>
          </div>
        </div>
      </div>
      {/* Transcript */}
{session.transcript && (
  <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm mt-8">
    <h3 className="text-lg font-bold text-zinc-900 mb-4">Transcript</h3>
    <div className="max-h-96 overflow-y-auto">
      <p className="text-zinc-700 whitespace-pre-wrap">{session.transcript}</p>
    </div>
    {session.transcriptSegments && session.transcriptSegments.length > 0 && (
      <details className="mt-4">
        <summary className="text-sm text-zinc-500 cursor-pointer hover:text-zinc-700 font-medium">
          View with timestamps
        </summary>
        <div className="mt-3 space-y-2 text-xs bg-zinc-50 p-4 rounded-lg">
          {session.transcriptSegments.map((seg, idx) => (
            <div key={idx} className="flex gap-3">
              <span className="text-zinc-400 font-mono shrink-0">
                {seg.start.toFixed(1)}s – {seg.end.toFixed(1)}s
              </span>
              <span className="text-zinc-700">{seg.text}</span>
            </div>
          ))}
        </div>
      </details>
    )}
  </div>
)}
    </div>
  );
}

function ScoreComponent({ label, value, color }: { label: string, value: number, color: string }) {
  const colors = {
    rose: "bg-rose-500",
    emerald: "bg-emerald-600",
  };
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs font-medium">
        <span className="text-zinc-500">{label}</span>
        <span className="text-zinc-900">{value}%</span>
      </div>
      <div className="h-2 w-full bg-zinc-100 rounded-full overflow-hidden">
        <div className={cn("h-full rounded-full", colors[color as keyof typeof colors])} style={{ width: `${value}%` }} />
      </div>
    </div>
  );
}

const EMOTION_COLORS = {
  happy: '#10b981',
  neutral: '#fb7185', // rose-400
  sad: '#3b82f6',
  anger: '#ef4444',
  fear: '#8b5cf6',
  surprise: '#f59e0b',
  disgust: '#14b8a6',
};
