import { useState, useEffect, useMemo } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { SessionState, TimeseriesItem, Flag, SessionMetrics } from './types';
import { generateMockTimeseries, generateMockFlags, computeSessionMetrics } from './data/mockData';
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
  });

  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Initialize with mock data
    const ts = generateMockTimeseries(300); // 5 mins
    const flags = generateMockFlags(ts);
    const metrics = computeSessionMetrics(ts);

    setSession(prev => ({
      ...prev,
      timeseries: ts,
      flags: flags,
      sessionMetrics: metrics,
    }));
    setIsLoading(false);
  }, []);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen bg-zinc-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-rose-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-zinc-600 font-medium">Loading Emotion AI...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <Layout session={session} setSession={setSession}>
        <Routes>
          <Route path="/" element={<Home session={session} setSession={setSession} />} />
          <Route path="/report" element={<Report session={session} />} />
          <Route path="/summary" element={<Summary session={session} setSession={setSession} />} />
        </Routes>
      </Layout>
    </Router>
  );
}
