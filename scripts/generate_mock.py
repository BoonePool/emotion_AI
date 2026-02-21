import random
import time
import json
import os

os.makedirs("client_data", exist_ok=True)   # creates folder if needed

emotions = ["happy", "neutral", "confused", "surprised"]
start = time.time() * 1000  # current time in ms

with open("client_data/client1.jsonl", "w") as f:   # .jsonl extension
    for i in range(100):
        ts = start + i * 2000  # every 2 seconds
        emotion = random.choice(emotions)
        f.write(json.dumps({"timestamp": ts, "emotion": emotion}) + "\n")

print("✅ Mock data generated in client_data/client1.jsonl")