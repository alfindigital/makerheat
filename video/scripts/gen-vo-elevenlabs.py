#!/usr/bin/env python3
"""VO variant for MakerHeat demo via ElevenLabs — two voices:
   male (Adam) reads the naive story s0-s2, female (Sarah) reads the
   evidence-depth flip s3-s5. ELEVENLABS_API_KEY comes from env only.
   python scripts/gen-vo-elevenlabs.py  →  public/vo-el-s*.mp3"""
import json, os, sys, urllib.request

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
MODEL = "eleven_turbo_v2_5"
VOICES = {
    "male": "pNInz6obpgDQGcFmaJgB",    # Adam — deep narrator
    "female": "EXAVITQu4vr4xnSDxMaL",  # Sarah — clear, measured
}

LINES = {
    "vo-el-s0": ("male", "Every token page shows you a number. MakerHeat asks how much tape that number is standing on."),
    "vo-el-s1": ("male", "Paste a contract. The last hundred swaps say three addresses supplied fifty-three percent of all sell volume — and ninety-five percent of it came from addresses with no buy in the sample."),
    "vo-el-s2": ("male", "Looks like a supply wall. Except — that was a hundred events. Four minutes of tape. Is that a signal, or just the window?"),
    "vo-el-s3": ("female", "Pull nine more pages. A thousand events: the top three settle at thirty-three percent. No-buy volume collapses from ninety-five to twenty-four. And dominant sellers with zero observed buys? Gone by event three hundred — they all bought, just outside the first page."),
    "vo-el-s4": ("female", "Same token. Same end time. A different sample. MakerHeat draws the curve instead of picking the number — concentration at every depth, seller context at every depth, a hash receipt per page."),
    "vo-el-s5": ("female", "Descriptive. Sample-bounded. Replayable to the byte. MakerHeat — evidence depth, not vibes."),
}

def main():
    key = os.environ.get("ELEVENLABS_API_KEY")
    if not key:
        sys.exit("ELEVENLABS_API_KEY missing from environment")
    os.makedirs(BASE, exist_ok=True)
    for name, (v, text) in LINES.items():
        out = os.path.join(BASE, name + ".mp3")
        req = urllib.request.Request(
            f"https://api.elevenlabs.io/v1/text-to-speech/{VOICES[v]}?output_format=mp3_44100_128",
            data=json.dumps({
                "text": text,
                "model_id": MODEL,
                "voice_settings": {"stability": 0.45, "similarity_boost": 0.75, "style": 0.15},
            }).encode(),
            headers={"xi-api-key": key, "Content-Type": "application/json"},
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as res:
                audio = res.read()
        except urllib.error.HTTPError as e:
            sys.exit(f"{name}: HTTP {e.code} — {e.read()[:200]!r}")
        if len(audio) < 1000:
            sys.exit(f"{name}: suspiciously small response ({len(audio)} bytes)")
        with open(out, "wb") as f:
            f.write(audio)
        print(f"public/{name}.mp3  {len(audio)} bytes  ({v}, {len(text)} chars)")

main()
