# Jenkins CI/CD Final Project — קו ייצור לשני שירותים

## סקירה

הפרויקט מממש קו CI/CD מלא ב־Jenkins עבור שתי אפליקציות נפרדות שמתקשרות ביניהן:

* `api` — שירות נתונים המחזיר JSON בלבד.
* `web` — שירות התצוגה שמקבל בקשות מהמשתמש ופונה ל־API דרך רשת Docker פנימית.

הפרויקט כולל בדיקות יחידה, שער כיסוי של 80%, בדיקות אינטגרציה, הפרדה בין `dev` ל־`main`, ו־Blue-Green Deployment עם NGINX ויכולת Rollback.

---

## ארכיטקטורה

```text
                        Browser
                           |
                           | http://localhost:8085
                           v
                    +-------------+
                    |    NGINX    |
                    |     :8085   |
                    +-------------+
                           |
                  +--------+--------+
                  |                 |
             Blue / Green      רק צבע פעיל
                  |                 
                  v
              +-------+
              |  WEB  |
              +-------+
                  |
                  | Docker internal network
                  | http://api:3000
                  v
              +-------+
              |  API  |
              +-------+
```

ל־WEB אין גישה ל־API דרך `localhost`. התקשורת בין השירותים מתבצעת באמצעות שם השירות ברשת Docker, למשל:

```text
http://api:3000
```

הכתובת שהמשתמש פותח מבחוץ נשארת קבועה:

```text
http://localhost:8085
```

---

## מבנה המאגר

```text
jenkins-final-project/
│
├── api/
│   ├── app.js
│   ├── Dockerfile
│   ├── package.json
│   └── tests/
│       └── app.test.js
│
├── web/
│   ├── app-web.js
│   ├── Dockerfile
│   ├── package.json
│   └── tests/
│       ├── app-web.test.js
│       └── integration.test.js
│
├── nginx/
│   └── nginx.conf.template
│
├── docker-compose.yml
├── Jenkinsfile
└── README.md
```

---

# 1. שני שירותים ברשת פנימית

קיימים שני Docker images נפרדים:

```text
jenkins-final-project-api
jenkins-final-project-web
```

השירותים מתקשרים דרך רשת Docker משותפת.

ה־API מחזיר JSON בלבד.

ה־WEB פונה ל־API דרך כתובת פנימית:

```text
http://api:3000
```

בנוסף לבדיקות היחידה קיימת בדיקת אינטגרציה שמפעילה את ה־WEB וה־API יחד ומוודאת שה־WEB באמת מצליח לקבל נתונים מה־API.

---

# 2. Build Stamp

לשני השירותים קיים endpoint:

```text
/health
```

והתגובה היא בפורמט:

```json
{
  "status": "ok",
  "build": "27",
  "commit": "e5b10a4"
}
```

השדות הם:

| שדה      | תוכן                                      |
| -------- | ----------------------------------------- |
| `status` | הערך הקבוע `ok`                           |
| `build`  | מספר ה־Build של Jenkins                   |
| `commit` | שבעת התווים הראשונים של מזהה ה־Git commit |

הערכים מוזרקים בזמן בניית ה־Docker image באמצעות:

```text
BUILD_NUMBER
GIT_COMMIT
```

לדוגמה:

```text
docker compose build \
  --build-arg BUILD_NUMBER=${BUILD_NUMBER} \
  --build-arg GIT_COMMIT=${GIT_COMMIT}
```

המטרה היא לאפשר לזהות בדיוק איזו גרסה רצה בסביבה הפעילה.

---

# 3. שער כיסוי בדיקות

ה־Pipeline דורש לפחות 80% כיסוי Statements.

קיימים שערי כיסוי נפרדים עבור:

```text
API
WEB
```

אם הכיסוי נמוך מ־80%, ה־Pipeline נעצר ולא ממשיך לשלבי הבנייה וה־Deployment.

לדוגמה, במהלך מבחן החבלה הכיסוי של ה־API ירד ל־21.95%, וה־Build נעצר לפני Deployment.

---

# 4. התנהגות לפי ענף

המאגר מנוהל באמצעות Jenkins Multibranch Pipeline.

