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
import time
from datetime import datetime
from collections import defaultdict
import threading
import concurrent.futures
from pydub import AudioSegment

app = Flask(__name__)
CORS(app)  # Allow frontend to call this API
print("Loading Whisper model (this may take a while on first run)...")
whisper_model = whisper.load_model("medium")
print("Whisper model loaded.")
# ---------- NEW HELPER FUNCTIONS FOR AUDIO ----------
def extract_audio(video_path, audio_path):
    """Extract audio from video to a mono 16kHz WAV file using ffmpeg."""
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
            return # No audio track, but not a critical error
        else:
            raise Exception(f"FFmpeg error: {e.stderr}")

def enhance_audio(input_path, output_path):
    """Apply a simple gain to the audio."""
    audio = AudioSegment.from_file(input_path)
    # Apply a 10dB gain to make speech clearer
    enhanced = audio + 10
    enhanced.export(output_path, format="wav")

def transcribe_audio(audio_path):
    """Transcribe audio file using Whisper."""
    result = whisper_model.transcribe(audio_path, language="en")  # or remove language for auto-detect
    return result["text"], result.get("segments", [])
# ----------------------------------------------------

# ---------- Emotion + Head Pose Setup ----------
mp_face_mesh = mp.solutions.face_mesh
detector = FER(mtcnn=False)

camera_matrix = np.array([[617.0, 0., 327.4], [0., 616.4, 245.7], [0., 0., 1.]], dtype="double")
dist_coeffs = np.zeros((4,1))
MODEL_POINTS = np.array([
    [0.0, 0.0, 0.0], [0.0, -330.0, -65.0], [-225.0, 170.0, -135.0],
    [225.0, 170.0, -135.0], [-150.0, -150.0, -125.0], [150.0, -150.0, -125.0]
], dtype=np.float32)
LANDMARK_IDS = [1, 152, 263, 33, 287, 57]

def get_image_points(landmarks, w, h):
    return np.array([(int(landmarks.landmark[idx].x * w), int(landmarks.landmark[idx].y * h)) 
                     for idx in LANDMARK_IDS], dtype=np.float32)

