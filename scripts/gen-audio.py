#!/usr/bin/env python3
"""Pre-generate the app's English speech with Kokoro TTS (voice af_heart).

Reads the letters from src/content/letters.ts and writes small mono mp3s to
public/audio/en/, plus two manifests:
  - src/audio/clips.gen.json    what audio.ts plays (spoken text -> file)
  - public/audio/manifest.json  every mp3 under public/audio, for the service worker to precache

Recorded clips (Ido's, e.g. ElevenLabs) go in with the same trim and loudness:
  python scripts/gen-audio.py --clip in.mp3 public/audio/he/kol-hakavod.mp3

Run it after adding letters or words (not run in CI), then bump CACHE in public/sw.js
so installed copies fetch the new files:
  python scripts/gen-audio.py            # phrases, words and letter sounds
  python scripts/gen-audio.py --preview  # also writes WAVs + spectrograms of the letter sounds to /tmp/lia-sounds

Needs: pip install kokoro-onnx soundfile imageio-ffmpeg, and the model files
kokoro-v1.0.onnx + voices-v1.0.bin (github.com/thewh1teagle/kokoro-onnx releases,
model-files-v1.0) in $KOKORO_MODELS (default /workspace/agent/.cache/kokoro-models).
"""

import json, os, re, subprocess, sys, tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import imageio_ffmpeg

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public/audio/en"
CLIPS_JSON = ROOT / "src/audio/clips.gen.json"
MODELS = Path(os.environ.get("KOKORO_MODELS", "/workspace/agent/.cache/kokoro-models"))
VOICE, SPEED, SR_OUT = "af_heart", 0.9, 24000
FF = imageio_ffmpeg.get_ffmpeg_exe()

# Extra phrases the app speaks besides the per-letter ones.
EXTRA = ["This is", "and this is"]

# Letter names the phonemizer gets wrong in "<X> says" ("A" comes out as the article).
NAME_IPA = {"A": "ˈeɪ", "I": "ˈaɪ"}

# Isolated letter sounds, cut out of a word Kokoro says well (see cut_sound).
# kind: fric (hiss), stop (unvoiced: burst only), vstop (voiced: burst + a hint of voicing),
# vowel (steady part; F1/F2 window in Hz), nasal (steady hum).
# Candidates are tried in order; the first that yields a clean segment wins.
SOUNDS = {
    "s": ("fric", [("ˈsʌn", 0.7), ("sˈɪt", 0.7)]),
    "a": ("vowel", [("ˈæpəl", 0.7), ("ˈæt", 0.7)], (800, 1300, 1750, 2450)),
    "t": ("stop", [("tˈaɪɡɚ", 0.9), ("tˈʌ", 0.9)]),
    "p": ("stop", [("pˈɪɡ", 0.9), ("pˈʌ", 0.9)]),
    "i": ("vowel", [("ˈɪnsɛkt", 0.7), ("ˈɪt", 0.9)], (280, 560, 2150, 2900)),
    "n": ("nasal", [("ˈnːːː", 0.5), ("nˈoʊz", 0.6)]),
    "m": ("nasal", [("ˈmːːː", 0.5), ("mˈaʊs", 0.6)]),
    "d": ("vstop", [("dˈɑːɡ", 0.9), ("dˈʌ", 0.8)]),
    "g": ("vstop", [("ɡˈoʊt", 0.9), ("ɡˈʌ", 0.9)]),
    "o": ("vowel", [("ˈɑːktəpəs", 0.7), ("ˈɒt", 0.7)], (750, 1150, 1050, 1650)),
    "k": ("stop", [("kˈæt", 0.9), ("kˈʌ", 0.9)]),
    "e": ("vowel", [("ˈɛlɪfənt", 0.7), ("ˈɛt", 0.9)], (650, 1000, 1900, 2500)),
}
# Letter sounds judged clean enough to ship (by duration, voicing and formants of the cut,
# reviewed on the --preview spectrograms): no added vowel on t/p/k, a short voice bar on d/g.
# i and e drift between vowels in Kokoro, so they stay on Web Speech. A recording in
# public/audio/<id>.mp3 (RECORDED in audio.ts) overrides any of these.
SOUND_OK = set("satpnmdgock")
# Letters that share a sound file.
SAME_SOUND = {"c": "k"}


def letters():
    src = (ROOT / "src/content/letters.ts").read_text()
    rows = re.findall(r"\{ id: '(\w)', upper: '(\w)'.*?keyword: \{ word: '([^']+)'", src)
    return [{"id": i, "upper": u, "word": w} for i, u, w in rows]


def slug(text):
    return re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")


# ---------- signal helpers ----------

