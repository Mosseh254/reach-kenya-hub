/** Maps server-side error codes to friendly copy. Safe to import anywhere. */
const MESSAGES: Record<string, string> = {
  ACTIVATION_NOT_FOUND: "We couldn't find that campaign activation.",
  ACTIVATION_EXPIRED: "This campaign window has expired. Buy a new package to keep sharing.",
  DAILY_LIMIT_REACHED: "You've already submitted today's post for this campaign. Come back tomorrow.",
  REWARD_CAP_REACHED: "This package has reached its maximum number of rewarded posts.",
  BELOW_MINIMUM: "That amount is below the minimum withdrawal.",
  PENDING_WITHDRAWAL_EXISTS: "You already have a withdrawal being processed.",
  INSUFFICIENT_BALANCE: "Your available balance is too low for that amount.",
  ALREADY_REVIEWED: "This submission has already been reviewed.",
  ALREADY_PROCESSED: "This withdrawal has already been processed.",
  FORBIDDEN: "You don't have permission to do that.",
  NOT_FOUND: "Record not found.",
  INVALID_PHONE: "Enter a valid Safaricom number, e.g. 0712 345 678.",
  INVALID_FILE: "Upload a JPG, PNG or WEBP screenshot under the size limit.",
  MOCK_ONLY: "Payment simulation is only available in sandbox mode.",
  ORDER_NOT_PENDING: "This order is no longer awaiting payment.",
  PROFILE_INCOMPLETE: "Add your M-Pesa phone number in Settings first.",
  ACTIVE_ACTIVATION_EXISTS: "You already have an active campaign for this advertiser. Finish it before buying another.",
};

export function friendlyError(err: unknown, fallback = "Something went wrong. Please try again.") {
  const raw = err instanceof Error ? err.message : String(err ?? "");
  for (const code of Object.keys(MESSAGES)) {
    if (raw.includes(code)) return MESSAGES[code]!;
  }
  return raw && raw.length < 140 ? raw : fallback;
}
