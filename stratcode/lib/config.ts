export const GEMINI_MODEL =
  process.env.GEMINI_MODEL || "gemini-2.5-flash-lite";

export const GEMINI_MODELS = [
  GEMINI_MODEL,
  "gemini-2.5-flash-lite",
  "gemini-3-flash-preview",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-2.5-flash",
].filter((m, idx, arr) => arr.indexOf(m) === idx);
