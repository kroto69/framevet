export function humanReport(r, stderr) {
  const lines = [];
  lines.push(r.ok ? 'FRAMEVET PASSED' : 'FRAMEVET FAILED');
  lines.push(`composition: ${r.composition}`);
  lines.push(`stage: ${r.stage}`);
  lines.push(`reason: ${r.reason}`);
  for (const o of (r.observations || []).slice(0, 4)) {
    lines.push(`  frame ${o.frame}: ${o.status} - ${o.text}`);
  }
  lines.push(`evidence: ${r.evidenceDir}`);
  lines.push(`hint: ${r.hint}`);
  stderr.write(lines.slice(0, 10).join('\n') + '\n');
}

export function jsonReport(r, stdout) {
  stdout.write(
    JSON.stringify({
      composition: r.composition,
      ok: r.ok,
      stage: r.stage,
      code: r.code,
      reason: r.reason,
      observations: r.observations || [],
      evidence: r.evidence || [],
      rendered: Boolean(r.rendered),
      durationMs: r.durationMs,
    }) + '\n',
  );
}
