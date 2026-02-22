import os
import json
import glob
from git import Repo
from dotenv import load_dotenv

# 1. Setup
load_dotenv()
TOKEN = os.getenv("GITHUB_TOKEN")
USER = os.getenv("GITHUB_USER")
REPO_NAME = os.getenv("GITHUB_REPO")
DATA_FOLDER = "user_data"
MASTER_FILE = "master_emotion_data.json"

def sync_and_merge():
    # 2. Pull latest data from GitHub
    if os.path.exists(".git"):
        print("[Git] Pulling latest changes...")
        repo = Repo(".")
        # Update remote URL with token if needed for private repos
        remote_url = f"https://{TOKEN}@github.com/{USER}/{REPO_NAME}.git"
        repo.remotes.origin.set_url(remote_url)
        repo.remotes.origin.pull()
    else:
        print("[Error] No git repository found in this directory.")
        return

    # 3. Merge all JSON files in user_data
    master_list = []
    json_pattern = os.path.join(DATA_FOLDER, "*.json")
    files = glob.glob(json_pattern)
    
    print(f"[Merge] Found {len(files)} files to consolidate.")

    for file_path in files:
        # Skip the master file if it happens to be in the same folder
        if MASTER_FILE in file_path:
            continue
            
        try:
            with open(file_path, 'r') as f:
                data = json.load(f)
                if isinstance(data, list):
                    master_list.extend(data)
                else:
                    master_list.append(data)
        except Exception as e:
            print(f"[Error] Could not read {file_path}: {e}")

    # 4. Save the master file
    with open(MASTER_FILE, 'w') as f:
        json.dump(master_list, f, indent=4)
    
    print(f"[Success] Master file created: {MASTER_FILE} ({len(master_list)} total entries)")

if __name__ == "__main__":
    sync_and_merge()
