/**
 * Offline self-test for Bring Your Own Subscription (BYOS) OAuth engine
 * & provider routing (`npm run check:oauth`).
 */
import assert from "node:assert/strict";
import {
  encryptOAuthSecret,
  decryptOAuthSecret,
  maskTokenPreview,
  decodeJwtClaims,
  extractJwtExpiryIso,
  extractAccountLabel,
  isTokenExpiring,
  sanitizeOAuthSubscriptionsMap,
  validateXaiEndpointUrl,
  validateNousInferenceUrl,
  buildCodexAccountHeaders,
  OAUTH_SUBSCRIPTION_CATALOG,
  type StoredOAuthSubscriptionsMap,
} from "../server/oauth-subscriptions";
import {
  providerConfigFromProfile,
  validateByokCredentials,
  validateUserChatCredentials,
  getByokProvider,
} from "../server/ai-providers";

function makeFakeJwt(payload: Record<string, unknown>): string {
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = "sig_abcdef123456";
  return `${header}.${body}.${sig}`;
}

async function main() {
  // 1. AES-256-GCM encryption/decryption roundtrip
  const rawToken = "eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.test_secret_token_998877";
  const encrypted = encryptOAuthSecret(rawToken);
  assert.notEqual(encrypted, rawToken, "Encrypted token must not equal plaintext");
  assert.ok(encrypted.includes(":"), "Encrypted token must use iv:authTag:ciphertext format");
  const decrypted = decryptOAuthSecret(encrypted);
  assert.equal(decrypted, rawToken, "Decrypted token must match original plaintext");

  // 2. JWT claim extraction & expiry logic
  const futureExp = Math.floor(Date.now() / 1000) + 7200; // 2h from now
  const soonExp = Math.floor(Date.now() / 1000) + 30; // 30s from now
  const fakeCodexJwt = makeFakeJwt({
    exp: futureExp,
    email: "learner@synapsejourney.org",
    "https://api.openai.com/auth": {
      chatgpt_account_id: "acct_synapse_123",
      chatgpt_data_residency: "us",
      chatgpt_plan_type: "plus",
    },
  });

  const claims = decodeJwtClaims(fakeCodexJwt);
  assert.equal(claims.email, "learner@synapsejourney.org");
  assert.equal(extractAccountLabel(fakeCodexJwt), "learner@synapsejourney.org");
  assert.equal(isTokenExpiring(fakeCodexJwt, null, 120), false);

  const expiringJwt = makeFakeJwt({ exp: soonExp });
  assert.equal(isTokenExpiring(expiringJwt, null, 120), true);
  assert.ok(extractJwtExpiryIso(fakeCodexJwt)?.endsWith("Z"));

  // 3. Codex account headers extraction
  const codexHeaders = buildCodexAccountHeaders(fakeCodexJwt);
  assert.equal(codexHeaders["ChatGPT-Account-ID"], "acct_synapse_123");
  assert.equal(codexHeaders["x-openai-internal-codex-residency"], "us");
  assert.equal(codexHeaders.originator, "codex_cli_rs");

  // 4. Origin allowlist validation
  assert.equal(
    validateXaiEndpointUrl("https://auth.x.ai/oauth2/token/", "token_endpoint"),
    "https://auth.x.ai/oauth2/token",
  );
  assert.throws(
    () => validateXaiEndpointUrl("https://evil.example.com/oauth2/token", "token_endpoint"),
    /not on the x\.ai origin/,
  );
  assert.throws(
    () => validateXaiEndpointUrl("http://auth.x.ai/oauth2/token", "token_endpoint"),
    /Refusing non-HTTPS/,
  );
  assert.equal(
    validateNousInferenceUrl("https://inference-api.nousresearch.com/v1/"),
    "https://inference-api.nousresearch.com/v1",
  );
  assert.equal(
    validateNousInferenceUrl("https://attacker.example.com/v1"),
    "https://inference-api.nousresearch.com/v1",
  );

  // 5. Sanitized status map & BYOC/BYOS provider routing
  const storedMap: StoredOAuthSubscriptionsMap = {
    xai_oauth: {
      provider: "xai_oauth",
      encryptedAccessToken: encryptOAuthSecret(fakeCodexJwt),
      encryptedRefreshToken: encryptOAuthSecret("rt_secret_xai"),
      tokenPreview: maskTokenPreview(fakeCodexJwt),
      accountLabel: "grok-user@x.ai",
      expiresAt: extractJwtExpiryIso(fakeCodexJwt),
      lastRefresh: new Date().toISOString(),
      connectedAt: new Date().toISOString(),
    },
  };

  const sanitized = sanitizeOAuthSubscriptionsMap(storedMap);
  assert.equal(sanitized.xai_oauth.connected, true);
  assert.equal(sanitized.xai_oauth.accountLabel, "grok-user@x.ai");
  assert.equal(sanitized.xai_oauth.tokenPreview, "…123456");
  assert.equal((sanitized.xai_oauth as any).encryptedAccessToken, undefined, "Must never expose encryptedAccessToken");
  assert.equal(sanitized.nous_oauth.connected, false);

  const profileConfig = providerConfigFromProfile({
    userId: "user_1",
    preferredAiProvider: "xai_oauth",
    preferredModel: "grok-3-mini",
    oauthSubscriptions: storedMap,
  });

  const byokValid = validateByokCredentials(profileConfig);
  assert.equal(byokValid.valid, true);
  assert.equal(byokValid.provider, "xai_oauth");

  const chatValid = validateUserChatCredentials(profileConfig);
  assert.equal(chatValid.valid, true);
  assert.equal(chatValid.provider, "xai_oauth");

  const providerClient = getByokProvider(profileConfig);
  assert.ok(providerClient, "getByokProvider must return a provider instance for xai_oauth");
  assert.equal(providerClient.name, "xai_oauth-byos");
  assert.equal(providerClient.isConfigured(), true);

  // Catalog sanity check
  assert.ok(OAUTH_SUBSCRIPTION_CATALOG.length >= 6);
  console.log("oauth-selftest: OK (encryption, JWT claims, origin guards, Codex headers, BYOS routing verified)");
}

main().catch((err) => {
  console.error("oauth-selftest FAILED:", err);
  process.exit(1);
});