def process_video(video_path, fps_target=2):
    """Process video file, return list of per‑second aggregated data."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise Exception("Could not open video file")

    # Get original FPS to know how many frames per second
    original_fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval = max(1, int(original_fps / fps_target))  # Process at ~fps_target

    frame_data = []  # raw data for each processed frame
    with mp_face_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True) as face_mesh:
        frame_idx = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                break

            # Process only every `frame_interval`-th frame
            if frame_idx % frame_interval == 0:
                h, w, _ = frame.shape
                timestamp = cap.get(cv2.CAP_PROP_POS_MSEC) / 1000.0  # seconds

                # Emotion detection
                emotions = {}
                emotion_results = detector.detect_emotions(frame)
                if emotion_results:
                    emotions = emotion_results[0]["emotions"]

                # Head pose (distracted)
                img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mesh_results = face_mesh.process(img_rgb)
                distracted = False
                pitch = 0.0
                if mesh_results.multi_face_landmarks:
                    landmarks = mesh_results.multi_face_landmarks[0]
                    image_points = get_image_points(landmarks, w, h)
                    ok, rot_vec, _ = cv2.solvePnP(MODEL_POINTS, image_points, camera_matrix, dist_coeffs)
                    if ok:
                        rot_mat, _ = cv2.Rodrigues(rot_vec)
                        proj_mat = np.hstack((rot_mat, np.zeros((3, 1))))
                        _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(proj_mat)
                        pitch = -euler.flatten()[0]
                        if pitch < -20.0:
                            distracted = True

                frame_data.append({
                    "timestamp": timestamp,
                    "emotions": emotions,
                    "distracted": distracted,
                    "pitch": pitch
                })

            frame_idx += 1

    cap.release()

    # Aggregate per second
    per_second = defaultdict(lambda: {
        "emotions": defaultdict(list),
        "distracted": [],
        "pitch": []
    })

    for d in frame_data:
        sec = int(d["timestamp"])
        per_second[sec]["distracted"].append(1 if d["distracted"] else 0)
        per_second[sec]["pitch"].append(d["pitch"])
        for em, score in d["emotions"].items():
            per_second[sec]["emotions"][em].append(score)

    timeseries = []
    for sec in sorted(per_second.keys()):
        data = per_second[sec]
        # Average emotions
        avg_emotions = {}
        for em, scores in data["emotions"].items():
            avg_emotions[em] = np.mean(scores) if scores else 0.0
        # Ensure all emotion keys exist
        for em in ['angry', 'disgust', 'fear', 'happy', 'sad', 'surprise', 'neutral']:
            avg_emotions.setdefault(em, 0.0)

        timeseries.append({
            "t_s": sec,
            "engagement_mean": 1.0 - np.mean(data["distracted"]),  # simple proxy
            "distracted_mean": np.mean(data["distracted"]),
            "happy": avg_emotions["happy"],
            "neutral": avg_emotions["neutral"],
            "sad": avg_emotions["sad"],
            "anger": avg_emotions["angry"],
            "fear": avg_emotions["fear"],
            "surprise": avg_emotions["surprise"],
            "disgust": avg_emotions["disgust"]
        })
    return timeseries

# ---------- Flag Detection (simple heuristics) ----------
def detect_flags(timeseries):
    flags = []
    if len(timeseries) < 10:
        return flags

    # Example: engagement drop flag
    for i in range(1, len(timeseries)-1):
        # Engagement drop: current engagement < 0.3 and drop > 0.2 from previous
        if (timeseries[i]["engagement_mean"] < 0.3 and
            timeseries[i-1]["engagement_mean"] - timeseries[i]["engagement_mean"] > 0.2):
            flags.append({
                "flag_id": f"flag_{len(flags)}",
                "t_s": timeseries[i]["t_s"],
                "type": "engagement_drop",
                "severity_0_1": 1.0 - timeseries[i]["engagement_mean"],
                "top_emotions": sorted(
                    [{"emotion": k, "value": v} for k, v in timeseries[i].items() if k in ['happy','neutral','sad','anger','fear','surprise','disgust']],
                    key=lambda x: x["value"], reverse=True
                )[:3],
                "evidence": {
                    "engagement_before_0_1": timeseries[i-1]["engagement_mean"],
                    "engagement_after_0_1": timeseries[i+1]["engagement_mean"] if i+1 < len(timeseries) else 0,
                }
            })
    # You can add more flag types (emotion spike, distraction spike) similarly
    return flags

def compute_metrics(timeseries):
    if not timeseries:
        return None
    avg_engagement = np.mean([t["engagement_mean"] for t in timeseries])
    avg_distraction = np.mean([t["distracted_mean"] for t in timeseries])
    # Dominant emotion: sum over all seconds
    emotion_sums = {e:0 for e in ['happy','neutral','sad','anger','fear','surprise','disgust']}
    for t in timeseries:
        for e in emotion_sums:
            emotion_sums[e] += t[e]
    dominant = max(emotion_sums, key=emotion_sums.get)
    score = int(round((avg_engagement * 70 + (1-avg_distraction) * 30)))
    return {
        "duration_s": len(timeseries),
        "avg_engagement_0_1": avg_engagement,
        "distraction_rate_0_1": avg_distraction,
        "dominant_emotion": dominant,
        "presentation_score_0_100": score
    }
def process_emotions(video_path):
    """Run emotion detection pipeline."""
    timeseries = process_video(video_path)
    flags = detect_flags(timeseries)
    metrics = compute_metrics(timeseries)
    return timeseries, flags, metrics

def process_transcription(video_path):
    """Extract audio and transcribe."""
    with tempfile.NamedTemporaryFile(delete=False, suffix='.wav') as tmp_audio:
        audio_path = tmp_audio.name
    try:
        extract_audio(video_path, audio_path)
        # Enhance the audio to improve transcription quality
        enhanced_audio_path = audio_path.replace('.wav', '_enhanced.wav')
        enhance_audio(audio_path, enhanced_audio_path)

        return transcribe_audio(audio_path)
    finally:
        if os.path.exists(audio_path):
            os.unlink(audio_path)

# ---------- API Endpoint ----------

@app.route('/analyze', methods=['POST'])
def analyze():
    if 'video' not in request.files:
        return jsonify({"error": "No video file provided"}), 400

    video_file = request.files['video']
    
    # Save video to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix='.webm') as tmp_video:
        video_file.save(tmp_video.name)
        video_path = tmp_video.name

    try:
        # Run emotion processing and transcription in parallel
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

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)