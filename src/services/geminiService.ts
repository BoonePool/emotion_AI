import { GoogleGenAI, Type } from "@google/genai";
import { Flag, SessionMetrics, FlagBlurb, FullSummary } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export const generateFlagBlurb = async (flag: Flag, metrics: SessionMetrics): Promise<FlagBlurb> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Analyze this presentation moment:
    Session Averages: Engagement: ${metrics.avg_engagement_0_1.toFixed(2)}, Distraction: ${metrics.distraction_rate_0_1.toFixed(2)}
    Moment Data: Type: ${flag.type}, Time: ${flag.t_s}s, Severity: ${flag.severity_0_1.toFixed(2)}
    Top Emotions: ${JSON.stringify(flag.top_emotions)}
    Evidence: ${JSON.stringify(flag.evidence)}
    
    Provide a coaching insight in strict JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          flag_id: { type: Type.STRING },
          headline: { type: Type.STRING },
          what_worked: { type: Type.ARRAY, items: { type: Type.STRING } },
          what_to_improve: { type: Type.ARRAY, items: { type: Type.STRING } },
          one_action: { type: Type.STRING },
        },
        required: ["flag_id", "headline", "what_worked", "what_to_improve", "one_action"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as FlagBlurb;
};

export const generateFullSummary = async (
  metrics: SessionMetrics, 
  flags: Flag[],
  dominantEmotions: { emotion: string; value: number }[]
): Promise<FullSummary> => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `Generate a full presentation summary report.
    Metrics: ${JSON.stringify(metrics)}
    Dominant Emotions: ${JSON.stringify(dominantEmotions)}
    Key Moments (Flags): ${JSON.stringify(flags)}
    
    Provide a detailed report in strict JSON format.`,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          executive_summary: { type: Type.ARRAY, items: { type: Type.STRING } },
          strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
          weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
          recommendations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                why: { type: Type.STRING },
                how: { type: Type.STRING },
                expected_impact: { type: Type.STRING, enum: ["high", "medium", "low"] },
              },
              required: ["title", "why", "how", "expected_impact"],
            },
          },
          moment_commentary: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                t_s: { type: Type.INTEGER },
                label: { type: Type.STRING },
                interpretation: { type: Type.STRING },
                fix: { type: Type.STRING },
              },
              required: ["t_s", "label", "interpretation", "fix"],
            },
          },
          one_thing_to_change: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              rationale: { type: Type.STRING },
            },
            required: ["title", "rationale"],
          },
        },
        required: ["executive_summary", "strengths", "weaknesses", "recommendations", "moment_commentary", "one_thing_to_change"],
      },
    },
  });

  return JSON.parse(response.text || "{}") as FullSummary;
};
