#!/usr/bin/env python3
"""VO for MakerHeat demo via edge-tts (one voice, all scenes).
   python scripts/gen-vo.py  →  public/vo-s*.mp3
   Numbers track replay group `jup-solana-now` (fixtures/manifest.json)."""
import asyncio, os
import edge_tts

BASE = os.path.join(os.path.dirname(__file__), "..", "public")
VOICE = "en-US-GuyNeural"

LINES = {
    "vo-s0": "Every token page shows you a number. MakerHeat asks how much tape that number is standing on.",
    "vo-s1": "Paste a contract. The last hundred swaps say three addresses supplied fifty-three percent of all sell volume — and ninety-five percent of it came from addresses with no buy in the sample.",
    "vo-s2": "Looks like a supply wall. Except — that was a hundred events. Four minutes of tape. Is that a signal, or just the window?",
    "vo-s3": "Pull nine more pages. A thousand events: the top three settle at thirty-three percent. No-buy volume collapses from ninety-five to twenty-four. And dominant sellers with zero observed buys? Gone by event three hundred — they all bought, just outside the first page.",
    "vo-s4": "Same token. Same end time. A different sample. MakerHeat draws the curve instead of picking the number — concentration at every depth, seller context at every depth, a hash receipt per page.",
    "vo-s5": "Descriptive. Sample-bounded. Replayable to the byte. MakerHeat — evidence depth, not vibes.",
}

async def main():
    os.makedirs(BASE, exist_ok=True)
    for name, text in LINES.items():
        out = os.path.join(BASE, name + ".mp3")
        await edge_tts.Communicate(text, VOICE, rate="+5%").save(out)
        print("public/" + name + ".mp3")

asyncio.run(main())
