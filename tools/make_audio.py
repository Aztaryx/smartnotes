"""Makes the audio clips for smartnotes. Run from the smartnotes folder:
    python tools/make_audio.py
Only new or changed lines are generated. Old clips are deleted."""
import hashlib, json, re, shutil, subprocess, sys
from pathlib import Path

VOICE = "en_US-lessac-medium"   # try others at rhasspy.github.io/piper-samples
ROOT = Path(__file__).resolve().parent.parent
VOICES = ROOT / "tools" / "voices"
OUT = ROOT / "audio"
FFMPEG = shutil.which("ffmpeg")
EXT = ".mp3" if FFMPEG else ".wav"

def spoken(t):  # must match spoken() in js/app.js
    t = re.sub(r"\{(\d+)\}", r"blank \1", t)
    return t.replace("+", " plus ").replace("=", " equals ").removeprefix("- ")

def texts(c):
    out = []
    for s in c["sections"]:
        out += [spoken(l) for l in s["lines"]]
    for n, b in c["blanks"].items():
        out += [b.get("say") or b["answer"], f"Blank {n}"]
    for q in c["quiz"]:
        out += [f"{q.get('say') or q['text']}. Traditional or modern?",
                f"Correct! {q['why']}", f"Not quite. It is {q['answer']}. {q['why']}"]
    return list(dict.fromkeys(out))

def make(text, path):
    wav = path.with_suffix(".wav")
    subprocess.run([sys.executable, "-m", "piper", "-m", VOICE, "--data-dir", str(VOICES),
                    "-f", str(wav)], input=text.encode(), check=True)
    if FFMPEG:
        subprocess.run([FFMPEG, "-y", "-loglevel", "error", "-i", str(wav),
                        "-codec:a", "libmp3lame", "-q:a", "5", str(path)], check=True)
        wav.unlink()

manifest, keep = {}, set()
for lib in json.loads((ROOT / "content/library.json").read_text()):
    c = json.loads((ROOT / "content" / lib["file"]).read_text())
    for t in texts(c):
        name = hashlib.sha1((VOICE + t).encode()).hexdigest()[:12] + EXT
        manifest[t] = name; keep.add(name)
        if not (OUT / name).exists():
            print("making:", t[:60]); make(t, OUT / name)
for f in OUT.iterdir():
    if f.name not in keep and f.name != "manifest.json":
        f.unlink()
(OUT / "manifest.json").write_text(json.dumps(manifest, indent=1))
print(f"Done. {len(manifest)} clips.")
