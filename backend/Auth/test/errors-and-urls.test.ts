import test from "node:test";
import assert from "node:assert/strict";

import { HttpError, clientErrorMessage } from "../src/utils/httpError.ts";
import { getAllowedOrigins, getFrontendBaseUrl } from "../src/utils/frontendUrl.ts";

test("clientErrorMessage only exposes HttpError messages", () => {
  assert.equal(clientErrorMessage(new HttpError("Group not found"), "fallback"), "Group not found");
  assert.equal(
    clientErrorMessage(new Error("SQLITE_ERROR: no such column: secret"), "fallback"),
    "fallback",
  );
  assert.equal(clientErrorMessage("boom", "fallback"), "fallback");
});

test("HttpError defaults to 400 and keeps a custom status", () => {
  assert.equal(new HttpError("bad").statusCode, 400);
  assert.equal(new HttpError("missing", 404).statusCode, 404);
});

test("frontend URL comes from configuration only", () => {
  const saved = { FRONTEND_URL: process.env.FRONTEND_URL, CORS_ORIGINS: process.env.CORS_ORIGINS };
  try {
    process.env.FRONTEND_URL = "https://app.example.com///";
    delete process.env.CORS_ORIGINS;
    assert.equal(getFrontendBaseUrl(), "https://app.example.com");
    assert.deepEqual(getAllowedOrigins(), ["https://app.example.com"]);

    process.env.CORS_ORIGINS = "https://a.example, https://b.example/";
    assert.deepEqual(getAllowedOrigins(), ["https://a.example", "https://b.example"]);
    assert.deepEqual(getAllowedOrigins("https://socket.example"), ["https://socket.example"]);

    delete process.env.FRONTEND_URL;
    delete process.env.CORS_ORIGINS;
    assert.equal(getFrontendBaseUrl(), "https://localhost:8443");
  } finally {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
