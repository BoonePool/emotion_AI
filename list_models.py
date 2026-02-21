import os
from google import genai

API_KEY = os.environ.get("GEMINI_API_KEY")
client = genai.Client(api_key=API_KEY)

print("Available models:")
for model in client.models.list():
    print(f"- {model.name}")