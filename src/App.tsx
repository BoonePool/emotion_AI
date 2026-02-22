import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { SessionState, TimeseriesItem, Flag, SessionMetrics } from './types';
import { generateMockTimeseries, generateMockFlags, computeSessionMetrics, processRealData } from './data/mockData';
import Home from './pages/Home';
import Report from './pages/Report';
import Summary from './pages/Summary';
import { Layout } from './components/Layout';

export default function App() {
  const [session, setSession] = useState<SessionState>({
    sessionId: 'session_001',
    timeseries: [],
    flags: [],
    flagBlurbs: {},
    fullSummary: null,
    sessionMetrics: null,
    videoUrl: null,
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const initData = async () => {
      try {
        const response = await fetch('/api/emotion-data');
        if (!response.ok) throw new Error('Failed to fetch real data');
        const rawData = await response.json();
        
        const ts = processRealData(rawData);
        const flags = generateMockFlags(ts);
        const metrics = computeSessionMetrics(ts);

        setSession(prev => ({
          ...prev,
          timeseries: ts,
          flags: flags,
          sessionMetrics: metrics,
          transcript: "Welcome everyone to today's presentation on MoodMetrics. We're going to dive deep into how audience emotions can be tracked in real-time. As you can see from the initial data, there's a lot of engagement at the start, but we see some dips later on. Let's analyze why that might be happening.",
          transcriptSegments: [
            { start: 0, end: 5, text: "Welcome everyone to today's presentation on MoodMetrics." },
            { start: 5, end: 12, text: "We're going to dive deep into how audience emotions can be tracked in real-time." },
            { start: 12, end: 20, text: "As you can see from the initial data, there's a lot of engagement at the start, but we see some dips later on." },
            { start: 20, end: 25, text: "Let's analyze why that might be happening." }
          ]
        }));
      } catch (err) {
        console.warn('Falling back to mock data:', err);
        // Fallback to mock data if fetch fails
        const ts = generateMockTimeseries(300);
        const flags = generateMockFlags(ts);
        const metrics = computeSessionMetrics(ts);

        setSession(prev => ({
          ...prev,
          timeseries: ts,
          flags: flags,
          sessionMetrics: metrics,
          transcript: "This is a fallback transcript for the mock session data.",
          transcriptSegments: [
            { start: 0, end: 10, text: "This is a fallback transcript" },
            { start: 10, end: 20, text: "for the mock session data." }
          ]
        }));
      } finally {
        setIsLoading(false);
      }
    };

    initData();
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600 font-medium">Loading MoodMetrics...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout>
        <Routes>
          <Route path="/" element={<Home session={session} setSession={setSession} />} />
          <Route path="/report" element={<Report session={session} />} />
          <Route path="/summary" element={<Summary session={session} setSession={setSession} />} />
        </Routes>
      </Layout>
    </Router>
  );
}