קיימים שני ענפים פעילים:

```text
dev
main
```

## dev

ב־`dev` מתבצעים:

```text
API Tests
↓
API Coverage
↓
WEB Unit Tests
↓
WEB Coverage
↓
Docker Build
↓
Integration Test
```

אין Deployment לייצור.

## main

ב־`main` מתבצע התהליך המלא:

```text
Tests
↓
Coverage
↓
Docker Build
↓
Blue-Green Deployment
↓
Health Check
↓
Integration Test
↓
NGINX Switch
↓
Old Version Removal
```

לכל ענף יש Job והיסטוריית Builds משלו באמצעות Multibranch Pipeline.

---

# 5. Blue-Green Deployment

## מטרה

המשתמש פונה תמיד לאותה כתובת:

```text
http://localhost:8085
```

מאחורי הכתובת נמצא NGINX, שמפנה את התעבורה לצבע הפעיל.

המערכת משתמשת בשני צבעים:

```text
Blue
Green
```

רק אחד מהם פעיל ומקבל תעבורה בכל רגע.

---

## תהליך Deployment תקין

נניח ש־Blue היא הגרסה הפעילה:

```text
NGINX
  |
  v
BLUE
```

בעת Deployment חדש:

### שלב 1 — העלאת הגרסה החדשה

Green עולה לצד Blue על פורט זמני:

```text
Blue  → הגרסה הישנה והפעילה
Green → הגרסה החדשה
```

לדוגמה:

```text
Green WEB → 8087
```

Blue ממשיכה לשרת בזמן הזה.

### שלב 2 — Health Check

Jenkins בודק את:

```text
green-api:3000/health
green-web:3000/health
```

בנוסף נבדקים:

```text
status
build
commit
```

כך Jenkins מוודא שהגרסה החדשה גם בריאה וגם מכילה את ה־Build וה־Commit הצפויים.

### שלב 3 — Integration Test

מתבצעת בדיקה שמוודאת:

```text
WEB → API
```

עבור הגרסה החדשה.

רק אם הבדיקה עוברת ממשיכים.

### שלב 4 — החלפת תעבורה

NGINX מקבל configuration חדש ומבצע:

```text
nginx -t
nginx -s reload
```

כך התעבורה עוברת ל־Green בלי לעצור את NGINX.

### שלב 5 — אימות דרך הכתובת הקבועה

Jenkins בודק:

```text
http://frontend-nginx/health
```

ומוודא שהתגובה מגיעה מהגרסה החדשה.

### שלב 6 — הסרת הגרסה הישנה

רק לאחר שהגרסה החדשה אומתה בהצלחה:

```text
Blue → stopped and removed
Green → active
```

---

# 6. Rollback

במקרה שבו הגרסה החדשה נכשלת:

```text
Health Check
או
Integration Test
```

הגרסה החדשה נמחקת בלבד.

הגרסה הישנה נשארת פעילה.

אם כבר בוצע שינוי ב־NGINX, התצורה הקודמת משוחזרת וה־NGINX מבצע reload.

התוצאה:

```text
NEW ❌
   |
   v
Removed

OLD ✅
   |
   v
Still serving traffic

Jenkins → FAILURE
```

כך כשל בגרסה החדשה אינו מוריד את האתר.

---

# 7. הוכחת Zero Downtime

בזמן Deployment בוצעה בדיקה רציפה מול:

```text
http://localhost:8085/health
```

במרווחים של כ־200ms.

במהלך המעבר נצפה רצף כדוגמת:

```text
build=26
build=26
build=26
build=26
build=27
build=27
build=27
build=27
```

ללא תשובת:

```text
ERROR
```

כלומר NGINX המשיך לשרת בזמן שהגרסה הוחלפה.

זה מדגים את דרישת ה־Zero Downtime של המטלה.

---

# 8. מבחן החבלה

ה־Pipeline נבדק מול חמשת תרחישי החבלה שנדרשו במטלה.

## 6א — שבירת בדיקה

נבדק Build שבו assertion בבדיקת WEB שונה בכוונה.

התוצאה:

```text
WEB Unit Tests → FAILED
```

שלבי Coverage, Docker ו־Deployment לא רצו.

## 6ב — Coverage מתחת ל־80%

נוסף קוד שלא מכוסה בבדיקות.

הכיסוי ירד ל־21.95%.

התוצאה:

```text
API Tests → tests pass
Coverage threshold → FAILED
```

ה־Pipeline לא המשיך לבנייה או Deployment.

## 6ג — `/health` מחזיר שגיאה

הגרסה החדשה הוגדרה להחזיר:

```json
{
  "status": "error"
}
```

ה־Health Check זיהה את הכשל.

התוצאה:

```text
NEW → removed
OLD → remained active
Jenkins → FAILURE
```

הגרסה הפעילה המשיכה להחזיר את ה־Build הקודם דרך NGINX.

## 6ד — שבירת WEB → API

ה־WEB הוגדר זמנית לפנות לכתובת לא תקינה.

ה־Health Check עבר מכיוון שהוא אינו תלוי ב־API.

בדיקת האינטגרציה נכשלה:

```text
Integration Test → FAILED
```

ה־NGINX לא הוחלף והגרסה הקודמת נשארה פעילה.

## 6ה — Dockerfile שגוי

נוספה בכוונה פקודה לא חוקית ל־Dockerfile.

Docker נכשל בשלב parsing:

```text
dockerfile parse error
unknown instruction
```

כתוצאה מכך שלבי Deployment לא הורצו.

---

# 9. פקודות הפעלה מקומית

### הפעלת Jenkins

```powershell
docker start jenkins
```

Jenkins זמין ב:

```text
http://localhost:8080
```

### הרצת השירותים המקומיים

```powershell
docker compose up -d --build
```

### בדיקת השירותים

```powershell
docker compose ps
```

### בדיקת WEB

```powershell
Invoke-RestMethod http://localhost:8085/
```

### בדיקת Health

```powershell
Invoke-RestMethod http://localhost:8085/health
```

### עצירת Compose

```powershell
docker compose down --remove-orphans
```

---

# 10. הגשה

## קישור למאגר

יש לצרף את קישור GitHub של המאגר.

## צילום Build ירוק

מומלץ להשתמש ב־Build מלא שעבר בהצלחה, לדוגמה:

```text
Build #26
```

או Build מלא אחר שמוצג כ־SUCCESS.

## צילום Build אדום

ניתן להשתמש באחד ממבחני החבלה:

```text
Build #23 — Test Failure
Build #24 — Coverage Failure
Build #25 — Dockerfile Failure
```

## צילום Rollback

ניתן להשתמש בתרחיש Health Check או Integration Failure שבו רואים:

```text
NEW removed
OLD remains active
Jenkins FAILURE
```

## הוכחה לשני ענפים

יש להציג ב־Multibranch:

```text
dev
main
```

וכן Build History נפרד לכל ענף.

## הוכחת Zero Downtime

יש לצרף את לוג הבדיקות הרציפות שמראה מעבר בין Build ישן לחדש ללא `ERROR`.

---

# 11. נקודת החוזק של הפתרון

היתרון המרכזי בארכיטקטורה הוא שה־Deployment אינו תלוי בהחלפת הפורט החיצוני.

הכתובת:

```text
localhost:8085
```

נשארת קבועה.

NGINX נשאר פעיל ומחליף את ה־backend באמצעות reload:

```text
Blue → Green
```

או:

```text
Green → Blue
```

כך ניתן להעלות גרסה חדשה, לבדוק אותה ולבצע Rollback בלי להפיל את השירות הפעיל.

---

# 12. סיכום

הפרויקט מממש:

```text
Two Services
+
Internal Docker Network
+
Build Stamp
+
80% Coverage Gate
+
Multibranch Pipeline
+
DEV / MAIN Separation
+
Blue-Green Deployment
+
NGINX
+
Health Checks
+
Integration Tests
+
Automatic Rollback
+
Zero-Downtime Validation
```

ה־Pipeline בנוי כך שכשל מתגלה בשלב המתאים ומונע מעבר לשלב הבא, בעוד שב־Blue-Green כשל בגרסה החדשה אינו פוגע בגרסה הישנה הפעילה.
