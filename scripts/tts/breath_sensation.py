"""Render the voice-over for the breath_practice block (BreathPracticeBlock.jsx).

Reads the practice script from src/components/study/breathPracticeScript.json —
the same file the component displays — and writes one MP3 per voiced line to
public/audio/breath-sensation/, plus manifest.json recording the exact text of
each clip. The component plays a clip only when its manifest text matches the
caption on screen, so editing the script without re-running this leaves that
line silent rather than spoken wrong.

Engine: Kokoro-82M via kokoro-onnx, run locally on CPU (no API key, nothing
leaves the machine). One-time setup:

    pip install kokoro-onnx soundfile
    # model files (~350 MB) from
    # https://github.com/thewh1teagle/kokoro-onnx/releases/tag/model-files-v1.0
    #   kokoro-v1.0.onnx, voices-v1.0.bin

Usage:

    python scripts/tts/breath_sensation.py --models <dir with the two files> \
        [--voice af_heart] [--speed 0.88]

Needs ffmpeg on PATH (loudness-normalises and encodes mono MP3).
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "src/components/study/breathPracticeScript.json"
OUT = ROOT / "public/audio/breath-sensation"

# The intro is shown before the participant's first tap, when a browser will not
# play sound, so it is never voiced.
VOICED = ["settle", "paced", "cue_in", "cue_out", "anchor",
          "natural_1", "natural_2", "natural_3", "expand", "done"]


def spoken(text: str) -> str:
    """Display text → what the voice should read. Dashes become pauses."""
    return text.replace(" — ", ", ").replace("—", ", ").replace("’", "'")


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=0.88)
    args = ap.parse_args()

    lines = json.loads(SCRIPT.read_text(encoding="utf-8"))
    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"))
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    OUT.mkdir(parents=True, exist_ok=True)

    clips = {}
    with tempfile.TemporaryDirectory() as tmp:
        for key in VOICED:
            text = lines[key]
            audio, sr = kokoro.create(spoken(text), voice=args.voice, speed=args.speed, lang=lang)
            wav = Path(tmp) / f"{key}.wav"
            sf.write(wav, audio, sr)
            mp3 = OUT / f"{key}.mp3"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                 "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000",
                 "-b:a", "48k", str(mp3)],
                check=True,
            )
            clips[key] = {"text": text, "seconds": round(len(audio) / sr, 2)}
            print(f"{key:10s} {clips[key]['seconds']:5.1f} s")

    manifest = {
        "engine": "kokoro-v1.0 (kokoro-onnx)",
        "voice": args.voice,
        "speed": args.speed,
        "clips": clips,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
