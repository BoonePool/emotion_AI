import cv2
import time
import csv
import os
import subprocess
import numpy as np
from datetime import datetime
from dotenv import load_dotenv 
from fer.fer import FER

# Load tokens from .env
load_dotenv() #
TOKEN = os.getenv("GITHUB_TOKEN")
USER = os.getenv("GITHUB_USER")
REPO = os.getenv("GITHUB_REPO")

def setup_git_remote():
    """Configures the remote origin with the access token automatically."""
    # Format: https://<TOKEN>@github.com/<USER>/<REPO>.git
    remote_url = f"https://{TOKEN}@github.com/{USER}/{REPO}.git"
    
    try:
        # Check if remote already exists
        remotes = subprocess.check_output(["git", "remote"], text=True)
        if "origin" in remotes:
            subprocess.run(["git", "remote", "set-url", "origin", remote_url], check=True)
        else:
            subprocess.run(["git", "remote", "add", "origin", remote_url], check=True)
        print("Git remote configured with token.")
    except Exception as e:
        print(f"Git Setup Error: {e}")

def submit_to_github():
    print("\nSubmitting to GitHub...")
    try:
        subprocess.run(["git", "add", "emotion_data.csv"], check=True)
        msg = f"Session: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
        subprocess.run(["git", "commit", "-m", msg], check=True)
        subprocess.run(["git", "push", "origin", "main"], check=True) #
        print("Upload successful!")
    except subprocess.CalledProcessError as e:
        print(f"Upload failed: {e}")

# --- Initialize ---
setup_git_remote()
csv_file = "emotion_data.csv"
fields = ['Timestamp', 'Emotion_1', 'Score_1', 'Emotion_2', 'Score_2', 'Emotion_3', 'Score_3']

# Create file with headers if it doesn't exist
if not os.path.exists(csv_file):
    with open(csv_file, 'w', newline='') as f:
        writer = csv.writer(f)
        writer.writerow(fields)

# 2. Initialize Detector
detector = FER(mtcnn=False)
cap = cv2.VideoCapture(0)

# Tracking variables
last_update_time = time.time()
interval = 0.5 
collected_emotions = []

print(f"Logging data to {csv_file}... Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret: break

    current_time = time.time()
    results = detector.detect_emotions(frame)

    if results:
        # Collect dict from the first face found
        collected_emotions.append(results[0]["emotions"])
        
        # Draw current face box
        (x, y, w, h) = results[0]["box"]
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # 3. Process Half-Second Average & Log to CSV
    if current_time - last_update_time >= interval:
        if collected_emotions:
            # Average the scores
            keys = collected_emotions[0].keys()
            avg_scores = {k: np.mean([f[k] for f in collected_emotions]) for k in keys}
            top_3 = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)[:3]

            # Prepare Data Row
            now = datetime.now().strftime("%H:%M:%S.%f")[:-3] # HH:MM:SS.mmm
            row = [now]
            for emotion, score in top_3:
                row.extend([emotion, f"{score:.4f}"])

            # Write to CSV using [Python's context manager](https://docs.python.org)
            with open(csv_file, 'a', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(row)

            # Update Display Overlay
            for i, (emotion, score) in enumerate(top_3):
                cv2.putText(frame, f"LOGGED: {emotion} ({score:.2f})", (x, y - 10 - (i * 25)), 
                            cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 0, 0), 2)

            collected_emotions = []
        last_update_time = current_time

    cv2.imshow('Emotion Logger', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()
submit_to_github()