def resample(x, sr, to):
    n = int(len(x) * to / sr)
    return np.fft.irfft(np.fft.rfft(x)[: n // 2 + 1], n) * n / len(x)


def formants(w, sr=10000, p=12):
    w = np.append(w[0], w[1:] - 0.9 * w[:-1]) * np.hamming(len(w))
    r = np.correlate(w, w, "full")[len(w) - 1 : len(w) + p + 1]
    R = np.array([[r[abs(i - j)] for j in range(p)] for i in range(p)])
    a = np.linalg.solve(R + 1e-9 * np.eye(p) * r[0], r[1 : p + 1])
    roots = [z for z in np.roots(np.r_[1, -a]) if np.imag(z) > 0.01]
    fs = sorted((np.angle(z) * sr / (2 * np.pi), -sr / np.pi * np.log(abs(z))) for z in roots)
    return [f for f, b in fs if f > 180 and b < 500][:2]


def frames(x, sr):
    """10 ms frames: dicts with rms, voiced, hf (share of energy above 3 kHz), F1/F2."""
    y = resample(x, sr, 10000)
    f, h = int(sr * 0.025), int(sr * 0.01)
    out = []
    for n, i in enumerate(range(0, len(x) - f, h)):
        w = x[i : i + f]
        rms = float(np.sqrt(np.mean(w**2)))
        ac = np.correlate(w, w, "full")[f - 1 :]
        voiced = bool(ac[0] > 0 and ac[int(sr / 400) : int(sr / 70)].max() / ac[0] > 0.5)
        sp = np.abs(np.fft.rfft(w)) ** 2
        hf = float(sp[np.fft.rfftfreq(f, 1 / sr) > 3000].sum() / (sp.sum() + 1e-12))
        wy = y[n * 100 : n * 100 + 250]
        fm = formants(wy) if voiced and rms > 0.01 and len(wy) == 250 else []
        out.append(dict(rms=rms, voiced=voiced, hf=hf, f1=fm[0] if fm else 0, f2=fm[1] if len(fm) > 1 else 0))
    return out


def runs(mask, gap=2):
    """Index runs where mask holds, bridging up to `gap` stray frames."""
    res, start, miss = [], None, 0
    for i, m in enumerate(list(mask) + [False] * (gap + 1)):
        if m:
            start = i if start is None else start
            miss = 0
        elif start is not None:
            miss += 1
            if miss > gap:
                res.append((start, i - miss + 1))
                start, miss = None, 0
    return res


def fade(x, sr, a=0.01, b=0.02):
    x = x.copy()
    na, nb = min(int(sr * a), len(x) // 2), min(int(sr * b), len(x) // 2)
    x[:na] *= np.linspace(0, 1, na)
    x[len(x) - nb :] *= np.linspace(1, 0, nb)
    return x


def cut_sound(x, sr, kind, win=None):
    """Return the clean segment for one letter sound, or None if there isn't one."""
    F = frames(x, sr)
    ms = lambda a, b: x[a * int(sr * 0.01) : b * int(sr * 0.01)]
    voiced_runs = [r for r in runs([f["voiced"] and f["rms"] > 0.03 for f in F], 1) if r[1] - r[0] >= 5]
    if kind == "fric":
        rs = [r for r in runs([not f["voiced"] and f["hf"] > 0.7 and f["rms"] > 0.015 for f in F], 1) if r[1] - r[0] >= 8]
        if not rs:
            return None
        a, b = max(rs, key=lambda r: r[1] - r[0])
        seg = ms(a, b)
        # A hiss loops seamlessly: stretch it to ~0.35 s with overlapping copies.
        target, xf = int(sr * 0.35), int(sr * 0.03)
        out = seg.copy()
        while len(out) < target:
            ramp = np.linspace(0, 1, xf)
            out = np.concatenate([out[:-xf], out[-xf:] * (1 - ramp) + seg[:xf] * ramp, seg[xf:]])
        return fade(out[:target], sr, 0.03, 0.06)
    if kind in ("stop", "vstop"):
        if not voiced_runs:
            return None
        v = voiced_runs[0][0]
        # Walk back from the vowel over the burst/aspiration (unvoiced, audible).
        b = v
        while b > 0 and not F[b - 1]["voiced"] and F[b - 1]["rms"] > 0.012:
            b -= 1
        if kind == "stop":
            if not 2 <= v - b <= 15:
                return None
            return fade(ms(b, v + 1), sr, 0.003, 0.015)
        if v - b > 6:
            return None
        return fade(ms(max(b - 1, 0), v + 4), sr, 0.005, 0.025)
    if kind == "vowel":
        lo1, hi1, lo2, hi2 = win
        rs = [r for r in runs([f["voiced"] and lo1 <= f["f1"] <= hi1 and lo2 <= f["f2"] <= hi2 for f in F], 2) if r[1] - r[0] >= 12]
        if not rs:
            return None
        a, b = max(rs, key=lambda r: r[1] - r[0])
        return fade(ms(a, min(b, a + 32)), sr, 0.02, 0.05)
    if kind == "nasal":
        rs = [r for r in runs([f["voiced"] and 0 < f["f1"] < 430 and 0 < f["f2"] < 1300 for f in F], 2) if r[1] - r[0] >= 12]
        if not rs:
            return None
        a, b = max(rs, key=lambda r: r[1] - r[0])
        return fade(ms(a, min(b, a + 35)), sr, 0.02, 0.06)
    raise ValueError(kind)


# ---------- output ----------

def trim(x, sr, floor_db=-40, pad=0.03):
    env = np.abs(x)
    idx = np.where(env > env.max() * 10 ** (floor_db / 20))[0]
    if not len(idx):
        return x
    p = int(sr * pad)
    return x[max(idx[0] - p, 0) : idx[-1] + p]


def normalize(x, target_db=-18.0, peak_db=-1.0):
    loud = x[np.abs(x) > np.abs(x).max() * 0.05]
    rms = np.sqrt(np.mean(loud**2)) if len(loud) else 1e-9
    g = min(10 ** (target_db / 20) / rms, 10 ** (peak_db / 20) / (np.abs(x).max() + 1e-9))
    return x * g


def write_mp3(x, sr, path):
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        sf.write(t.name, x.astype(np.float32), sr)
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", t.name, "-ac", "1", "-ar", str(SR_OUT),
                        "-codec:a", "libmp3lame", "-b:a", "48k", str(path)], check=True)


def write_manifest():
    pub = ROOT / "public"
    files = sorted(str(f.relative_to(pub)) for f in (pub / "audio").rglob("*.mp3"))
    (pub / "audio/manifest.json").write_text(json.dumps(files, indent=1) + "\n")
    size = sum((pub / f).stat().st_size for f in files)
    print(f"manifest: {len(files)} files, {size / 1024:.0f} KB")


def import_clip(src, dest):
    """A recorded clip: trimmed, loudness-matched to the Kokoro clips, small mono mp3."""
    with tempfile.NamedTemporaryFile(suffix=".wav") as t:
        subprocess.run([FF, "-y", "-loglevel", "error", "-i", src, "-ac", "1", t.name], check=True)
        x, sr = sf.read(t.name)
    Path(dest).parent.mkdir(parents=True, exist_ok=True)
    write_mp3(normalize(fade(trim(x, sr), sr, 0.005, 0.03)), sr, dest)
    print(f"{dest}: {len(trim(x, sr)) / sr:.2f} s")
    write_manifest()


def main():
    if "--clip" in sys.argv:
        i = sys.argv.index("--clip")
        return import_clip(sys.argv[i + 1], sys.argv[i + 2])
    from kokoro_onnx import Kokoro

    preview = "--preview" in sys.argv
    k = Kokoro(str(MODELS / "kokoro-v1.0.onnx"), str(MODELS / "voices-v1.0.bin"))
    OUT.mkdir(parents=True, exist_ok=True)
    for old in OUT.glob("*.mp3"):
        old.unlink()
    clips = {}

    def say(text, file, phonemes=None):
        if phonemes:
            x, sr = k.create(phonemes, voice=VOICE, speed=SPEED, is_phonemes=True)
        else:
            x, sr = k.create(text, voice=VOICE, speed=SPEED, lang="en-us")
        write_mp3(normalize(fade(trim(x, sr), sr, 0.005, 0.02)), sr, OUT / file)
        clips[text] = f"audio/en/{file}"

    L = letters()
    for l in L:
        name = NAME_IPA.get(l["upper"]) or k.tokenizer.phonemize(l["upper"], "en-us")
        say(f"{l['upper']} says", f"says-{l['id']}.mp3", f"{name} sˈɛz")
        say(f"like {l['word']}", f"like-{slug(l['word'])}.mp3")
        say(l["word"], f"word-{slug(l['word'])}.mp3")
    for text in EXTRA:
        say(text, f"{slug(text)}.mp3")

    prev = Path("/tmp/lia-sounds")
    if preview:
        prev.mkdir(exist_ok=True)
    for l in L:
        sid = SAME_SOUND.get(l["id"], l["id"])
        if sid not in SOUNDS:
            continue
        kind, cands, *win = SOUNDS[sid]
        seg = None
        for ph, sp in cands:
            x, sr = k.create(ph, voice=VOICE, speed=sp, is_phonemes=True)
            seg = cut_sound(x, sr, kind, win[0] if win else None)
            if seg is not None:
                break
        status = "no clean cut" if seg is None else f"{len(seg) / sr * 1000:.0f} ms from {ph!r}"
        ok = seg is not None and sid in SOUND_OK
        print(f"sound {l['id']}: {status}{'' if ok else '  (not shipped: Web Speech)'}")
        if seg is None:
            continue
        # Some decoders swallow the first few ms of an mp3: pad the short cuts with silence.
        pad = np.zeros(int(sr * 0.04))
        seg = np.concatenate([pad, normalize(seg), pad])
        if preview:
            w = prev / f"{l['id']}.wav"
            sf.write(w, seg, sr)
            subprocess.run([FF, "-y", "-loglevel", "error", "-i", str(w), "-lavfi",
                            "showspectrumpic=s=400x200:legend=0:scale=log", str(prev / f"{l['id']}.png")], check=True)
        if ok:
            f = f"sound-{sid}.mp3"
            if not (OUT / f).exists():
                write_mp3(seg, sr, OUT / f)
            clips[f"sound:{l['id']}"] = f"audio/en/{f}"

    CLIPS_JSON.write_text(json.dumps(clips, indent=1, ensure_ascii=False) + "\n")
    print(f"{len(clips)} clips")
    write_manifest()


if __name__ == "__main__":
    main()
