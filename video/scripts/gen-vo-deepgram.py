#!/usr/bin/env python3
"""VO for MakerHeat demo via Deepgram Aura TTS (fallback when ElevenLabs quota is out).
   DEEPGRAM_API_KEY must be in the environment (never committed).
   python scripts/gen-vo-deepgram.py  →  public/vo-s*.mp3
   Numbers track replay group `jup-solana-now` (fixtures/manifest.json)."""
import json, os, sys, urllib.request

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
# Aura-2 voices: arcas (male, warm narrator) / orion / thalia / andromeda ...
MODEL = os.environ.get("DG_VOICE", "aura-2-arcas-en")

LINES = {
    "vo-s0": "Every token page shows you a number. MakerHeat asks how much tape that number is standing on.",
    "vo-s1": "Paste a contract. The last hundred swaps say three addresses supplied fifty-three percent of all sell volume — and ninety-five percent of it came from addresses with no buy in the sample.",
    "vo-s2": "Looks like a supply wall. Except — that was a hundred events. Four minutes of tape. Is that a signal, or just the window?",
    "vo-s3": "Pull nine more pages. A thousand events: the top three settle at thirty-three percent. No-buy volume collapses from ninety-five to twenty-four. And dominant sellers with zero observed buys? Gone by event three hundred — they all bought, just outside the first page.",
    "vo-s4": "Same token. Same end time. A different sample. MakerHeat draws the curve instead of picking the number — concentration at every depth, seller context at every depth, a hash receipt per page.",
    "vo-s5": "Descriptive. Sample-bounded. Replayable to the byte. MakerHeat — evidence depth, not vibes.",
}

def main():
    key = os.environ.get("DEEPGRAM_API_KEY")
    if not key:
        sys.exit("DEEPGRAM_API_KEY missing from environment")
    os.makedirs(BASE, exist_ok=True)
    for name, text in LINES.items():
        out = os.path.join(BASE, name + ".mp3")
        req = urllib.request.Request(
            f"https://api.deepgram.com/v1/speak?model={MODEL}",
            data=json.dumps({"text": text}).encode(),
            headers={
                "Authorization": f"Token {key}",
                "Content-Type": "application/json",
            },
            method="POST",
        )
        with urllib.request.urlopen(req, timeout=30) as res:
            audio = res.read()
        if len(audio) < 1000:
            sys.exit(f"{name}: suspiciously small response ({len(audio)} bytes)")
        with open(out, "wb") as f:
            f.write(audio)
        print(f"public/{name}.mp3  {len(audio)} bytes")

main()
