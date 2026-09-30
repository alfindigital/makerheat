#!/usr/bin/env python3
"""Two-voice VO variant for MakerHeat demo via edge-tts (no key needed).
   Male reads the naive story s0-s2, female reads the flip + method s3-s5.
   python scripts/gen-vo-2voice.py  →  public/vo-mf-s*.mp3"""
import asyncio, os
import edge_tts

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
MALE = "en-US-GuyNeural"
FEMALE = "en-US-AriaNeural"

LINES = {
    "vo-mf-s0": (MALE, "Every token page shows you a number. MakerHeat asks how much tape that number is standing on."),
    "vo-mf-s1": (MALE, "Paste a contract. The last hundred swaps say three addresses supplied fifty-three percent of all sell volume — and ninety-five percent of it came from addresses with no buy in the sample."),
    "vo-mf-s2": (MALE, "Looks like a supply wall. Except — that was a hundred events. Four minutes of tape. Is that a signal, or just the window?"),
    "vo-mf-s3": (FEMALE, "Pull nine more pages. A thousand events: the top three settle at thirty-three percent. No-buy volume collapses from ninety-five to twenty-four. And dominant sellers with zero observed buys? Gone by event three hundred — they all bought, just outside the first page."),
    "vo-mf-s4": (FEMALE, "Same token. Same end time. A different sample. MakerHeat draws the curve instead of picking the number — concentration at every depth, seller context at every depth, a hash receipt per page."),
    "vo-mf-s5": (FEMALE, "Descriptive. Sample-bounded. Replayable to the byte. MakerHeat — evidence depth, not vibes."),
}

async def main():
    os.makedirs(BASE, exist_ok=True)
    for name, (voice, text) in LINES.items():
        out = os.path.join(BASE, name + ".mp3")
        await edge_tts.Communicate(text, voice, rate="+5%").save(out)
        print("public/" + name + ".mp3")

asyncio.run(main())
