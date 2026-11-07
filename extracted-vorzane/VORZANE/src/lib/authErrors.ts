export function friendlyAuthError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  if (/invalid login credentials/i.test(message)) return "البريد أو كلمة المرور غير صحيحة.";
  if (/user already registered/i.test(message)) return "هذا البريد مسجّل بالفعل؛ جرّب تسجيل الدخول.";
  if (/password.*(least|short|weak)/i.test(message)) return "اختر كلمة مرور أقوى، من 8 أحرف على الأقل.";
  if (/provider.*(not enabled|disabled|unsupported)|unsupported provider/i.test(message)) return "تسجيل Google يحتاج إعداد OAuth في مشروع Supabase أولًا.";
  if (/redirect.*(not allowed|allow list)/i.test(message)) return "عنوان العودة غير مضاف إلى قائمة إعادة التوجيه في Supabase.";
  if (/anonymous.*(disabled|not enabled)/i.test(message)) return "تسجيل الضيف غير مفعّل بعد في إعدادات Supabase.";
  if (/network|fetch failed|timeout|timed out|failed to fetch/i.test(message)) return "تعذر الاتصال بخدمة الحسابات. تحقق من الاتصال وحاول مجددًا.";
  return message || "تعذر إكمال تسجيل الدخول. تحقق من الاتصال وحاول مجددًا.";
}