# AGENTS.md — rules for any agent using framevet

- After every edit to a Remotion composition, run `framevet check <Composition> --json` (in `examples/demo`: `npm run check`) BEFORE any render. Read `reason` and `observations` from the JSON output.
- Never run `npx remotion render`, `remotion still`, or `remotion studio` directly. A render starts only via `framevet render <Composition>`, and only after the gate passes.
- On gate failure: fix the composition code, then rerun the check. After 3 failed attempts in a row, stop and report the `reason` + `observations` to the human.
- Never edit `framevet.config.json` expectations to make a failure pass.
- Never install kane-cli or run `kane-cli login` yourself — the human does that. On exit code 12 (Kane setup/auth), stop and tell the human.
- On failure, point the human to the evidence folder named in the report (`.framevet/<runId>/`: frame PNGs, `index.html`, `kane.ndjson`).
- Run framevet strictly one process at a time; never start two gates (or Remotion commands) concurrently.
