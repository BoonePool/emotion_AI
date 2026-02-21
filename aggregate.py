import glob
import json
from collections import Counter
from datetime import datetime

def load_data(data_dir="client_data"):
    """Yield all emotion records from all .jsonl files in the given directory."""
    for filepath in glob.glob(f"{data_dir}/*.jsonl"):   # <-- changed to .jsonl
        with open(filepath, "r") as f:
            for line in f:
                record = json.loads(line.strip())
                # convert timestamp to seconds (float) for easier bucket
                record['timestamp_sec'] = record['timestamp'] / 1000.0
                yield record

def aggregate():
    records = list(load_data())
    if not records:
        print("❌ No data found. Check that client_data folder exists and contains .jsonl files.")
        # Optionally save an error file
        error_summary = {"error": "No data found"}
        with open("aggregated_summary.json", "w") as f:
            json.dump(error_summary, f, indent=2)
        return error_summary

    # 1. overall sentiment distribution
    emotions = [r['emotion'] for r in records]
    total = len(emotions)
    emotion_counts = Counter(emotions)
    overall_dist = {emotion: count / total for emotion, count in emotion_counts.items()}

    # 2. timeline (30-second buckets)
    timestamps = [r['timestamp_sec'] for r in records]
    start_time = min(timestamps)
    end_time = max(timestamps)
    bucket_size = 30  # seconds

    buckets = []
    current = start_time
    while current < end_time:
        bucket_end = current + bucket_size
        bucket_emotions = [r['emotion'] for r in records if current <= r['timestamp_sec'] < bucket_end]
        if bucket_emotions:
            dominant = Counter(bucket_emotions).most_common(1)[0][0]
            dist = dict(Counter(bucket_emotions))
        else:
            dominant = None
            dist = {}
        buckets.append({
            "start": current,
            "end": bucket_end,
            "dominant_emotion": dominant,
            "distribution": dist,
            "count": len(bucket_emotions),      # <-- comma now present
        })
        current = bucket_end

    # format start/end as readable time strings
    for b in buckets:
        b['start_str'] = datetime.fromtimestamp(b['start']).strftime("%H:%M:%S")
        b['end_str'] = datetime.fromtimestamp(b['end']).strftime("%H:%M:%S")

    summary = {
        "overall": {
            "total_samples": total,
            "distribution": overall_dist        # <-- removed leading underscore
        },
        "timeline": buckets
    }

    with open("aggregated_summary.json", "w") as f:
        json.dump(summary, f, indent=2)

    print("✅ Aggregation complete. Summary saved to aggregated_summary.json")
    return summary

if __name__ == "__main__":
    aggregate()