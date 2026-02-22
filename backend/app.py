import os
import tempfile
import whisper
import subprocess
import cv2
import numpy as np
import mediapipe as mp
from fer.fer import FER
from flask import Flask, request, jsonify
from flask_cors import CORS
from collections import defaultdict
import concurrent.futures
from pydub import AudioSegment

app = Flask(__name__)
CORS(app)

# Control audio enhancement via environment variable (default: off)
ENHANCE_AUDIO = os.getenv("ENHANCE_AUDIO", "false").lower() == "true"

print("Loading Whisper model (this may take a while on first run)...")
whisper_model = whisper.load_model("base")   # faster than "medium"
print("Whisper model loaded.")

# ---------- AUDIO HELPERS ----------
def extract_audio(video_path, audio_path):
    cmd = [
        'ffmpeg', '-i', video_path,
        '-vn', '-acodec', 'pcm_s16le',
        '-ar', '16000', '-ac', '1', audio_path,
        '-y'
    ]
    try:
        subprocess.run(cmd, check=True, capture_output=True, text=True)
    except subprocess.CalledProcessError as e:
        if "Output file is empty" in e.stderr:
            return  # No audio track – skip
        raise Exception(f"FFmpeg error: {e.stderr}")

def enhance_audio(input_path, output_path):
    audio = AudioSegment.from_file(input_path)
    enhanced = audio + 10   # 10dB gain
    enhanced.export(output_path, format="wav")

def transcribe_audio(audio_path):
    result = whisper_model.transcribe(audio_path, language="en")
    return result["text"], result.get("segments", [])
# ------------------------------------

# ... (rest of your emotion detection code remains the same) ...

def process_emotions(video_path):
    timeseries = process_video(video_path, fps_target=1)   # 1 fps for speed
    flags = detect_flags(timeseries)
    metrics = compute_metrics(timeseries)
    return timeseries, flags, metrics

def process_transcription(video_path):
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
        audio_path = tmp_audio.name
    enhanced_audio_path = None
    try:
        extract_audio(video_path, audio_path)
        if ENHANCE_AUDIO:
            enhanced_audio_path = audio_path.replace('.wav', '_enhanced.wav')
            enhance_audio(audio_path, enhanced_audio_path)
            return transcribe_audio(enhanced_audio_path)
        else:
            return transcribe_audio(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)
        if enhanced_audio_path and os.path.exists(enhanced_audio_path):
            os.unlink(enhanced_audio_path)

# ---------- API Endpoint ----------
@app.route('/analyze', methods=['POST'])
def analyze():
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video_file = request.files['video']
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_video:
        video_file.save(tmp_video.name)
        video_path = tmp_video.name

    try:
        with concurrent.futures.ThreadPoolExecutor(max_workers=2) as executor:
            emotion_future = executor.submit(process_emotions, video_path)
            transcript_future = executor.submit(process_transcription, video_path)

            timeseries, flags, metrics = emotion_future.result()
            transcript_text, transcript_segments = transcript_future.result()

        return jsonify({
            "timeseries": timeseries,
            "flags": flags,
            "metrics": metrics,
            "transcript": transcript_text,
            "transcript_segments": transcript_segments
        })
    except Exception as e:
        return jsonify({"error": str(e)}), 500
    finally:
        os.unlink(video_path)

# ... (keep your emotion processing functions) ...

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True, use_reloader=False)