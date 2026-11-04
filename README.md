# LeadPulse · Smart Lead Management Dashboard

דאשבורד לניהול, מעקב ותעדוף לידים, בעברית מלאה וב-RTL, מבוסס נתוני דמה (Mock Data).
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
  data/generateLeads.ts   נתוני דמה דטרמיניסטיים (seed קבוע, 120 לידים)
  lib/scoring.ts          נוסחת Lead Score, עדיפות, סימון "ממתין לטיפול"
  lib/metrics.ts          KPI וכל נתוני הגרפים, מאותו מערך לידים
  lib/filters.ts          חיפוש, סינון ומיון
  lib/storage.ts          שמירה וטעינה מ-localStorage עם ולידציה
  state/useLeadStore.ts   מצב האפליקציה
  components/             רכיבי UI
  App.tsx                 הרכבת המסכים
e2e/                      בדיקות Playwright
```

## Stack ולמה

React + TypeScript + Vite + Tailwind CSS + Recharts, ובדיקות עם Vitest, Testing Library ו-Playwright.
הבחירה פשוטה ומהירה, ולא דורשת שרת. TypeScript מונע טעויות בחישובים. Tailwind תומך ב-RTL באמצעות מאפיינים לוגיים (`ms-`/`me-`/`start-`). Recharts מספקת גרפים אינטראקטיביים.
