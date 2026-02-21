import cv2
import time
from fer.fer import FER
import numpy as np

# Initialize detector
detector = FER(mtcnn=False)
cap = cv2.VideoCapture(0)

# Tracking variables
last_update_time = time.time()
interval = 0.5  # Half-second window
collected_frames_emotions = []  # List to store emotion dicts for the interval
display_top_3 = []              # What we actually show on screen

print("Starting... Averaging every 0.5s. Press 'q' to quit.")

while True:
    ret, frame = cap.read()
    if not ret: break

    current_time = time.time()
    results = detector.detect_emotions(frame)

    # 1. Collect data for this frame
    if results:
        # We'll track the first face detected for the average
        collected_frames_emotions.append(results[0]["emotions"])
        
        # Draw the box for the current face regardless of the average
        (x, y, w, h) = results[0]["box"]
        cv2.rectangle(frame, (x, y), (x + w, y + h), (0, 255, 0), 2)

    # 2. Check if 0.5 seconds have passed
    if current_time - last_update_time >= interval:
        if collected_frames_emotions:
            # Calculate mean for each emotion key
            avg_emotions = {}
            keys = collected_frames_emotions[0].keys()
            
            for key in keys:
                avg_emotions[key] = np.mean([f[key] for f in collected_frames_emotions])
            
            # Sort and get top 3
            display_top_3 = sorted(avg_emotions.items(), key=lambda x: x[1], reverse=True)[:3]
            
            # Reset for next interval
            collected_frames_emotions = []
        
        last_update_time = current_time

    # 3. Display the "Averaged" results
    if results and display_top_3:
        (x, y, w, h) = results[0]["box"]
        for i, (emotion, score) in enumerate(display_top_3):
            text = f"AVG {emotion}: {score:.2f}"
            cv2.putText(frame, text, (x, y - 10 - (i * 25)), 
                        cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 0), 2)

    cv2.imshow('Averaged Emotion Detection', frame)
    if cv2.waitKey(1) & 0xFF == ord('q'):
        break

cap.release()
cv2.destroyAllWindows()
