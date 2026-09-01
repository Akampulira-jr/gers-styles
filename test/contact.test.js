"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { afterEach } = require("node:test");
const { handler } = require("../netlify/functions/contact.js");

const ORIGINAL_FETCH = global.fetch;
const ORIGINAL_CONSOLE_ERROR = console.error;
const ENVIRONMENT_KEYS = [
  "RESEND_API_KEY",
  "CONTACT_EMAIL",
  "CONTACT_FROM_EMAIL",
];
const ORIGINAL_ENVIRONMENT = Object.fromEntries(
  ENVIRONMENT_KEYS.map((key) => [key, process.env[key]]),
);

function validInquiry(overrides = {}) {
  return {
    name: "Amina N.",
    phone: "+256 700 000000",
    email: "amina@example.com",
    service: "Traditional Wear",
    quantity: "1",
    message: "I would like to arrange a fitting.",
    website: "",
    ...overrides,
  };
}

function eventFor(body, overrides = {}) {
  return {
    httpMethod: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
    ...overrides,
  };
}

function configureEmail() {
  process.env.RESEND_API_KEY = "re_test_key";
  process.env.CONTACT_EMAIL = "hello@gersstyles.com";
  process.env.CONTACT_FROM_EMAIL = "GERS STYLES <website@gersstyles.com>";
}

function responseBody(response) {
  return JSON.parse(response.body);
}

afterEach(() => {
  global.fetch = ORIGINAL_FETCH;
  console.error = ORIGINAL_CONSOLE_ERROR;

  for (const key of ENVIRONMENT_KEYS) {
    if (ORIGINAL_ENVIRONMENT[key] === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = ORIGINAL_ENVIRONMENT[key];
    }
  }
});

test("rejects non-POST requests with 405", async () => {
  const response = await handler({ httpMethod: "GET", headers: {} });

  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "POST");
  assert.equal(responseBody(response).success, false);
});

test("rejects malformed JSON with 400", async () => {
  const response = await handler(eventFor("{"));

  assert.equal(response.statusCode, 400);
  assert.equal(responseBody(response).success, false);
});

test("rejects invalid fields with 422", async () => {
  const response = await handler(eventFor(validInquiry({ phone: "" })));

  assert.equal(response.statusCode, 422);
  assert.equal(responseBody(response).success, false);
});

test("returns fake success for honeypot submissions without calling Resend", async () => {
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
    throw new Error("fetch should not be called");
  };

  const response = await handler(eventFor(validInquiry({ website: "bot" })));

  assert.equal(response.statusCode, 200);
  assert.equal(responseBody(response).success, true);
  assert.equal(fetchCalls, 0);
});

test("fails safely with 500 when email configuration is missing", async () => {
  for (const key of ENVIRONMENT_KEYS) delete process.env[key];
  let fetchCalls = 0;
  global.fetch = async () => {
    fetchCalls += 1;
  };

  const response = await handler(eventFor(validInquiry()));

  assert.equal(response.statusCode, 500);
  assert.equal(responseBody(response).message, "We could not send your inquiry right now. Please try again shortly.");
  assert.equal(fetchCalls, 0);
});

test("sends a normalized and escaped inquiry to Resend", async () => {
  configureEmail();
  let request;
  global.fetch = async (url, options) => {
    request = { url, options };
    return { ok: true, status: 200 };
  };

  const response = await handler(eventFor(validInquiry({
    name: "  <Amina & Co>  ",
    message: "Line one\n<script>alert('x')</script>",
  })));
  const providerBody = JSON.parse(request.options.body);

  assert.equal(response.statusCode, 200);
  assert.equal(responseBody(response).success, true);
  assert.equal(request.url, "https://api.resend.com/emails");
  assert.equal(request.options.method, "POST");
  assert.equal(request.options.headers.Authorization, "Bearer re_test_key");
  assert.match(request.options.headers["Idempotency-Key"], /^gers-contact-[a-f0-9]{64}$/);
  assert.doesNotMatch(request.options.headers["Idempotency-Key"], /Amina|example/);
  assert.deepEqual(providerBody.to, ["hello@gersstyles.com"]);
  assert.equal(providerBody.from, "GERS STYLES <website@gersstyles.com>");
  assert.equal(providerBody.reply_to, "amina@example.com");
  assert.match(providerBody.text, /<Amina & Co>/);
  assert.match(providerBody.html, /&lt;Amina &amp; Co&gt;/);
  assert.match(providerBody.html, /&lt;script&gt;/);
  assert.doesNotMatch(providerBody.html, /<script>/);
});

test("returns a safe error when Resend rejects the request", async () => {
  configureEmail();
  console.error = () => {};
  global.fetch = async () => ({
    ok: false,
    status: 422,
    json: async () => ({ name: "validation_error", message: "provider details" }),
  });

  const response = await handler(eventFor(validInquiry()));
  const body = responseBody(response);

  assert.equal(response.statusCode, 500);
  assert.equal(body.success, false);
  assert.equal(body.message, "We could not send your inquiry right now. Please try again shortly.");
  assert.doesNotMatch(response.body, /provider details|validation_error/);
});

test("rejects services that are not present in the form", async () => {
  const response = await handler(eventFor(validInquiry({ service: "Unknown Service" })));

  assert.equal(response.statusCode, 422);
  assert.equal(responseBody(response).success, false);
});

test("rejects oversized request bodies before parsing", async () => {
  const response = await handler(eventFor("x".repeat((16 * 1024) + 1)));

  assert.equal(response.statusCode, 413);
  assert.equal(responseBody(response).success, false);
});

test("rejects unsupported content types", async () => {
  const response = await handler(eventFor(validInquiry(), {
    headers: { "content-type": "text/plain" },
  }));

  assert.equal(response.statusCode, 415);
  assert.equal(responseBody(response).success, false);
});
