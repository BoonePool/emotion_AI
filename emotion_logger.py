import os
import cv2
import time
import json
import subprocess
import numpy as np
import threading
from datetime import datetime
from dotenv import load_dotenv
from fer.fer import FER
import mediapipe as mp

# 1. Setup Environment
load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN")
USER = os.getenv("GITHUB_USER")
REPO = os.getenv("GITHUB_REPO")

# Organize data into a subfolder
DATA_FOLDER = "user_data"
os.makedirs(DATA_FOLDER, exist_ok=True)

USER_ID = os.getenv("USER_ID") or input("Enter User ID: ").strip().replace(" ", "_")
JSON_FILE = os.path.join(DATA_FOLDER, f"emotion_data_{USER_ID}.json")

def submit_to_github():
    """Syncs user_data folder using Token authentication."""
    def upload_task():
        if not all([TOKEN, USER, REPO]):
            print("[Git] Error: Missing .env credentials.")
            return

        remote_url = f"https://{TOKEN}@github.com/{USER}/{REPO}.git"
        try:
            # Update remote with token for seamless push
            subprocess.run(["git", "remote", "set-url", "origin", remote_url], check=True)
            subprocess.run(["git", "add", DATA_FOLDER], check=True)
            msg = f"Update {USER_ID}: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
            subprocess.run(["git", "commit", "-m", msg], check=True)
            
            # Rebase ensures we don't have merge conflicts with other users' files
            subprocess.run(["git", "pull", "--rebase", "origin", "main"], check=True)
            subprocess.run(["git", "push", "origin", "main"], check=True)
            print(f"[Git] Successfully pushed data for {USER_ID}")
        except Exception as e:
            print(f"[Git] Sync failed: {e}")
            
    thread = threading.Thread(target=upload_task, daemon=True)
    thread.start()

# 2. Parameters & Initialization
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

mp_face_mesh = mp.solutions.face_mesh
detector = FER(mtcnn=False)
cap = cv2.VideoCapture(0)

last_update_time = time.time()
interval = 1
collected_emotions = []
all_data_log = []

if os.path.exists(JSON_FILE):
    with open(JSON_FILE, 'r') as f:
        try: all_data_log = json.load(f)
        except: all_data_log = []

print(f"Tracking: {USER_ID}. Press 'q' to quit.")

# 3. Main Loop
with mp_face_mesh.FaceMesh(max_num_faces=1, refine_landmarks=True) as face_mesh:
    while cap.isOpened():
        success, frame = cap.read()
        if not success: break
        
        h, w, _ = frame.shape
        current_time = time.time()

        # --- PART A: Emotion Detection ---
        emotion_results = detector.detect_emotions(frame)
        if emotion_results: # Safety check for detected face
            collected_emotions.append(emotion_results[0]["emotions"])
            (ex, ey, ew, eh) = emotion_results[0]["box"]
            cv2.rectangle(frame, (ex, ey), (ex + ew, ey + eh), (0, 255, 0), 2)

        # --- PART B: Head Pose ---
        img_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mesh_results = face_mesh.process(img_rgb)
        status, status_color, pitch_val = "Focused", (0, 255, 0), 0.0
        current_is_distracted = False

        if mesh_results.multi_face_landmarks:
            landmarks = mesh_results.multi_face_landmarks[0]
            image_points = get_image_points(landmarks, w, h)
            ok, rot_vec, _ = cv2.solvePnP(MODEL_POINTS, image_points, camera_matrix, dist_coeffs)
            if ok:
                rot_mat, _ = cv2.Rodrigues(rot_vec)
                proj_mat = np.hstack((rot_mat, np.zeros((3, 1))))
                _, _, _, _, _, _, euler = cv2.decomposeProjectionMatrix(proj_mat)
                pitch_val = -euler.flatten()[0]
                if pitch_val < -20.0:
                    status, status_color, current_is_distracted = "DISTRACTED", (0, 0, 255), True

        # --- PART C: Logging ---
        if current_time - last_update_time >= interval:
            # Only log if we successfully captured emotions in this interval
            if collected_emotions:
                avg_scores = {k: float(np.mean([f[k] for f in collected_emotions])) for k in collected_emotions[0].keys()}
                top_3 = sorted(avg_scores.items(), key=lambda x: x[1], reverse=True)[:3]

                all_data_log.append({
                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3],
                    "user": USER_ID,
                    "distracted": current_is_distracted,
                    "pitch": round(pitch_val, 2),
                    "top_emotions": [{"emotion": e, "score": round(s, 4)} for e, s in top_3],
                })
                with open(JSON_FILE, 'w') as f:
                    json.dump(all_data_log, f, indent=4)
                collected_emotions = [] # Reset for next interval
            last_update_time = current_time

        cv2.putText(frame, f"User: {USER_ID} | {status}", (20, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.7, status_color, 2)
        cv2.imshow('Multi-User Tracker', frame)
        if cv2.waitKey(1) & 0xFF == ord('q'): break

cap.release()
cv2.destroyAllWindows()
submit_to_github()