import cv2
import time
import json
import os
import subprocess
import numpy as np
from datetime import datetime
from dotenv import load_dotenv
from fer.fer import FER

# 1. Setup Environment & JSON File
load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN")
USER = os.getenv("GITHUB_USER")
REPO = os.getenv("GITHUB_REPO")
JSON_FILE = "emotion_data.json"

if not all([TOKEN, USER, REPO]):
    print(f"❌ ERROR: .env variables missing! USER={USER}, REPO={REPO}")
    exit()

def submit_to_github():
    print("\n📤 Submitting JSON to GitHub...")
    try:
        subprocess.run(["git", "add", JSON_FILE], check=True)
        msg = f"JSON Update: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", msg], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True)
        print("✅ Upload successful!")
    except Exception as e:
        print(f"❌ Upload failed: {e}")

# 2. Initialize
detector = FER(mtcnn=False)
cap = cv2.VideoCapture(0)
last_update_time = time.time()
interval = 0.5 
collected_emotions = []
all_data_log = [] # List to hold all session records

# Load existing data if file exists to append to it
if os.path.exists(JSON_FILE):
    with open(JSON_FILE, 'r') as f:
        try:
            all_data_log = json.load(f)
        except json.JSONDecodeError:
            all_data_log = []

print(f"Recording to {JSON_FILE}... Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret: break

    current_time = time.time()
    results = detector.detect_emotions(frame)

    if results:
        collected_emotions.append(results[0]["emotions"])
        (x, y, w, h) = results[0]["box"]
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # 3. Process Half-Second Average
    if current_time - last_update_time >= interval:
        if collected_emotions:
            keys = collected_emotions[0].keys()
            avg_scores = {k: float(np.mean([f[k] for f in collected_emotions])) for k in keys}
            top_3 = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)[:3]

            # Create JSON Entry
            entry = {
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                "top_emotions": [{"emotion": e, "score": round(s, 4)} for e, s in top_3],
                "all_scores": {k: round(v, 4) for k, v in avg_scores.items()}
            }
            all_data_log.append(entry)
            
            # Save locally every interval to prevent data loss
            with open(JSON_FILE, 'w') as f:
                json.dump(all_data_log, f, indent=4)

            collected_emotions = []
        last_update_time = current_time

    cv2.imshow('Emotion JSON Logger', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()
submit_to_github()
