"use strict";

const { createHmac } = require("node:crypto");

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FROM_EMAIL_PATTERN = /^(?:[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+|[^<>\r\n]+\s+<[^\s<>@]+@[^\s<>@]+\.[^\s<>@]+>)$/;
const RESEND_ENDPOINT = "https://api.resend.com/emails";
const REQUEST_BODY_LIMIT = 16 * 1024;
const RESEND_TIMEOUT_MS = 10_000;
const ALLOWED_SERVICES = new Set([
  "Traditional Wear",
  "Suits & Formal Wear",
  "School Uniforms",
  "Medical Scrubs",
  "Corporate / Work Uniforms",
  "Sweaters & School Wear",
  "Custom Design",
  "Other",
]);

function jsonResponse(statusCode, body, headers = {}) {
  return {
    statusCode,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      ...headers,
    },
    body: JSON.stringify(body),
  };
}

function normalizeRequiredText(value, maximumLength) {
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length > 0 && normalized.length <= maximumLength
    ? normalized
    : null;
}

function normalizeOptionalText(value, maximumLength) {
  if (value === undefined || value === "") return "";
  if (typeof value !== "string") return null;

  const normalized = value.trim();
  return normalized.length <= maximumLength ? normalized : null;
}

function normalizeQuantity(value) {
  if (value === undefined || value === "") return "";

  const normalized = typeof value === "number" ? String(value) : value;
  if (typeof normalized !== "string" || normalized.trim() === "") return null;

  const number = Number(normalized);
  return Number.isInteger(number) && number > 0 ? String(number) : null;
}

function normalizeInquiry(inquiry) {
  const name = normalizeRequiredText(inquiry.name, 100);
  const phone = normalizeRequiredText(inquiry.phone, 50);
  const email = normalizeOptionalText(inquiry.email, 254);
  const service = normalizeRequiredText(inquiry.service, 100);
  const quantity = normalizeQuantity(inquiry.quantity);
  const message = normalizeRequiredText(inquiry.message, 5000);
  const website = normalizeOptionalText(inquiry.website, 200);

  if (
    name === null ||
    phone === null ||
    email === null ||
    (email !== "" && !EMAIL_PATTERN.test(email)) ||
    service === null ||
    !ALLOWED_SERVICES.has(service) ||
    quantity === null ||
    message === null ||
    website === null
  ) {
    return null;
  }

  return { name, phone, email, service, quantity, message, website };
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[character]);
}

function displayValue(value) {
  return value === "" ? "Not provided" : value;
}

function buildEmail(inquiry) {
  const fields = [
    ["Name", inquiry.name],
    ["Phone / WhatsApp", inquiry.phone],
    ["Email", displayValue(inquiry.email)],
    ["Service", inquiry.service],
    ["Quantity", displayValue(inquiry.quantity)],
    ["Message / Requirements", inquiry.message],
  ];

  const text = fields
    .map(([label, value]) => `${label}:\n${value}`)
    .join("\n\n");
  const html = fields
    .map(([label, value]) => {
      const safeValue = escapeHtml(value).replace(/\r?\n/g, "<br>");
      return `<p><strong>${label}</strong><br>${safeValue}</p>`;
    })
    .join("");

  return { text, html };
}

function getEmailConfig() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const contactEmail = process.env.CONTACT_EMAIL?.trim();
  const fromEmail = process.env.CONTACT_FROM_EMAIL?.trim();

  if (
    !apiKey ||
    !contactEmail ||
    !EMAIL_PATTERN.test(contactEmail) ||
    !fromEmail ||
    !FROM_EMAIL_PATTERN.test(fromEmail)
  ) {
    return null;
  }

  return { apiKey, contactEmail, fromEmail };
}

function createIdempotencyKey(inquiry, apiKey) {
  const canonicalInquiry = JSON.stringify([
    inquiry.name,
    inquiry.phone,
    inquiry.email,
    inquiry.service,
    inquiry.quantity,
    inquiry.message,
  ]);
  const digest = createHmac("sha256", apiKey)
    .update(canonicalInquiry)
    .digest("hex");

  return `gers-contact-${digest}`;
}

function requestContentType(event) {
  const headers = event.headers || {};
  return headers["content-type"] || headers["Content-Type"] || "";
}

function serverErrorResponse() {
  return jsonResponse(500, {
    success: false,
    message: "We could not send your inquiry right now. Please try again shortly.",
  });
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed.",
    }, { Allow: "POST" });
  }

  const contentType = requestContentType(event)
    .split(";", 1)[0]
    .trim()
    .toLowerCase();
  if (contentType !== "application/json") {
    return jsonResponse(415, {
      success: false,
      message: "Content type must be application/json.",
    });
  }

  const requestBody = event.body || "";
  if (Buffer.byteLength(requestBody, "utf8") > REQUEST_BODY_LIMIT) {
    return jsonResponse(413, {
      success: false,
      message: "The inquiry is too large.",
    });
  }

  let inquiry;

  try {
    inquiry = JSON.parse(requestBody || "{}");
  } catch {
    return jsonResponse(400, {
      success: false,
      message: "Please check the information you entered.",
    });
  }

  if (!inquiry || typeof inquiry !== "object" || Array.isArray(inquiry)) {
    return jsonResponse(422, {
      success: false,
      message: "Please check the information you entered.",
    });
  }

  const normalizedInquiry = normalizeInquiry(inquiry);
  if (!normalizedInquiry) {
    return jsonResponse(422, {
      success: false,
      message: "Please check the information you entered.",
    });
  }

  // Bots often complete hidden fields that human visitors never see.
  if (normalizedInquiry.website !== "") {
    return jsonResponse(200, {
      success: true,
      message: "Inquiry received successfully.",
    });
  }

  const config = getEmailConfig();
  if (!config) return serverErrorResponse();

  const email = buildEmail(normalizedInquiry);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), RESEND_TIMEOUT_MS);

  try {
    const providerResponse = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
        "Idempotency-Key": createIdempotencyKey(normalizedInquiry, config.apiKey),
      },
      body: JSON.stringify({
        from: config.fromEmail,
        to: [config.contactEmail],
        subject: "New GERS STYLES inquiry",
        text: email.text,
        html: email.html,
        ...(normalizedInquiry.email ? { reply_to: normalizedInquiry.email } : {}),
      }),
      signal: controller.signal,
    });

    if (!providerResponse.ok) {
      let providerErrorType = "unknown";

      try {
        const providerBody = await providerResponse.json();
        if (typeof providerBody?.name === "string") {
          providerErrorType = providerBody.name.slice(0, 80);
        }
      } catch {
        // The HTTP status is sufficient when the provider body is not JSON.
      }

      console.error("Resend request failed", {
        status: providerResponse.status,
        type: providerErrorType,
      });
      return serverErrorResponse();
    }

    return jsonResponse(200, {
      success: true,
      message: "Inquiry received successfully.",
    });
  } catch (error) {
    console.error("Resend request error", {
      type: error instanceof Error ? error.name : "unknown",
    });
    return serverErrorResponse();
  } finally {
    clearTimeout(timeout);
  }
};
