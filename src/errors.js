export const EXIT = Object.freeze({
  OK: 0,
  CONFIG: 1,
  VERDICT: 11,
  SETUP: 12,
  TIMEOUT: 13,
  SERVER: 14,
  RENDER: 15,
  STILL: 16,
});

export class GateError extends Error {
  constructor(code, stage, reason, extra = {}) {
    super(reason);
    this.name = 'GateError';
    this.reason = reason;
    this.code = code;
    this.stage = stage;
    this.extra = extra;
  }
}
