# NOTES.md — framevet build notes

(Renamed from "kane-gate" to "framevet" on 2026-11-24 at the user's request; all commands, the config file `framevet.config.json`, the evidence dir `.framevet/`, and the env var `FRAMEVET_KANE_BIN` use the new name. "Kane" / "kane-cli" still refer to the external Kane CLI tester.)

Facts are recorded as VERIFIED (with source) or UNVERIFIED. Build date: 2026-11-24.

## VERIFIED (run in this sandbox on 2026-11-24)

- Node v22.23.5, npm 10.9.9 are installed. Source: `node --version`, `npm --version`.
- npm registry is reachable. Source: `npm ping` (rc=0); installed `remotion@4` -> remotion 4.0.546 / @remotion/cli 4.0.546 into a probe project in /tmp/kg-probe.
- In a Remotion project, `npx remotion` resolves `node_modules/.bin/remotion` provided by `@remotion/cli` (a dependency of `remotion`). Source: `ls node_modules/.bin` after install; the bare `remotion` npm package itself has no bin (`npx remotion` outside a project fails with "could not determine executable").
- `npx remotion --help` (@remotion/cli 4.0.546) lists `still`, `render`, `compositions`, `browser <command>`, etc. Source: real help output.
- `npx remotion browser --help`: `remotion browser ensure` = "Ensure Remotion has a browser it can use for rendering." Source: real help output. This is the preflight command used by framevet.
- `npx remotion still --help`: signature `remotion still <serve-url|entry-point>? [<composition-id>] [<output-location>]` with option `--frame <value>`. Source: real help output.
- `--frame=<N>` (equals form) is accepted by the CLI parser. Source: `npx remotion still --frame=150` fails with "No entry point specified" (an argument-count error), NOT an unknown-option error, so `--frame=150` parsed fine.
- `npx remotion render --help`: signature `remotion render [<entry-point|serve-url>] [<composition-id>] [<output-location>]`. Source: real help output.
- `/tmp/render-gate-old` does NOT exist in this sandbox. Source: `ls /tmp/render-gate-old` -> "no such file". Therefore no old src/kane.js and no real captured Kane run folders were available; the fake Kane stub output is synthetic and marked as such.
- `kane-cli` is NOT installed in this sandbox. Source: `which kane-cli` -> not found.
- `/usr/bin/google-chrome` does NOT exist in this sandbox. Source: `ls /usr/bin/google-chrome` -> no such file. (The Brave symlink fact below applies to the human's machine, not this sandbox.)
- `gh` is not authenticated in this session and the `github_app` connector was denied by the user. Source: `gh auth status` ("not logged in"), `ask_enable_connector` -> denied. Therefore: no GitHub remote, no push; all commits are local only.
- 2026-11-24 update (user asked to connect GitHub): the sandbox CAN reach github.com over https (VERIFIED: `git ls-remote https://github.com/octocat/Hello-World.git HEAD` succeeded), but authentication is still impossible in this session: `ask_enable_connector` for github_app now returns "previously declined by the user and cannot be re-requested in this session", and `list_unauthenticated_connectors` no longer offers any github connector. `gh` remains unauthenticated. Conclusion: the push must be done by the human from their own machine (`gh repo create framevet --private --source=. --push`); this session cannot push and will not accept tokens in chat.
- 2026-11-25 update (user connected github_app externally; asked to push): `list_my_connectors` shows github_app `authenticated: true`, but its tools (create_repository, push_files, create_or_update_file, …) are NOT part of this session's callable tool catalog (`call_tool`/`get_tool` reject them; `mistral_mcp_test_connector_http_call` refuses: "This is an MCP connector, not an HTTP one"), and `ask_enable_connector` for it is still blocked ("previously declined … cannot be re-requested in this session"). `gh` in the sandbox is still unauthenticated. VERIFIED conclusion: this session cannot create/push the GitHub repo; all 8 commits live locally in /workspace on branch main, and the push must be run by the human on their own machine: `gh repo create framevet --private --source=. --push`.
- 2026-11-25 delivery: since no in-session GitHub push is possible and the sandbox has no download path, the full repo was delivered as a git bundle through the user's Mistral document library: library `framevet` (id 01a21375-2f7d-7641-b521-7457d80bc505) contains `framevet.bundle.b64.txt` (base64 of `git bundle create --all`, 75,278 bytes, 8 commits, HEAD e93398d; upload verified 201 Created, base64 roundtrip verified with `git bundle verify`) plus `HOW-TO-RESTORE.md`. Restore: `base64 -d framevet.bundle.b64.txt > framevet.bundle && git clone framevet.bundle`.
- No runtime dependencies were added to framevet itself (Node built-ins only). Source: package.json has no "dependencies". The only deps in the repo are the demo's own Remotion project (react, react-dom, remotion, @remotion/cli) inside examples/demo, which the task explicitly allows.
- Demo dependency versions resolve: `npm install` in examples/demo added 243 packages (remotion/@remotion/cli 4.0.546, react/react-dom 18) and `node_modules/.bin/remotion` exists, so `npx remotion` works there. Source: real install output on 2026-11-24. Demo source files pass `node --check` (copied to .mjs). `npm run demo:break` / `demo:fix` toggle DEMO_BROKEN idempotently (verified by running them twice each). No Remotion render/still/studio and no real Kane run was executed while building, per the task rules.

## VERIFIED (from the human's real runs; stated in the task, treated as true)

- Kane CAN open http://localhost:<port> pages.
- On Linux Kane needs a browser at /usr/bin/google-chrome (on the human's machine it is a symlink to Brave).
- Remotion Studio never exits and has no frame URL parameter; seeking frames through the Studio UI costs one LLM call per click and timed out. framevet therefore never uses Studio.
- `remotion still` downloads a headless browser on first use (~25 s). Two Remotion commands running at the same time broke that browser cache. framevet therefore runs all Remotion commands strictly one at a time.
- A Kane run took ~120 s with 13 UI steps and ~44 credits. A pass without per-item observations proved nothing; a bare "passed" is NOT evidence. framevet therefore requires one OBSERVATION line per configured frame.
- Unresolved "{{...}}" placeholders reached Kane once and caused false failures. framevet therefore rejects any objective containing "{{" before spending credits.

## UNVERIFIED (must be confirmed on the human's machine from `kane-cli --help` / `kane-cli run --help`)

- kane-cli's exact flags. Assumed (as named constants ONLY in src/kane.js): `kane-cli run --objective <text>`; the page URL is embedded in the objective text, no separate URL flag is passed.
- kane-cli's NDJSON output schema (field names like type/text/status). The parser in src/verdict.js is defensive: it scans every line (raw and JSON-stringified) for `OBSERVATION <N>: PASS|FAIL - ...` and ignores non-JSON/truncated lines.
- kane-cli's exit-code meanings. Assumed: exit 0 = run completed successfully; any other exit code without observations is treated as setup/auth (exit 12) with the raw code in the message; our own timeout is exit 13. Mapping is implemented in src/verdict.js and will need adjusting if real exit codes differ.
- Whether Kane needs `--url` in addition to the objective. If `kane-cli run --help` shows a required URL flag, add it as a constant in src/kane.js next to OBJECTIVE_FLAG.
- Exact behavior of `npx remotion browser ensure` on failure (exit codes, output). Not run here on purpose (it would download the ~25 s headless browser; the task forbids real runs while building).

## Dependency log (rule: one-line reason per new dependency)

- None for framevet itself: zero runtime dependencies, Node built-ins only.
- examples/demo only: react, react-dom, remotion, @remotion/cli — required because the demo is a real Remotion project (explicitly allowed by the task).
