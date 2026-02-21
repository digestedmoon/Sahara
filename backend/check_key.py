import os
from dotenv import load_dotenv

def check_env():
    load_dotenv()
    key = os.getenv("GEMINI_API_KEY")
    if not key:
        print("GEMINI_API_KEY NOT FOUND")
    else:
        print(f"Key loaded! Length: {len(key)}")
        print(f"First 5: {key[:5]}")
        print(f"Last 5: {key[-5:]}")
        if '"' in key:
            print("WARNING: Key contains double quotes!")

if __name__ == "__main__":
    check_env()
