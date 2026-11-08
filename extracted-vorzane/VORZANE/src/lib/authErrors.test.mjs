import assert from "node:assert/strict";
import test from "node:test";
import { friendlyAuthError } from "./authErrors.ts";

test("account sign-in failures are mapped to clear Arabic messages", () => {
  assert.match(friendlyAuthError(new Error("Invalid login credentials")), /البريد أو كلمة المرور/);
  assert.match(friendlyAuthError(new Error("Anonymous sign-ins are disabled")), /تسجيل الضيف غير متاح/);
  assert.match(friendlyAuthError(new Error("redirect URL not allowed")), /عنوان العودة غير مضاف/);
});

test("network failures never surface as unhandled auth errors", () => {
  assert.match(friendlyAuthError(new TypeError("Failed to fetch")), /تعذر الاتصال بخدمة الحسابات/);
  assert.match(friendlyAuthError(new Error("Request timeout")), /تعذر الاتصال بخدمة الحسابات/);
  assert.equal(friendlyAuthError(new Error("provider is not enabled")), "طريقة تسجيل الدخول هذه غير متاحة. جرّب تسجيل الدخول بالبريد الإلكتروني.");
});