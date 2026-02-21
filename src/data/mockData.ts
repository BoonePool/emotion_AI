import { TimeseriesItem, Flag, SessionMetrics, Emotion } from '../types';

export const generateMockTimeseries = (duration: number = 600): TimeseriesItem[] => {
  const data: TimeseriesItem[] = [];
  for (let i = 0; i < duration; i++) {
    data.push({
      t_s: i,
      engagement_mean: 0.4 + Math.random() * 0.4,
      distracted_mean: 0.1 + Math.random() * 0.2,
      happy: Math.random() * 0.2,
      neutral: 0.4 + Math.random() * 0.3,
      sad: Math.random() * 0.05,
      anger: Math.random() * 0.02,
      fear: Math.random() * 0.01,
      surprise: Math.random() * 0.1,
      disgust: Math.random() * 0.01,
    });
  }
  return data;
};

export const generateMockFlags = (timeseries: TimeseriesItem[]): Flag[] => {
  if (timeseries.length === 0) return [];
  
  const flags: Flag[] = [];
  const count = Math.min(5, Math.floor(timeseries.length / 10) + 1);
  
  for (let i = 0; i < count; i++) {
    // Ensure we have some padding for "before" and "after" evidence
    const padding = Math.min(10, Math.floor(timeseries.length / 4));
    const range = Math.max(1, timeseries.length - (padding * 2));
    const t_s = Math.floor(Math.random() * range) + padding;
    
    const type = (['emotion_spike', 'engagement_drop', 'distraction_spike'] as const)[Math.floor(Math.random() * 3)];
    
    const item = timeseries[t_s];
    if (!item) continue;

    const emotions: { emotion: string; value: number }[] = [
      { emotion: 'happy', value: item.happy },
      { emotion: 'neutral', value: item.neutral },
      { emotion: 'sad', value: item.sad },
      { emotion: 'anger', value: item.anger },
      { emotion: 'fear', value: item.fear },
      { emotion: 'surprise', value: item.surprise },
      { emotion: 'disgust', value: item.disgust },
    ].sort((a, b) => b.value - a.value).slice(0, 3);

    const beforeIdx = Math.max(0, t_s - 5);
    const afterIdx = Math.min(timeseries.length - 1, t_s + 5);

    flags.push({
      flag_id: `F_${i + 1}`,
      t_s,
      type,
      severity_0_1: 0.5 + Math.random() * 0.5,
      top_emotions: emotions,
      evidence: {
        engagement_before_0_1: timeseries[beforeIdx]?.engagement_mean || 0,
        engagement_after_0_1: timeseries[afterIdx]?.engagement_mean || 0,
        distracted_peak_0_1: item.distracted_mean + 0.2,
      },
    });
  }
  return flags.sort((a, b) => a.t_s - b.t_s);
};

export const computeSessionMetrics = (timeseries: TimeseriesItem[]): SessionMetrics => {
  if (timeseries.length === 0) {
    return {
      duration_s: 0,
      avg_engagement_0_1: 0,
      distraction_rate_0_1: 0,
      dominant_emotion: 'neutral',
      presentation_score_0_100: 0,
    };
  }
  const avg_engagement = timeseries.reduce((acc, curr) => acc + curr.engagement_mean, 0) / timeseries.length;
  const avg_distraction = timeseries.reduce((acc, curr) => acc + curr.distracted_mean, 0) / timeseries.length;
  
  const emotionSums: Record<string, number> = {
    happy: 0, neutral: 0, sad: 0, anger: 0, fear: 0, surprise: 0, disgust: 0
  };
  
  timeseries.forEach(item => {
    emotionSums.happy += item.happy;
    emotionSums.neutral += item.neutral;
    emotionSums.sad += item.sad;
    emotionSums.anger += item.anger;
    emotionSums.fear += item.fear;
    emotionSums.surprise += item.surprise;
    emotionSums.disgust += item.disgust;
  });

  let dominant_emotion = 'neutral';
  let maxVal = 0;
  Object.entries(emotionSums).forEach(([emotion, sum]) => {
    if (sum > maxVal) {
      maxVal = sum;
      dominant_emotion = emotion;
    }
  });

  const presentation_score = Math.round((avg_engagement * 70) + ( (1 - avg_distraction) * 30));

  return {
    duration_s: timeseries.length,
    avg_engagement_0_1: avg_engagement,
    distraction_rate_0_1: avg_distraction,
    dominant_emotion,
    presentation_score_0_100: presentation_score,
  };
};
