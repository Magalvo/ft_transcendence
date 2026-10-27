import speakeasy from "speakeasy";
import db from "../db.js";

const STEP_SECONDS = 30;

// Verifies a TOTP code and marks its time step as used for this user. A code
// is accepted only if its step is newer than the last one consumed, so the
// same code (or an older one) can never be replayed. The conditional UPDATE
// makes this safe against two requests racing with the same code.
export async function consumeTotp(userId: string, secret: string, code: unknown): Promise<boolean> {
  const match = speakeasy.totp.verifyDelta({
    secret,
    encoding: "base32",
    token: String(code ?? "").trim(),
    window: 1,
  });
  if (!match) return false;

  const step = Math.floor(Date.now() / 1000 / STEP_SECONDS) + match.delta;
  const updated = await db("users")
    .where({ id: userId })
    .andWhere((query) => query.whereNull("totp_last_step").orWhere("totp_last_step", "<", step))
    .update({ totp_last_step: step });

  return updated === 1;
}

export async function resetTotpState(userId: string): Promise<void> {
  await db("users").where({ id: userId }).update({ totp_last_step: null });
}
