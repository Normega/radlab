"""Render the voice cues for Sandy Study 4's paced-breathing practice
(src/components/study/practiceTask/PacedBreathing.jsx).

Writes one MP3 per cue to public/audio/study4-breath/, plus manifest.json
recording the exact text of each clip, in the format useBreathVoice reads. A
step uses them with `voice_base: "/audio/study4-breath/"`.

The texts below must equal the component's CUES exactly: a clip plays only when
its manifest text matches the caption on screen, so if the captions change, edit
CUES here to match and re-run, or that cue goes silent.

Timing: cue_in starts a 4 s inhale, cue_out a 6 s exhale and settle a 2.5 s
settle period, so each clip has to end well inside its phase. The script warns
when one runs past its limit.

Engine and setup as in breath_sensation.py (same voice, speed and loudness, so
the two practices sound alike):

    python scripts/tts/study4_breath.py --models <dir with kokoro-v1.0.onnx
        and voices-v1.0.bin> [--voice af_heart] [--speed 0.88]

Needs ffmpeg on PATH.
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "public/audio/study4-breath"

# key → (caption on screen, longest the clip may run, in seconds)
CUES = {
    "settle":  ("Get comfortable",         2.0),
    "cue_in":  ("In through your nose",    2.5),
    "cue_out": ("Out through your mouth",  3.0),
}


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--voice", default="af_heart")
    ap.add_argument("--speed", type=float, default=0.88)
    args = ap.parse_args()

    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"))
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    OUT.mkdir(parents=True, exist_ok=True)

    clips = {}
    with tempfile.TemporaryDirectory() as tmp:
        for key, (text, limit) in CUES.items():
            audio, sr = kokoro.create(text, voice=args.voice, speed=args.speed, lang=lang)
            wav = Path(tmp) / f"{key}.wav"
            sf.write(wav, audio, sr)
            mp3 = OUT / f"{key}.mp3"
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                 "-af", "loudnorm=I=-18:TP=-2:LRA=7", "-ac", "1", "-ar", "24000",
                 "-b:a", "48k", str(mp3)],
                check=True,
            )
            seconds = round(len(audio) / sr, 2)
            clips[key] = {"text": text, "seconds": seconds}
            flag = "" if seconds <= limit else f"  OVER the {limit} s limit"
            print(f"{key:8s} {seconds:5.2f} s{flag}")

    manifest = {
        "engine": "kokoro-v1.0 (kokoro-onnx)",
        "voice": args.voice,
        "speed": args.speed,
        "clips": clips,
    }
    (OUT / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
