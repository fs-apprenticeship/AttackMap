export interface RateLimitConfig {
  key: string;
  limit: number;
  windowMs: number;
}

const HOUR_MS = 60 * 60 * 1000;

// The scan chat is a multi-turn conversation, so it gets more headroom per
// hour than the one-shot summarize/remediate actions. All three ultimately
// spend OpenAI budget (chat also spends NVD/EPSS/KEV budget per turn, bounded
// separately by chat.ts's own MAX_STEPS), so these exist to keep a single
// user from running either bill up unbounded.
export const CHAT_RATE_LIMIT: RateLimitConfig = {
  key: "scan_chat",
  limit: 60,
  windowMs: HOUR_MS,
};

export const SUMMARIZE_RATE_LIMIT: RateLimitConfig = {
  key: "scan_summarize",
  limit: 20,
  windowMs: HOUR_MS,
};

export const REMEDIATE_RATE_LIMIT: RateLimitConfig = {
  key: "scan_remediate",
  limit: 20,
  windowMs: HOUR_MS,
};
