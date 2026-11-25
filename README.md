# framevet

**Vet the key frames before you pay for a full render.**

Agents (Claude, etc.) write Remotion compositions but cannot see the result — visual bugs
are found only after a slow full render. `framevet` renders a few key frames cheaply
(`remotion still`), has the [Kane CLI](https://kane.dev) (an AI browser tester) judge them
against your expectations, and runs the real render **only if the gate passes**. On failure
no render starts, and you get a specific reason plus per-frame evidence.

Plain JavaScript (ESM), Node >= 18, **zero runtime dependencies** (Node built-ins only).

## How it works

```
 you: "Claude, make promo video X"
        │
        ▼
 Claude edits the Remotion code (as usual)
        │
        ▼  framevet check X --json
 ┌──────────────────────────────────────────────────────────────┐
 │ 1. validate framevet.config.json                             │
 │ 2. npx remotion browser ensure      (preflight, no timer)    │
 │ 3. npx remotion still … --frame=N   (one frame at a time)    │
 │ 4. build index.html gallery of the frames                     │
 │ 5. serve it on a random localhost port                        │
 │ 6. kane-cli run --objective "…OBSERVATION <N>: PASS|FAIL…"  │
 │ 7. parse Kane's NDJSON → verdict                             │
 └──────────────────────────────────────────────────────────────┘
        │                              │
   FAIL (11/12/13/16)              PASS (0)
        │                              │
   no render; reason +               │  framevet render X
   .framevet/<runId>/ evidence        ▼
                              render runs ONCE → out/X.mp4
```

A pass requires one `OBSERVATION <N>: PASS|FAIL - …` line per configured frame in Kane's
output plus Kane's own success exit code — a bare "passed" is treated as **no evidence**.

## Requirements

- Node.js >= 18.
- A Remotion v4 project with an entry file (`src/index.ts` / `src/index.js`).
- Kane CLI installed and **logged in by the human** (`kane-cli login`). Agents must never do this.
- Linux note: Kane needs a browser at `/usr/bin/google-chrome` — a symlink to Brave works.
- First run downloads the Remotion headless browser (~25 s) during the `browser` stage,
  before any timer. Never run two Remotion/framevet commands concurrently.

## Install

```sh
git clone https://github.com/<you>/framevet.git ~/framevet
npm install -g ~/framevet        # installs the `framevet` command; zero deps, instant
framevet --help                  # sanity check
```

One-time machine setup (human):

```sh
kane-cli login                                  # Kane auth, once
sudo ln -s $(which brave) /usr/bin/google-chrome   # Linux browser path for Kane
```

## Quickstart

**A. Try the bundled demo first** (inside the cloned repo):

```sh
cd ~/framevet/examples/demo
npm install
npm run demo:break && npm run check     # expect FAIL: exit 11, reason mentions frame 150, NO render
npm run demo:fix   && npm run check     # expect PASS: exit 0, observations for 150 & 420 = PASS
npm run render:vet                      # gate passes -> render runs once -> out/PromoVideo.mp4
```

**B. Your own Remotion project** — inserting framevet takes 2 files:

```sh
npx create-video@latest my-video && cd my-video
cp ~/framevet/AGENTS.md .                              # rules for the agent
cp ~/framevet/examples/demo/framevet.config.json .     # gate config — edit it (see below)
claude                                                 # then just ask Claude as usual
```

## Commands

```
framevet check  <Composition> [--json]   gate only — never renders
framevet render <Composition> [--json]   gate, then render ONCE if it passes
```

Run them from the **root of your Remotion project** (where `framevet.config.json` lives).
The configured render command gets `"<entry>" "<Composition>"` appended, so the default
`npx remotion render` becomes `npx remotion render "src/index.ts" "PromoVideo"`.

- Kane binary defaults to `kane-cli`; override with `FRAMEVET_KANE_BIN=/path/to/binary`.
- Human report goes to stderr (first line `FRAMEVET PASSED` / `FRAMEVET FAILED`, ≤ 10 lines).
- With `--json`, exactly one JSON object is printed to **stdout and nothing else**:

```json
{"composition":"PromoVideo","ok":true,"stage":"done","code":0,"reason":"gate passed",
 "observations":[{"frame":150,"status":"PASS","text":"all chips visible"},…],
 "evidence":[".framevet/<runId>/frames/frame-150.png",…],"rendered":false,"durationMs":83412}
```

`stage` is one of `config | browser | stills | kane | render | done`.
Evidence for every run is kept in `.framevet/<runId>/` (frame PNGs, `index.html`,
`kane.ndjson` with Kane's raw output).

## Config reference — `framevet.config.json`

```json
{
  "entry": "src/index.ts",
  "render": { "command": "npx remotion render" },
  "kane": { "timeoutSec": 360 },
  "compositions": {
    "PromoVideo": {
      "frames": [150, 420],
      "expect": {
        "150": "all 7 model chips are fully visible, none cut off at the edges",
        "420": "the logo and the call-to-action text are fully visible"
      }
    }
  }
}
```

| key | required | meaning |
|-----|----------|---------|
| `entry` | yes | path to your Remotion entry file (the one calling `registerRoot`) |
| `render.command` | no (default `npx remotion render`) | render command prefix; entry + composition are appended |
| `kane.timeoutSec` | no (default 360) | hard timeout for the Kane run |
| `compositions.<ID>` | yes | key = composition `id` from your code; what `framevet check <ID>` looks up |
| `…frames` | yes | 1–4 frame numbers to capture as stills |
| `…expect.<frame>` | yes, one per frame | plain sentence of what must be **visible in that still**; sent to Kane and shown next to the frame image |

Validation: `frames` non-empty (max 4), every frame has a non-empty expectation, unknown
keys only warn, missing/invalid keys exit 1 with a fix hint. Expectations must describe
something visible in a single still — not motion or audio. The Kane objective is rejected
(exit 1, no credits spent) if it is empty, over 2000 chars, or contains `{{`.

## Exit codes

| code | meaning |
|------|---------|
| 0 | ok (gate passed; render finished if `render` was used) |
| 1 | config / usage error / invalid Kane objective (no credits spent) |
| 11 | Kane verdict failed, or no evidence for a frame |
| 12 | Kane setup/auth/missing binary (raw Kane exit code is in the message) |
| 13 | Kane timeout (`kane.timeoutSec`) |
| 14 | browser / gallery-server start problem |
| 15 | render failed (gate had passed) |
| 16 | still failed (also catches runtime errors in the composition) |

## Troubleshooting

| symptom | code | fix |
|---------|------|-----|
| `framevet.config.json not found` / missing keys | 1 | create/fix the config — the message tells you exactly what to add |
| `composition "X" is not defined` | 1 | add it under `compositions`, or use an id that exists in your code |
| headless browser download/launch fails | 14 | first run downloads ~25 s; check your Remotion install, then rerun |
| still fails with a JS error | 16 | fix the composition error printed in `reason` |
| `Kane … exit code 42` / not authenticated | 12 | human runs `kane-cli login`; or set `FRAMEVET_KANE_BIN` |
| `timed out after Ns` | 13 | raise `kane.timeoutSec` or simplify the page |
| gate fails with `frame N: FAIL - …` | 11 | open `.framevet/<runId>/frames/frame-N.png`, fix the composition, rerun |

## Using it with an agent

Copy `AGENTS.md` into your Remotion project root. It tells the agent: run
`framevet check <Composition> --json` after every edit and before any render; never run
`remotion render`/`still`/`studio` directly; on failure fix the code and rerun (max 3
failed attempts, then report to the human); never edit `expect` texts to force a pass;
never install/log in to Kane itself.

## Limitations

- Judges only the listed frames (max 4) and only what is visible in the stills — not
  aesthetics, audio, or motion between frames.
- A Kane run takes about a minute or two and uses Kane credits (~44 credits for a ~2-minute
  run in testing).
- Remotion Studio is never used (it never exits and has no frame URL parameter).

## Development

```sh
npm test    # 50 tests, node:test only — fake Kane (`test/stubs/fake-kane.js`),
            # stub `npx`, and a render spy; no real Kane and no real render are run
```

Layout: `bin/framevet.js` (CLI entry) · `src/` (`cli` flow, `config`, `stills`, `gallery`
+ localhost server, `kane` — all Kane specifics as named constants, `verdict`, `report`,
`cleanup` — process-group registry, `errors` — exit codes) · `test/` · `examples/demo`.
See [NOTES.md](NOTES.md) for verified/unverified facts.
