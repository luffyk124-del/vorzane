# مراجعة المصادر المفتوحة في VORZANE

## المكوّن المعتمد

- المشروع: [ClimbStack/climbstack-app](https://github.com/ClimbStack/climbstack-app)
- الترخيص: MIT.
- الملف الأصلي: `src/components/ProgressRing.tsx`.
- الملف المضاف إلى VORZANE: `src/components/ProgressRing.tsx`.
- الاستخدام: حلقة تقدّم الخبرة في صفحة الشخصية.
- التوافق: المكوّن يعتمد على React Native و`react-native-svg` فقط. الحزمة موجودة مسبقاً في VORZANE؛ لم نضف اعتماداً جديداً أو نغيّر إصدار Expo.
- التعديل: احتفظنا بسلوك الحلقة وإمكانية الوصول، ووضعنا إشعار المصدر والترخيص في رأس الملف.

## مصادر راجعناها ولم ننسخ منها

- `jxnata/expo-game-boilerplate`: قريب من Expo Router، لكن بيانات المستودع لا تعلن ترخيصاً واضحاً؛ لذلك لم ننسخ كوده.
- `PrimeCodeWhisperer/habitquest-native`: يتضمن أفكاراً عن التقدم والإنجازات، لكن لا يوجد ترخيص معلن في بيانات المستودع؛ لذلك لم ننسخ كوده.
- لم نعتمد قالباً كاملاً يتطلب استبدال بنية التطبيق أو تبديل إدارة التنقل؛ VORZANE سيبقى على Expo Router وReact Native الحاليين.

## ملاحظات الدمج

- لم تُضف مكتبات جديدة.
- لم تُجرَ أي تغييرات على Supabase أو مخطط قاعدة البيانات أو بيانات اللاعبين.
- حقول مظهر الشخصية القديمة تبقى للتوافق مع ملفات الحفظ السابقة، لكن واجهة المستخدم لم تعد تعرض خيارات لتعديلها.
- تم فصل صفحة الشخصية عن الملف الشخصي والإعدادات، وإزالة صور الأبطال من واجهة اختيار الفئات وعرض الشخصية.

## نص ترخيص MIT للمكوّن المعاد استخدامه

Copyright (c) 2026 Giovanni Zanotti

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
