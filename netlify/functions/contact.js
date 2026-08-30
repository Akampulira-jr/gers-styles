"use strict";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

function text(value, maximumLength) {
  return typeof value === "string" && value.trim().length > 0 && value.trim().length <= maximumLength;
}

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, {
      success: false,
      message: "Method not allowed.",
    }, { Allow: "POST" });
  }

  let inquiry;

  try {
    inquiry = JSON.parse(event.body || "{}");
  } catch {
    return jsonResponse(400, {
      success: false,
      message: "Please check the information you entered.",
    });
  }

  const { name, phone, email, service, quantity, message, website } = inquiry;
  const hasValidEmail = email === undefined || email === "" || (typeof email === "string" && email.length <= 254 && EMAIL_PATTERN.test(email));
  const hasValidQuantity = quantity === undefined || quantity === "" || (Number.isInteger(Number(quantity)) && Number(quantity) > 0);

  if (
    !text(name, 100) ||
    !text(phone, 50) ||
    !hasValidEmail ||
    !text(service, 100) ||
    !hasValidQuantity ||
    !text(message, 5000)
  ) {
    return jsonResponse(422, {
      success: false,
      message: "Please check the information you entered.",
    });
  }

  // Bots often complete hidden fields that human visitors never see.
  if (typeof website === "string" && website.trim() !== "") {
    return jsonResponse(200, {
      success: true,
      message: "Inquiry received successfully.",
    });
  }

  // Email delivery and database storage will be added in later steps.
  // Do not log inquiry data here: it can contain personal customer details.
  return jsonResponse(200, {
    success: true,
    message: "Inquiry received successfully.",
  });
};
