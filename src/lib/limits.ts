export const LIMITS = {
  guestsPerWorkspace: 32,
  guestsTotal: 256,
  workspaces: 64,
  history: 100,
  nameLength: 24,
  messageLength: 500,
  payloadBytes: 20_000,
  eventsPerSecond: 40,
  chatCooldownMs: 350,
} as const;
