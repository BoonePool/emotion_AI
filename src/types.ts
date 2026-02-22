export type Emotion = 'happy' | 'neutral' | 'sad' | 'anger' | 'fear' | 'surprise' | 'disgust';

export interface TimeseriesItem {
  t_s: number;
  engagement_mean: number;
  distracted_mean: number;
  pitch?: number;
  happy: number;
  neutral: number;
  sad: number;
  anger: number;
  fear: number;
  surprise: number;
  disgust: number;
}

export interface Flag {
  flag_id: string;
  t_s: number;
  type: 'emotion_spike' | 'engagement_drop' | 'distraction_spike';
  severity_0_1: number;
  top_emotions: { emotion: string; value: number }[];
  evidence: {
    engagement_before_0_1?: number;
    engagement_after_0_1?: number;
    distracted_peak_0_1?: number;
  };
}

export interface SessionMetrics {
  duration_s: number;
  avg_engagement_0_1: number;
  distraction_rate_0_1: number;
  dominant_emotion: string;
  presentation_score_0_100: number;
}

export interface FlagBlurb {
  flag_id: string;
  headline: string;
  what_worked: string[];
  what_to_improve: string[];
  one_action: string;
}

export interface Recommendation {
  title: string;
  why: string;
  how: string;
  expected_impact: 'high' | 'medium' | 'low';
}

export interface MomentCommentary {
  t_s: number;
  label: string;
  interpretation: string;
  fix: string;
}

export interface FullSummary {
  executive_summary: string[];
  strengths: string[];
  weaknesses: string[];
  recommendations: Recommendation[];
  moment_commentary: MomentCommentary[];
  one_thing_to_change: {
    title: string;
    rationale: string;
  };
}

export interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

export interface SessionState {
  sessionId: string;
  timeseries: TimeseriesItem[];
  flags: Flag[];
  flagBlurbs: Record<string, FlagBlurb>;
  fullSummary: FullSummary | null;
  sessionMetrics: SessionMetrics | null;
  videoUrl: string | null;
  transcript?: string;
  transcriptSegments?: TranscriptSegment[];
}

declare global {
  interface Window {
    aistudio: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}