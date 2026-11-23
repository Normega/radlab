"""Render the four audio files of the Breath Attention and Emotional Recovery study (plan WP-M2):
the two training scripts and the two break cues, verbatim from the REB package
(Ethics/source_markdown/06_Participant_Instructions_and_Scripts.md). The package promises both
scripts "in the same voice at the same pace", so one voice and one speed render all four.

    python scripts/tts/bre_audio.py --models F:/models/kokoro --out "I:/Shared drives/Maya/Design/audio"
        [--voice af_bella] [--speed 0.9]

Writes bre_train_sf.mp3, bre_train_em.mp3, bre_cue_sf.mp3, bre_cue_em.mp3 and manifest.json
(text, words, seconds, voice, speed). Loudness-normalised to -16 LUFS so the four play at one
level through the lab headphones. Needs kokoro-onnx, soundfile and ffmpeg.
"""

import argparse
import json
import subprocess
import tempfile
from pathlib import Path

import soundfile as sf
from kokoro_onnx import Kokoro

TEXTS = {
    "bre_train_sf": (
        "For this part of the study, you will pay attention to your breathing in a particular way, called sense foraging. "
        "Sense foraging means being curious about the sensory information your body is giving you and exploring how it changes "
        "from moment to moment. As you breathe, you might notice where you feel movement, any pressure or tension, the temperature "
        "of the air, the rhythm of your breathing, the length of each inhale and exhale, or the pauses between breaths. There is no "
        "particular sensation you need to find, and you do not need to change your breathing. If a sensation catches your interest, "
        "stay with it and explore it for a while. When something else draws your attention, let your attention move there. "
        "Whenever you notice that your mind has wandered away from your breathing, gently bring it back and continue exploring."
    ),
    "bre_train_em": (
        "For this part of the study, you will pay attention to your breathing in a particular way, called breath monitoring. "
        "Breath monitoring means keeping track of the overall pattern of your breathing and checking how it compares with your "
        "usual breathing. As you breathe, notice whether your breathing is fast or slow, deep or shallow, regular or irregular, "
        "smooth or uneven, easy or effortful, and whether it seems typical for you or different from usual. There is no particular "
        "sensation you need to find, and you do not need to change your breathing. Keep your attention on the overall pattern of "
        "the breath and keep checking how it compares with what is normal for you. Whenever you notice that your mind has wandered "
        "away from your breathing, gently bring it back and continue monitoring."
    ),
    "bre_cue_sf": "Explore the sensations of your breathing, following whatever catches your interest.",
    "bre_cue_em": "Monitor the overall pattern of your breathing and how it compares with your usual breathing.",
}

LOUDNORM = "I=-16:TP=-1.5:LRA=11"


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--models", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--voice", default="af_bella")
    ap.add_argument("--speed", type=float, default=0.9)
    args = ap.parse_args()

    kokoro = Kokoro(str(args.models / "kokoro-v1.0.onnx"), str(args.models / "voices-v1.0.bin"))
    lang = "en-gb" if args.voice.startswith("b") else "en-us"
    args.out.mkdir(parents=True, exist_ok=True)

    clips = {}
    with tempfile.TemporaryDirectory() as tmp:
        for key, text in TEXTS.items():
            audio, sr = kokoro.create(text, voice=args.voice, speed=args.speed, lang=lang)
            wav = Path(tmp) / f"{key}.wav"
            sf.write(wav, audio, sr)
            mp3 = args.out / f"{key}.mp3"
            # Two-pass loudnorm: one pass undershoots on clips of a few seconds.
            probe = subprocess.run(
                ["ffmpeg", "-hide_banner", "-nostats", "-i", str(wav),
                 "-af", f"loudnorm={LOUDNORM}:print_format=json", "-f", "null", "-"],
                check=True, capture_output=True, text=True,
            ).stderr
            m = json.loads(probe[probe.rindex("{"):probe.rindex("}") + 1])
            second = (f"loudnorm={LOUDNORM}:linear=true:measured_I={m['input_i']}:measured_TP={m['input_tp']}"
                      f":measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}")
            subprocess.run(
                ["ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                 "-af", second, "-ac", "1", "-ar", "24000", "-b:a", "64k", str(mp3)],
                check=True,
            )
            seconds = round(len(audio) / sr, 2)
            clips[key] = {"text": text, "words": len(text.split()), "seconds": seconds}
            print(f"{key:14s} {clips[key]['words']:4d} words {seconds:6.2f} s")

    manifest = {"engine": "kokoro-v1.0 (kokoro-onnx)", "voice": args.voice, "speed": args.speed,
                "loudness": "-16 LUFS integrated, -1.5 dBTP", "clips": clips}
    (args.out / "manifest.json").write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
