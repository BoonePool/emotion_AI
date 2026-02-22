## Inspiration
We were inspired by the “reading the room” problem: presenters often feel something has changed in the audience but can’t pinpoint when or why. We wanted a tool that turns that fuzzy feedback into measurable signals and actionable coaching.

## What it does
Our project enables presenters to quantitatively evaluate the effectiveness of a presentation by turning audience webcam signals into a post-presentation report. Audience members run a lightweight client that detects facial emotion signals and attention (e.g., distracted vs focused) and logs them as timestamped JSON. After the presentation, the host aggregates everyone’s logs and generates a dashboard/report with charts (dominant emotions, engagement over time) plus “flagged moments” where emotion spikes or attention drops—so the presenter can jump to those timestamps and learn what worked and what didn’t.

# How we built it
Client-side capture (Python): A webcam logger using OpenCV for video frames and MediaPipe FaceMesh for head pose/attention (focused vs distracted), plus FER/TensorFlow for emotion detection when enabled. It writes structured, timestamped JSON per user (e.g., top emotions + confidence + distracted flag). Shared data collection: Each client saves to a local user_data/ log and (optionally) syncs it to a central GitHub repo using a token-based git add/commit/pull --rebase/push flow. Presenter dashboard (Web): A React + Vite + TypeScript dashboard with pages Home / Report / Summary. It loads the aggregated JSON, renders visualizations (bar/line/donut-style charts), highlights key timestamps (“flags”), and offers downloads (JSON/CSV) for deeper analysis. Gemini AI insights: The dashboard can call the Gemini API to turn raw metrics + flags into concise coaching blurbs and a full written summary.

## Dashboard Structure
![Emotion AI Dashboard Structure](images/Emotion%20AI%20Dashboard.png)

## Run Locally

**Prerequisites:**  Node.js

1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## Environment Setup

1. Create a `.env` file in the project root.
2. Add your Gemini API key:
