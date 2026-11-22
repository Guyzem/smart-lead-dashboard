# LeadPulse · Smart Lead Management Dashboard

דאשבורד לניהול, מעקב ותעדוף לידים, בעברית מלאה וב-RTL. הלידים נטענים מטבלת Airtable.
פותח במסגרת תרגול שיעור 3 בקורס מטמיעי AI, לפי התהליך **SPEC → REVIEW → BUILD → TEST → COMMIT**.

- מפרט המוצר: [SPEC.md](SPEC.md)
- תהליך העבודה המחייב: [Practice.md](Practice.md)
- הוראות ל-Claude: [CLAUDE.md](CLAUDE.md)

## הפעלה מקומית

דרישות: [Node.js](https://nodejs.org) גרסת LTS (נבדק על Node 26).

```bash
npm install
npm run dev
```

לאחר מכן פתח בדפדפן את הכתובת שמופיעה בטרמינל: **http://localhost:5173**

## חיבור ל-Airtable

בפתיחה מוצג מסך התחברות. צריך להזין:

1. **Personal Access Token**: יוצרים ב-[airtable.com/create/tokens](https://airtable.com/create/tokens) עם ההרשאות `data.records:read` ו-`data.records:write` (לכתיבה חזרה של סטטוסים והערות, SPEC X2), ומוסיפים תחת Access **רק** את הבסיס "Lead Dashboard".
2. **מזהה בסיס** (מתחיל ב-`app`) ו**טבלה**: ממולאים מראש לבסיס "Lead Dashboard" ולטבלת "לידים".

הטוקן נשמר רק בדפדפן: בלי "זכור אותי" ב-`sessionStorage` (נמחק בסגירת הלשונית), עם "זכור אותי" ב-`localStorage`. הוא נשלח רק ל-`api.airtable.com`. "התנתקות מ-Airtable" בתפריט מוחקת אותו. הדאשבורד קורא בלבד: שינויי סטטוס והערות נשמרים בדפדפן ולא נכתבים ל-Airtable.

## מקור מידע חיצוני: Frankfurter API

דוגמה לחיבור מקור נתונים חיצוני ציבורי (מתוך הרשימה [public-apis](https://github.com/public-apis/public-apis)). SPEC X1, קריטריון D16.

| | |
|---|---|
| **שם** | [Frankfurter](https://frankfurter.dev) (קוד פתוח) |
| **כתובת** | `https://api.frankfurter.dev/v1` (הכתובת הישנה `api.frankfurter.app` מפנה אליה) |
| **מה הוא מספק** | שערי חליפין יומיים שמפרסם הבנק המרכזי האירופי (ECB), כולל שקל |
| **מפתח / טוקן** | לא צריך. ה-API חינמי, פתוח ותומך ב-CORS, ולכן הדפדפן פונה אליו ישירות |
| **הקריאה** | `GET /latest?from=ILS&to=USD,EUR,GBP`, בקשה אחת שמחזירה כמה $, € ו-£ שווה ₪1 ואת תאריך השער |
| **איפה בקוד** | [src/lib/exchangeRates.ts](src/lib/exchangeRates.ts): כתובת הבסיס בקבוע `FRANKFURTER_BASE_URL`, הקריאה, הוולידציה והמטמון (שעה ב-`sessionStorage`). [src/state/useDisplayCurrency.ts](src/state/useDisplayCurrency.ts): המטבע הנבחר. [src/components/CurrencySelector.tsx](src/components/CurrencySelector.tsx): הבורר בכותרת |

**בממשק:** בכותרת העליונה יש בורר "מטבע תצוגה" (₪ / $ / € / £). בבחירת מטבע זר, השווי ב-KPI, בטבלה, בכרטיס הליד, ב"במה לטפל היום", בביצועי הנציגים ובמשפך מוצג מומר, ומתחת לבורר מופיע "שער נכון ל-<תאריך> · מקור: Frankfurter / ECB". השערים נטענים רק כשבוחרים מטבע זר. אם הטעינה נכשלת, הבורר חוזר לשקלים עם הודעה. ה-Lead Score לא משתנה, כי הוא מחושב תמיד בשקלים. בבדיקות ה-API מדומה ואין פנייה אמיתית לרשת.

## גרסה אונליין (GitHub Pages)

**https://guyzem.github.io/smart-lead-dashboard/**

כל push ל-`main` מריץ את GitHub Actions ([deploy.yml](.github/workflows/deploy.yml)): קודם הבדיקות, אחר כך build, ורק אם הכול עבר מתבצע פרסום. השינויים המקומיים נשמרים ב-localStorage של כל דפדפן בנפרד.

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | שרת פיתוח עם רענון אוטומטי |
| `npm test` | בדיקות יחידה ורכיבים (Vitest) |
| `npm run test:e2e` | בדיקות דפדפן (Playwright על Microsoft Edge): RTL, 375px/1440px, שגיאות JS, שמירה |
| `npm run typecheck` | בדיקת טיפוסים (TypeScript) |
| `npm run build` | בניית גרסת פרודקשן לתיקיית `dist` |

## מה יש בדאשבורד

- **סקירה כללית:** 6 כרטיסי KPI, התראה על לידים ממתינים, גרפים (מקור, סטטוס, מגמה שבועית, משפך המרות), רשימת "במה לטפל היום" וביצועי נציגים. לחיצה על גרף מסננת את כל הדאשבורד.
- **כל הלידים:** טבלה עם מיון, עימוד, שינוי סטטוס בשורה, וחיפוש וסינון לפי סטטוס, מקור ונציג.
- **כרטיס ליד:** פרטים מלאים, פירוק Lead Score ("למה 82?"), הערות ואינטראקציות.
- **שיטת הניקוד:** הסבר שקוף של הנוסחה. הציון מבוסס חוקים בלבד, ללא AI.
- **שמירה:** שינויי סטטוס והערות נשמרים ב-`localStorage`. כפתור "איפוס נתוני דמה" בתפריט.

## מבנה הקוד

```
src/
  data/generateLeads.ts   נתוני דמה דטרמיניסטיים לבדיקות (seed קבוע, 120 לידים)
  lib/airtable.ts         טעינת לידים מ-Airtable REST API, מיפוי שדות והודעות שגיאה
  lib/exchangeRates.ts    שערי מטבע מ-Frankfurter API, המרה ומטמון לשעה (SPEC X1)
  lib/credentials.ts      שמירת החיבור בדפדפן בלבד (session/local) והתנתקות
  lib/scoring.ts          נוסחת Lead Score, עדיפות, סימון "ממתין לטיפול"
  lib/metrics.ts          KPI וכל נתוני הגרפים, מאותו מערך לידים
  lib/filters.ts          חיפוש, סינון ומיון
  lib/storage.ts          שמירה וטעינה מ-localStorage עם ולידציה
  state/useLeadStore.ts   מצב האפליקציה
  components/             רכיבי UI
  Root.tsx                מסך החיבור לפני הדאשבורד
  App.tsx                 הרכבת המסכים
e2e/                      בדיקות Playwright
```

## תהליך הפיתוח (שיעור 3)

| שלב | מה נעשה |
|---|---|
| SPEC | נכתב `SPEC.md` לפי חמש השאלות (Who, What, Where, Features, Done Means) |
| REVIEW | המפרט והתוכנית הוצגו ואושרו לפני כתיבת קוד ולפני התקנות |
| BUILD | Branch לכל משימה: `chore/project-setup` → `feat/data-and-metrics` → `feat/dashboard-ui` → `test/e2e` → `docs/readme` |
| TEST | 68 בדיקות יחידה ורכיבים + 6 בדיקות E2E, כולן עוברות. קריטריוני D1–D11 ומקרי הקצה מכוסים |
| COMMIT | Commit לכל משימה לוגית, עם הפניה לסעיף ב-SPEC (`git log --oneline`) |

ממצא בזמן הבדיקות: בבדיקת E2E הלחיצה על מרכז שורה בטבלה נפלה על תפריט הסטטוס, שבכוונה אינו פותח את כרטיס הליד. הבדיקה תוקנה כך שתלחץ על שם הלקוח.
ליטוש לאחר צילומי מסך: גרף הסטטוס הוסב לעמודות אופקיות כדי שהתוויות לא יחפפו במובייל, והמקרא של גרף המגמה הוצא אל כותרת הכרטיס.

## Stack ולמה

React + TypeScript + Vite + Tailwind CSS + Recharts, ובדיקות עם Vitest, Testing Library ו-Playwright.
הבחירה פשוטה ומהירה, ולא דורשת שרת. TypeScript מונע טעויות בחישובים. Tailwind תומך ב-RTL באמצעות מאפיינים לוגיים (`ms-`/`me-`/`start-`). Recharts מספקת גרפים אינטראקטיביים.
