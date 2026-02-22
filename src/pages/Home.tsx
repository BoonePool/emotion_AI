import React, { useState, useRef, useEffect } from 'react';
import { SessionState, Flag, FlagBlurb } from '../types';
import { Play, Square, Video, AlertCircle, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { generateFlagBlurb } from '../services/geminiService';
import { generateMockTimeseries, generateMockFlags, computeSessionMetrics } from '../data/mockData';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface HomeProps {
  session: SessionState;
  setSession: React.Dispatch<React.SetStateAction<SessionState>>;
}

export default function Home({ session, setSession }: HomeProps) {
  const [isRecording, setIsRecording] = useState(false);
  const [selectedFlag, setSelectedFlag] = useState<Flag | null>(session.flags[0] || null);
  const [isGeneratingBlurb, setIsGeneratingBlurb] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Explicitly set muted property to ensure sound works on playback
    // We mute during recording to prevent feedback/echo
    video.muted = isRecording;

    const handleTimeUpdate = () => setCurrentTime(video.currentTime);
    const handleDurationChange = () => setDuration(video.duration);

    video.addEventListener('timeupdate', handleTimeUpdate);
    video.addEventListener('durationchange', handleDurationChange);
    
    return () => {
      video.removeEventListener('timeupdate', handleTimeUpdate);
      video.removeEventListener('durationchange', handleDurationChange);
    };
  }, [isRecording]);

  const startRecording = async () => {
    try {
      // Clear previous video as requested
      setSession(prev => ({ ...prev, videoUrl: null }));
      
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.src = ""; // Clear src if any
      }
      
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        
        setSession(prev => ({ ...prev, videoUrl: url }));
      };

      mediaRecorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing camera:", err);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      setIsRecording(false);
      
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
      
      // Simulate analysis complete
      setTimeout(() => {
        const durationVal = videoRef.current?.duration || 30;
        const newTs = generateMockTimeseries(Math.max(10, Math.floor(durationVal)));
        const newFlags = generateMockFlags(newTs);
        const newMetrics = computeSessionMetrics(newTs);
        
        setSession(prev => ({
          ...prev,
          timeseries: newTs,
          flags: newFlags,
          sessionMetrics: newMetrics,
          flagBlurbs: {},
          fullSummary: null
        }));
        
        if (newFlags.length > 0) {
          setSelectedFlag(newFlags[0]);
        }
      }, 1000); // Increased timeout to ensure onstop finishes
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Clear previous video
      if (session.videoUrl) {
        URL.revokeObjectURL(session.videoUrl);
      }
      
      const url = URL.createObjectURL(file);
      setSession(prev => ({ ...prev, videoUrl: url }));
      
      // Simulate analysis for uploaded video
      setTimeout(() => {
        const newTs = generateMockTimeseries(60); // Default 60s for upload
        const newFlags = generateMockFlags(newTs);
        const newMetrics = computeSessionMetrics(newTs);
        
        setSession(prev => ({
          ...prev,
          timeseries: newTs,
          flags: newFlags,
          sessionMetrics: newMetrics,
          flagBlurbs: {},
          fullSummary: null
        }));
      }, 500);
    }
  };

  const handleGenerateBlurb = async () => {
    if (!selectedFlag || !session.sessionMetrics) return;
    
    setIsGeneratingBlurb(true);
    try {
      const blurb = await generateFlagBlurb(selectedFlag, session.sessionMetrics);
      setSession(prev => ({
        ...prev,
        flagBlurbs: { ...prev.flagBlurbs, [selectedFlag.flag_id]: blurb }
      }));
    } catch (err) {
      console.error("Error generating blurb:", err);
    } finally {
      setIsGeneratingBlurb(false);
    }
  };

  const jumpToTime = (t_s: number) => {
    if (videoRef.current) {
      const duration = videoRef.current.duration;
      if (isFinite(duration) && duration > 0) {
        videoRef.current.currentTime = t_s % duration;
      }
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  const currentBlurb = selectedFlag ? session.flagBlurbs[selectedFlag.flag_id] : null;

  return (
    <div className="space-y-8">
      {/* Top Half: Recording & Timeline */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Recording Card */}
        <div className="lg:col-span-4 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-zinc-100 flex justify-between items-center">
            <h2 className="font-semibold text-zinc-900 flex items-center gap-2">
              <Video className="w-4 h-4 text-rose-500" />
              Record Presentation
            </h2>
            {isRecording && (
              <span className="flex items-center gap-1.5 text-xs font-bold text-red-600 animate-pulse">
                <div className="w-2 h-2 bg-red-600 rounded-full" />
                REC
              </span>
            )}
          </div>
          <div className="flex-1 bg-zinc-900 relative aspect-video flex items-center justify-center">
            <video 
              ref={videoRef} 
              autoPlay={isRecording} 
              controls={!isRecording && !!session.videoUrl}
              className="w-full h-full object-cover"
              src={!isRecording && session.videoUrl ? session.videoUrl : undefined}
            />
            {!isRecording && !session.videoUrl && (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-500 space-y-2">
                <Video className="w-12 h-12 opacity-20" />
                <p className="text-sm">Camera preview will appear here</p>
              </div>
            )}
          </div>
          <div className="p-4 bg-zinc-50 flex flex-col gap-3">
            <div className="flex gap-3">
              {!isRecording ? (
                <button 
                  onClick={startRecording}
                  className="flex-1 bg-rose-500 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-rose-600 transition-colors shadow-sm"
                >
                  <Play className="w-4 h-4 fill-current" />
                  Start Recording
                </button>
              ) : (
                <button 
                  onClick={stopRecording}
                  className="flex-1 bg-zinc-900 text-white py-2.5 rounded-xl font-medium flex items-center justify-center gap-2 hover:bg-zinc-800 transition-colors shadow-sm"
                >
                  <Square className="w-4 h-4 fill-current" />
                  Stop Recording
                </button>
              )}
            </div>
            {!isRecording && (
              <div className="relative">
                <input 
                  type="file" 
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  accept="video/*"
                  className="hidden"
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full bg-white border border-zinc-200 text-zinc-600 py-2 rounded-xl text-xs font-medium hover:bg-zinc-50 transition-colors"
                >
                  Or upload video file
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Timeline & Quick Stats */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Flag Timeline</h3>
            <div className="relative h-12 bg-zinc-100 rounded-full mb-8 px-4 flex items-center">
              {/* Shared Track Container */}
              <div className="relative w-full h-1.5 flex items-center">
                {/* Video Slider */}
                <input 
                  type="range"
                  min={0}
                  max={duration || session.sessionMetrics?.duration_s || 1}
                  step={0.1}
                  value={currentTime}
                  onChange={handleSeek}
                  className="absolute inset-0 w-full h-full bg-zinc-200 rounded-full appearance-none cursor-pointer accent-rose-500 z-20"
                />
                
                {/* Flags Layer */}
                <div className="absolute inset-0 pointer-events-none z-30">
                  {session.flags.map((flag) => (
                    <button
                      key={flag.flag_id}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedFlag(flag);
                        jumpToTime(flag.t_s);
                      }}
                      className={cn(
                        "absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all hover:scale-125 pointer-events-auto",
                        selectedFlag?.flag_id === flag.flag_id 
                          ? "bg-rose-500 border-white shadow-lg scale-110" 
                          : "bg-white border-zinc-300"
                      )}
                      style={{ left: `${(flag.t_s / (duration || session.sessionMetrics?.duration_s || 1)) * 100}%` }}
                    >
                      <AlertCircle className={cn(
                        "w-3 h-3",
                        selectedFlag?.flag_id === flag.flag_id ? "text-white" : "text-zinc-400"
                      )} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-between text-[10px] font-mono text-zinc-400 px-2">
              <span>{Math.floor(currentTime / 60)}:{(Math.floor(currentTime) % 60).toString().padStart(2, '0')}</span>
              <span>{Math.floor((duration || session.sessionMetrics?.duration_s || 0) / 60)}:{(Math.floor(duration || session.sessionMetrics?.duration_s || 0) % 60).toString().padStart(2, '0')}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard label="Score" value={session.sessionMetrics?.presentation_score_0_100 || 0} suffix="/100" color="rose" />
            <StatCard label="Engagement" value={Math.round((session.sessionMetrics?.avg_engagement_0_1 || 0) * 100)} suffix="%" color="emerald" />
            <StatCard label="Dominant" value={session.sessionMetrics?.dominant_emotion || 'N/A'} color="amber" isText />
            <StatCard label="Flags" value={session.flags.length} color="rose" />
          </div>
        </div>
      </div>

      {/* Bottom Half: Flag Details */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Flag Selector */}
        <div className="lg:col-span-3 bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-zinc-100 bg-zinc-50/50">
            <h3 className="font-semibold text-zinc-900 text-sm">Key Moments</h3>
          </div>
          <div className="divide-y divide-zinc-100 max-h-[400px] overflow-y-auto">
            {session.flags.map((flag) => (
              <button
                key={flag.flag_id}
                onClick={() => setSelectedFlag(flag)}
                className={cn(
                  "w-full p-4 text-left transition-colors flex items-start gap-3",
                  selectedFlag?.flag_id === flag.flag_id ? "bg-rose-50/50" : "hover:bg-zinc-50"
                )}
              >
                <div className={cn(
                  "mt-1 w-2 h-2 rounded-full shrink-0",
                  flag.type === 'engagement_drop' ? "bg-rose-500" : flag.type === 'emotion_spike' ? "bg-emerald-500" : "bg-amber-500"
                )} />
                <div>
                  <p className="text-xs font-mono text-zinc-400 mb-1">
                    {Math.floor(flag.t_s / 60)}:{(flag.t_s % 60).toString().padStart(2, '0')}
                  </p>
                  <p className="text-sm font-medium text-zinc-900 capitalize leading-tight">
                    {flag.type.replace('_', ' ')}
                  </p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Flag Analysis */}
        <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Emotion Chart */}
          <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm">
            <h3 className="text-sm font-semibold text-zinc-400 uppercase tracking-wider mb-6">Moment Emotions</h3>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={selectedFlag?.top_emotions || []} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f4f4f5" />
                  <XAxis type="number" hide domain={[0, 1]} />
                  <YAxis 
                    dataKey="emotion" 
                    type="category" 
                    width={80} 
                    tick={{ fontSize: 12, fontWeight: 500, fill: '#71717a' }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip 
                    cursor={{ fill: '#f8fafc' }}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                    formatter={(value: number) => value.toFixed(3)} // This handles the rounding
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={32}>
                    {(selectedFlag?.top_emotions || []).map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={EMOTION_COLORS[entry.emotion as keyof typeof EMOTION_COLORS] || '#6366f1'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Gemini Coaching */}
          <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden flex flex-col">
            <div className="p-4 border-b border-zinc-100 flex justify-between items-center bg-rose-50/30">
              <h3 className="font-semibold text-zinc-900 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-500" />
                Gemini Coaching
              </h3>
              {!currentBlurb && !isGeneratingBlurb && (
                <button 
                  onClick={handleGenerateBlurb}
                  className="text-[10px] font-bold text-rose-500 uppercase tracking-widest hover:text-rose-600"
                >
                  Generate
                </button>
              )}
            </div>
            <div className="flex-1 p-6 overflow-y-auto">
              {isGeneratingBlurb ? (
                <div className="flex flex-col items-center justify-center h-full space-y-3 text-zinc-400">
                  <div className="w-8 h-8 border-2 border-rose-500 border-t-transparent rounded-full animate-spin" />
                  <p className="text-xs font-medium">Analyzing moment...</p>
                </div>
              ) : currentBlurb ? (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="space-y-6"
                >
                  <div>
                    <h4 className="text-lg font-bold text-zinc-900 leading-tight mb-2">{currentBlurb.headline}</h4>
                    <div className="h-1 w-12 bg-rose-500 rounded-full" />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wider">What Worked</p>
                      <ul className="space-y-1.5">
                        {currentBlurb.what_worked.map((item, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                            <span className="mt-1 w-1 h-1 bg-emerald-400 rounded-full shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="space-y-2">
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">To Improve</p>
                      <ul className="space-y-1.5">
                        {currentBlurb.what_to_improve.map((item, i) => (
                          <li key={i} className="text-xs text-zinc-600 flex items-start gap-2">
                            <span className="mt-1 w-1 h-1 bg-amber-400 rounded-full shrink-0" />
                            {item}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div className="bg-rose-500 p-4 rounded-xl text-white">
                    <p className="text-[10px] font-bold uppercase tracking-widest opacity-70 mb-1">One Action</p>
                    <p className="text-sm font-medium">{currentBlurb.one_action}</p>
                  </div>
                </motion.div>
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center space-y-2">
                  <AlertCircle className="w-8 h-8 text-zinc-200" />
                  <p className="text-sm text-zinc-400">Select a flag and click generate to get AI coaching for this moment.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, suffix = '', color = 'rose', isText = false }: { label: string, value: string | number, suffix?: string, color?: string, isText?: boolean }) {
  const colors = {
    rose: "text-rose-500 bg-rose-50",
    emerald: "text-emerald-600 bg-emerald-50",
    amber: "text-amber-600 bg-amber-50",
  };

  return (
    <div className="bg-white p-4 rounded-2xl border border-zinc-200 shadow-sm">
      <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">{label}</p>
      <p className={cn(
        "text-xl font-bold tracking-tight truncate",
        colors[color as keyof typeof colors] || colors.rose,
        isText && "capitalize text-lg"
      )}>
        {value}{suffix}
      </p>
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