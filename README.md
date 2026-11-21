# NUSC Exam Generator — Local AI Edition

نسخة استخدام شخصي بدون تسجيل دخول وبدون Supabase. الواجهة تعمل من خلال Node.js محليًا، وNode.js يتصل بـ OpenRouter مع إبقاء مفتاح API في ملف `.env` على جهازك.

## المتطلبات
- Node.js 20 LTS أو أحدث (لا يحتاج المشروع إلى `npm install`؛ يستخدم مكتبات Node المدمجة فقط).
- اتصال إنترنت حتى يتمكن الخادم من الاتصال بـ OpenRouter وتحميل مكتبات قراءة المستندات من CDN.
- حساب OpenRouter ومفتاح API. استخدم مفتاحًا جديدًا إذا سبق مشاركة مفتاحك في محادثة.

## التشغيل على Windows
1. فك ضغط المجلد.
2. انسخ `.env.example` وسمّ النسخة `.env`.
3. افتح `.env` بمحرر نصوص، وضع مفتاحك الجديد بعد `OPENROUTER_API_KEY=`.
4. احفظ الملف.
5. شغّل `start-windows.bat` أو افتح Terminal داخل المجلد وشغّل `npm start`.
6. افتح `http://localhost:3000` في المتصفح. لا تفتح `index.html` مباشرة ولا تستخدم Live Server؛ يجب أن تمر طلبات AI عبر Node.js.

## إعداد النموذج
القيمة الافتراضية `OPENROUTER_MODEL=openrouter/free` تستخدم موجّه النماذج المجانية المتاحة على OpenRouter. التوفر والحصص تتغير وقد لا يكون كل نموذج متاحًا في كل وقت. المثال `openai/gpt-4o` الذي في توثيق OpenRouter ليس نموذجًا مجانيًا مضمونًا؛ لا تستخدمه إذا كان هدفك عدم الدفع إلا إذا كان حسابك يملك رصيدًا وتقبل التكلفة.

## كيف يعمل الربط
1. المتصفح يقرأ PDF/DOCX/TXT باستخدام مكتبات القراءة الحالية.
2. يرسل النص المستخرج إلى `http://localhost:3000/api/parse-exam`.
3. خادم Node.js يضيف مفتاح OpenRouter من `.env` ويرسل الطلب إلى `https://openrouter.ai/api/v1/chat/completions`.
4. يرجع AI الأسئلة والاختيارات والدرجات فقط. لا يحدد الإجابات الصحيحة. راجع كل سؤال وأكد الإجابات يدويًا قبل إنشاء النماذج الأربعة.

## اختبار الاتصال
افتح `http://localhost:3000/api/health`. يجب أن ترى `"ok":true` و`"aiConfigured":true` بعد إعداد `.env`.

## الأمان والخصوصية
- الخادم مربوط بـ `127.0.0.1` فقط؛ أي أنه يستمع على جهازك ولا يفتح API على الشبكة المحلية.
- لا تضع المفتاح في `js/config.js` أو `app.js` أو GitHub.
- ملف `.env` مستثنى من Git بواسطة `.gitignore`.
- بما أن الاستخدام شخصي ومحلي، لا نحتاج إلى Supabase أو نظام Login لهذا السيناريو.
- النص المستخرج من الامتحان يُرسل إلى OpenRouter لمعالجته. لا ترسل مستندات سرية أو بيانات طلاب حساسة دون مراجعة شروط مزود الخدمة وسياسة الجامعة.

## حدود النسخة
- هذا الربط يضيف AI إلى النص الذي تستخرجه الواجهة بالفعل؛ لا يضيف OCR جديدًا ولا يضمن قراءة كل ملف ممسوح ضوئيًا أو كل جدول/معادلة بدقة.
- راجع كل الأسئلة والاختيارات والدرجات يدويًا. لا يتم استنتاج مفتاح الإجابة.
- إذا تعذر الوصول إلى نموذج مجاني أو انتهت الحصة، سيظهر خطأ من OpenRouter ويمكن إعادة المحاولة لاحقًا.

## النشر
هذه النسخة مهيأة للاستخدام الشخصي على نفس الجهاز. لا ترفعها إلى GitHub Pages وتتوقع أن يعمل AI هناك؛ GitHub Pages لا يشغّل Node.js. لو أردت لاحقًا تشغيل الموقع من أي جهاز، سنحتاج استضافة Backend آمنة بدل الخادم المحلي.


## Scanned PDF OCR
- The browser checks each PDF page for selectable text.
- Pages with little or no text are rendered to images using PDF.js.
- Tesseract.js then recognizes English and Arabic (`eng+ara`) locally in the browser.
- OCR does not require a paid OCR API.
- Internet is required initially to load PDF.js, Tesseract.js and language data from their CDNs.
- Handwriting, pen marks, skewed/blurred photos, formulas and circuit diagrams may be misread. Always review extracted questions before generating exam models.


## OCR update (two-column exams)
Scanned PDF pages are rendered and OCR is run separately on the left and right halves, in that order, to reduce column interleaving. The AI parser has explicit rules for MCQ, True/False, and written/calculation questions. This improves extraction but does not guarantee perfect recognition of handwriting, formulas, or circuit diagrams. Always review every extracted question and option.

## API key safety
The ZIP intentionally does not include `.env`. Copy `.env.example` to `.env` and add your own OpenRouter key locally. Never upload or share `.env`; if a key was shared, revoke it and create a new one.
