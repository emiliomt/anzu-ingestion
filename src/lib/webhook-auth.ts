/**
 * Webhook signature verification helpers.
 *
 * SendGrid Inbound Parse — shared-secret in URL query param
 *   Configure your SendGrid webhook URL as:
 *     https://yourdomain.com/api/webhooks/email?secret=<SENDGRID_WEBHOOK_SECRET>
 *   The handler checks that the `secret` param matches the env var.
 *
 * Twilio (WhatsApp) — HMAC-SHA1 over URL + sorted POST params
 *   Twilio adds an X-Twilio-Signature header to every inbound webhook.
 *   We re-compute the expected signature and compare using a constant-time
 *   comparison to prevent timing attacks.
 *   Ref: https://www.twilio.com/docs/usage/security#validating-signatures-from-twilio
 */

import crypto from "crypto";

// ── Constant-time buffer comparison ──────────────────────────────────────────
function safeEqual(a: string, b: string): boolean {
  try {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
      // Still do a comparison to avoid early exit on length mismatch leaking info
      crypto.timingSafeEqual(Buffer.alloc(1), Buffer.alloc(1));
      return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

// ── SendGrid Inbound Parse — URL secret token ─────────────────────────────────

/**
 * Verify a SendGrid Inbound Parse webhook by checking that the `secret`
 * query parameter in the request URL matches SENDGRID_WEBHOOK_SECRET.
 *
 * If the env var is not set this function returns true (verification skipped)
 * and logs a warning, so the app still works in dev without the env var.
 *
 * @param requestUrl       Full request URL (including query string)
 * @param configuredSecret Value of SENDGRID_WEBHOOK_SECRET env var
 */
export function verifyEmailWebhook(
  requestUrl: string,
  configuredSecret: string | undefined
): boolean {
  if (!configuredSecret) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhook/email] SENDGRID_WEBHOOK_SECRET is not set in production — rejecting request."
      );
      return false;
    }
    console.warn(
      "[webhook/email] SENDGRID_WEBHOOK_SECRET is not set — signature verification skipped (dev only). " +
      "Set the env var and add ?secret=<value> to your SendGrid webhook URL."
    );
    return true;
  }

  try {
    const url = new URL(requestUrl);
    const token = url.searchParams.get("secret") ?? "";
    return safeEqual(token, configuredSecret);
  } catch {
    return false;
  }
}

// ── Twilio — HMAC-SHA1 ────────────────────────────────────────────────────────

/**
 * Verify a Twilio webhook request using the X-Twilio-Signature header.
 *
 * Algorithm (from Twilio docs):
 *   1. Start with the full URL of the webhook endpoint.
 *   2. Sort all POST parameters alphabetically (by key).
 *   3. Iterate through the sorted params and append key+value to the URL.
 *   4. HMAC-SHA1 the resulting string with the Auth Token as the secret.
 *   5. Base64-encode the digest and compare with the header value.
 *
 * If TWILIO_AUTH_TOKEN is not set this function returns true (dev permissive)
 * and logs a warning.
 *
 * @param authToken  Value of TWILIO_AUTH_TOKEN env var
 * @param signature  Value of X-Twilio-Signature request header
 * @param webhookUrl Canonical public URL of this webhook (e.g. from NEXT_PUBLIC_APP_URL)
 * @param params     All POST form fields as a flat string→string map (exclude File entries)
 */
export function verifyTwilioWebhook(
  authToken: string | undefined,
  signature: string,
  webhookUrl: string,
  params: Record<string, string>
): boolean {
  if (!authToken) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[webhook/whatsapp] TWILIO_AUTH_TOKEN is not set in production — rejecting request."
      );
      return false;
    }
    console.warn(
      "[webhook/whatsapp] TWILIO_AUTH_TOKEN is not set — signature verification skipped (dev only). " +
      "Set the env var to enable Twilio request validation."
    );
    return true;
  }

  if (!signature) {
    return false;
  }

  // Build the string-to-sign: URL + sorted param key-value pairs concatenated
  const sortedKeys = Object.keys(params).sort();
  const stringToSign = webhookUrl + sortedKeys.map((k) => k + params[k]).join("");

  const hmac = crypto.createHmac("sha1", authToken);
  hmac.update(stringToSign, "utf8");
  const expected = hmac.digest("base64");

  return safeEqual(signature, expected);
}
