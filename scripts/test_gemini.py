import os
import json
from google import genai

# ========== CONFIGURATION ==========
API_KEY = os.environ.get("GEMINI_API_KEY")  # make sure this is set
MODEL_NAME = "models/gemini-2.5-flash"              # works with new SDK
INPUT_JSON = "aggregated_summary.json"
# ====================================

def load_aggregated_data(filepath):
    if not os.path.exists(filepath):
        print(f"❌ {filepath} not found. Please run aggregate.py first.")
        return None
    with open(filepath, "r") as f:
        return json.load(f)

def build_prompt(data):
    overall_dist = data["overall"]["distribution"]
    timeline = data["timeline"]

    timeline_summary = []
    for entry in timeline:
        timeline_summary.append({
            "time_range": f"{entry['start_str']} - {entry['end_str']}",
            "dominant_emotion": entry['dominant_emotion'],
            "count": entry['count'],
            "distribution": entry['distribution']
        })

    prompt = f"""
You are an expert presentation coach. Below is aggregated audience emotion data from a presentation.

OVERALL SENTIMENT DISTRIBUTION (percentage per emotion):
{json.dumps(overall_dist, indent=2)}

TIMELINE (30‑second buckets) with time range, dominant emotion, number of observations, and full distribution:
{json.dumps(timeline_summary, indent=2)}

Based on this data, provide:
1. A one‑sentence summary of the audience's overall engagement.
2. Key moments: mention specific time ranges where notable shifts occurred (e.g., a sudden increase in confusion or surprise). Use the time ranges from the timeline.
3. Three actionable tips for the presenter to improve future talks.

Format your response as a JSON object with exactly these keys:
- "summary" (string)
- "key_moments" (list of strings)
- "tips" (list of strings)

Do not include any other text before or after the JSON.
"""
    return prompt

def call_gemini(prompt):
    # Create a client (no global configure)
    client = genai.Client(api_key=API_KEY)
    # Call generate_content on the client, passing model and prompt
    response = client.models.generate_content(
        model=MODEL_NAME,
        contents=prompt
    )
    return response.text

def parse_response(text):
    text = text.strip()
    if text.startswith("```json"):
        text = text[7:]
    if text.startswith("```"):
        text = text[3:]
    if text.endswith("```"):
        text = text[:-3]
    text = text.strip()
    return json.loads(text)

def main():
    data = load_aggregated_data(INPUT_JSON)
    if data is None:
        return
    prompt = build_prompt(data)
    print("🤖 Calling Gemini API...")
    raw_response = call_gemini(prompt)
    try:
        insights = parse_response(raw_response)
        print("✅ Insights extracted:")
        print(json.dumps(insights, indent=2))
    except json.JSONDecodeError:
        print("❌ Failed to parse Gemini response as JSON. Raw response:")
        print(raw_response)

if __name__ == "__main__":
    main()