# Endaxi — Πλήρης Code Review & Security Audit

**Ημερομηνία:** 29 Ιουλίου 2026
**Εύρος:** ολόκληρο το `server/` (API routes, database layer, business logic/integrations, auth/middleware) και το `app/` (frontend), συν dependency audit.
**Μέθοδος:** στατική ανάγνωση κώδικα (χωρίς εκτέλεση/pentest), cross-checked με `pnpm audit` και έρευνα σε γνωστά CVEs για τα βασικά dependencies (better-auth, Nuxt).

## Σύνοψη

Συνολικά ο κώδικας είναι **αρκετά ώριμος για ένα SaaS σε αυτό το στάδιο**. Δεν βρέθηκε κανένα **Critical** εύρημα (κάτι άμεσα εκμεταλλεύσιμο για data breach ή πλήρη παράκαμψη auth). Τα πιο σοβαρά ζητήματα είναι:

| Severity | Πλήθος | Απαιτεί ενέργεια πριν το production; |
|---|---|---|
| Critical | 0 | — |
| High | 5 | Ναι, όλα πριν το launch |
| Medium | 8 | Συνιστάται πριν το launch |
| Low | 10 | Μπορούν να μπουν στο backlog |
| Informational | — | Θετικά ευρήματα / σημειώσεις |

Τα δυνατά σημεία: το SSRF guard (`safe-public-fetch.ts`) είναι εξαιρετικά καλά υλοποιημένο, η αριθμοδότηση παραστατικών (`numbering.ts`) είναι σωστά ασφαλισμένη με DB-level locking + unique indexes, δεν βρέθηκε κανένα SQL injection πουθενά, το CSP/CSRF setup είναι σωστό, και η κάλυψη με tests (18 αρχεία) στοχεύει ακριβώς τα ευαίσθητα σημεία (SSRF, rate-limit, email injection, αριθμοδότηση).

---

## Κατάσταση διόρθωσης — 29 Ιουλίου 2026

Όλα τα High και Medium ευρήματα, και τα περισσότερα Low, διορθώθηκαν στον κώδικα. Σύνοψη:

| # | Κατάσταση | Σημείωση |
|---|---|---|
| H1 | ✅ Διορθώθηκε | Whitelist regex στο `documentSeries` (και στα δύο routes) + defense-in-depth έλεγχος path segments στο `storage.ts`. |
| H2 | ✅ Διορθώθηκε | Fail-fast throw στο `inngest/client.ts` αν λείπει `INNGEST_SIGNING_KEY` σε production. |
| H3 | ✅ Διορθώθηκε | FK στο schema + νέο migration `0002_security_audit_fixes.sql`. **Δες προσοχή παρακάτω πριν το τρέξεις.** |
| H4 | ✅ Διορθώθηκε | Ρητό `ssl: 'require'` σε production, conditional ώστε να μη σπάει το τοπικό Docker Postgres. |
| H5 | ✅ Διορθώθηκε | `pnpm-workspace.yaml` override `brace-expansion: 5.0.8`. Επιβεβαιώθηκε καθαρό `pnpm audit`. |
| M1 | ✅ Διορθώθηκε | Origin check στο `help/chat.post.ts` απαιτεί πλέον match, όχι μόνο `if (origin)`. |
| M2 | ✅ Διορθώθηκε | Νέο rate-limit rule για `/api/ical-sources` (30/λεπτό). |
| M3 | ⏳ Δεν έγινε | Encryption-at-rest για OAuth tokens χρειάζεται απόφαση για KMS/infra — η εφαρμογή δεν χρησιμοποιεί καν OAuth αυτή τη στιγμή, άρα χαμηλή προτεραιότητα. Παραμένει backlog. |
| M4 | ✅ Διορθώθηκε | `properties.ama` έγινε global unique index (`properties_ama_idx`) + φιλικό 409 error αντί για raw DB exception. **Business-impact σημείωση παρακάτω.** |
| M5 | ✅ Διορθώθηκε | `statement_timeout`/`connect_timeout`/`idle_timeout` στο DB client + Set-based (αντί O(n²)) gap detection στο `verifySeriesIntegrity`. |
| M6 | ✅ Διορθώθηκε | 4 νέα test cases στο `safe-public-fetch.test.ts` για gzip-bomb/streaming/lying-Content-Length. |
| M7 | ✅ Διορθώθηκε | Cap 2000 VEVENTs ανά feed στο `ical/parser.ts`, με φιλικό μήνυμα στο `validate.ts`. |
| M8 | ✅ Διορθώθηκε | `console.warn` → `console.error` με structured fields στο `deliver-document.ts`/`send-reminder.ts`. |
| Low #1 | ✅ Διορθώθηκε | Rate-limit rule για `/api/documents` (60/λεπτό). |
| Low #2 | ✅ Διορθώθηκε | Βασικό format validation στο `phone`. |
| Low #6 | ✅ Διευκρινίστηκε | Comment στο `calculator.ts` — ΔΕΝ αφαιρέθηκε το πεδίο γιατί υπάρχει test που το ελέγχει ρητά. |
| Low #7 | ✅ Διορθώθηκε | Index στο `audit_log.created_at`. |
| Low #8 | ✅ Διορθώθηκε | Bracketed IPv6 literals ξεφλουδίζονται πριν το `ipaddr.js`. |
| Low #9 | ✅ Διορθώθηκε | Νέο global middleware `00.default-protect.global.ts` ως δίχτυ ασφαλείας. |
| Low #3, #4, #5, #10 | ⏳ Δεν έγιναν | Χρειάζονται χειροκίνητη ενέργεια/απόφαση εκτός κώδικα (δες σημειώσεις στα αρχικά items). |

**⚠️ Δύο σημεία που χρειάζονται προσοχή ΠΡΙΝ πας σε production:**

1. **Global ΑΜΑ uniqueness (M4):** αν υπάρχουν ήδη δύο ακίνητα με τον ίδιο ΑΜΑ σε διαφορετικούς λογαριασμούς στη βάση σου, το migration `0002` θα αποτύχει. Έλεγξε πρώτα με `SELECT ama, count(*) FROM properties GROUP BY ama HAVING count(*) > 1;` πριν το τρέξεις.
2. **Migration χωρίς `drizzle-kit generate` (H3):** το migration SQL γράφτηκε χειροκίνητα (τεχνικός περιορισμός — δεν ολοκληρώθηκε `pnpm install` στο sandbox για να τρέξει το `drizzle-kit generate`). Το `pnpm-lock.yaml` **είναι** σωστά ενημερωμένο (επιβεβαιώθηκε), αλλά το snapshot cache του drizzle-kit (`meta/0002_snapshot.json`) **δεν δημιουργήθηκε**. Μετά το `pnpm install` τοπικά, τρέξε `pnpm db:generate` μία φορά — αν προτείνει ξανά τις ίδιες αλλαγές, πες μου να το φτιάξω σωστά με πρόσβαση σε λειτουργικό `node_modules`.

Δεν κατάφερα να τρέξω `pnpm test`/`pnpm typecheck` σε αυτό το session — το `pnpm install` δεν ολοκληρώθηκε στο sandbox (πολύ αργό filesystem για τα 873 πακέτα, κάθε προσπάθεια «ξαναρχίζει» χωρίς να προχωρά). Έκανα προσεκτική χειροκίνητη επαλήθευση κάθε αρχείου που άλλαξε, αλλά συνιστώ `pnpm install && pnpm verify` τοπικά πριν το deploy.

---

## 🔴 High severity

### H1. Πιθανό path traversal στο R2 object key μέσω `documentSeries`
**Αρχείο:** `server/utils/storage.ts` (`endpoint()`, `takkDocumentKey()`), τροφοδοτείται από `server/api/properties/index.post.ts` και `[id].patch.ts` (`documentSeries: z.string().min(1).max(5)`).

Το πεδίο `documentSeries` δεν έχει περιορισμό χαρακτήρων, μόνο μήκος (1-5). Καταλήγει ανεπεξέργαστο μέσα στο R2 key template `takk/${userId}/${propertyId}/${year}/${series}-${n}.pdf`, το οποίο μετά περνάει σε `new URL()`/`fetch()`. Μια τιμή όπως `../..` (5 χαρακτήρες, περνάει το validation) μπορεί να «σπάσει» το intended path scoping ενός φακέλου επιπέδου (π.χ. να γράψει/διαβάσει εκτός του `{year}/` φακέλου). Το ρίσκο περιορίζεται γεωγραφικά (δεν μπορεί να ξεφύγει από `userId/propertyId` που είναι UUIDs), αλλά σπάει την υπόσχεση "εύκολο export ανά φάκελο ελέγχου" και ρισκάρει silent overwrite μεταξύ ετών/σειρών του ίδιου χρήστη.

**Fix:** αντικατάστησε το `z.string().min(1).max(5)` με whitelist regex, π.χ. `z.string().regex(/^[\p{L}\p{N}]{1,5}$/u)`, ή τουλάχιστον `encodeURIComponent()` σε κάθε path segment ξεχωριστά αντί για interpolation σε URL template string.

### H2. Χωρίς fail-fast έλεγχο για `INNGEST_SIGNING_KEY` σε production
**Αρχείο:** `server/inngest/client.ts`, `server/api/inngest.ts`

Το `/api/inngest` route είναι στα `PUBLIC_PREFIXES` (παρακάμπτει το auth middleware) και ενεργοποιεί πραγματικά side effects (έκδοση παραστατικών, emails). Σε αντίθεση με το `auth.ts` που κάνει throw στο boot αν λείπει κρίσιμο secret, το `inngest/client.ts` περνάει `signingKey: process.env.INNGEST_SIGNING_KEY` χωρίς έλεγχο — αν λείψει ποτέ σε production, η ασφάλεια εξαρτάται εξ ολοκλήρου από εσωτερική fallback συμπεριφορά του SDK.

**Fix:** πρόσθεσε το ίδιο pattern με το `auth.ts`: throw στο boot αν `NODE_ENV === 'production' && !process.env.INNGEST_SIGNING_KEY`. Ήδη το `00.production-config.ts` απαιτεί το var να υπάρχει — απλά λείπει η ρητή επιβεβαίωση μέσα στο ίδιο το inngest client.

### H3. Λείπει foreign key στο `takk_documents.cancels_document_id`
**Αρχείο:** `server/database/schema.ts:386`

Δεν έχει `.references()` και επιβεβαιώθηκε απούσα και από το migration SQL. Ένα ακυρωτικό (`takk_cancellation`) μπορεί θεωρητικά να δείξει σε μη υπαρκτό document αν υπάρξει bug στην εφαρμογή — δεν υπάρχει DB-level δίχτυ ασφαλείας.

**Fix:** πρόσθεσε self-referencing FK (`.references(() => takkDocuments.id, { onDelete: 'restrict' })`) σε νέο migration.

### H4. Χωρίς ρητή επιβολή SSL/TLS στο DB client
**Αρχείο:** `server/database/client.ts:24-29`

Το `postgres(url, { max, prepare: false })` δεν ορίζει `ssl` option — η κρυπτογράφηση εξαρτάται 100% από το να υπάρχει `sslmode` στο connection string. Αν αυτό ποτέ λείψει (typo, migration provider), ο driver διαπραγματεύεται σιωπηλά ό,τι δεχτεί ο server, ενδεχομένως χωρίς κρυπτογράφηση.

**Fix:** όρισε ρητά `ssl: 'require'` (ή `'verify-full'` με CA) στο `postgres()` options ώστε λάθος connection string να αποτυγχάνει δυνατά αντί να υποβαθμίζεται σιωπηλά.

### H5. `pnpm audit`: brace-expansion DoS (build-time dependency chain)
**Εύρημα από `pnpm audit`:** `nuxt > nitropack > archiver > readdir-glob > minimatch > brace-expansion` (≤5.0.7, patched σε 5.0.8+).

CVSS "high" κατά official advisory, αλλά **πρακτικό ρίσκο χαμηλό**: το `archiver` χρησιμοποιείται από το nitropack μόνο στο build/packaging step, όχι σε runtime path που επεξεργάζεται αιτήματα χρηστών. Παρόλα αυτά, αξίζει καθαρισμός.

**Fix:** `pnpm audit fix` ή override στο `pnpm-workspace.yaml`/`package.json` (`pnpm.overrides`) για `brace-expansion@>=5.0.8`.

---

## 🟠 Medium severity

| # | Αρχείο | Πρόβλημα | Fix |
|---|---|---|---|
| M1 | `server/api/help/chat.post.ts` | Origin check τρέχει μόνο `if (origin)` — non-browser clients (χωρίς Origin header) το προσπερνούν. Combined με μόνο IP-based rate limit (8/min, 40/day), botnet με rotating IPs μπορεί να παράγει σημαντικό Groq cost. | Πρόσθεσε global daily budget cap ανεξάρτητο από IP. |
| M2 | `server/api/ical-sources/index.post.ts` | Δεν καλύπτεται από κανένα `RATE_LIMIT_RULES` prefix (μόνο το `/validate` καλύπτεται). Authenticated user μπορεί να προκαλέσει απεριόριστα outbound fetches. | Πρόσθεσε rate-limit rule και για το POST `/api/ical-sources`. |
| M3 | `server/database/schema.ts` (`accounts` table) | `accessToken`/`refreshToken`/`idToken` αποθηκεύονται σε plain `text`. DB compromise = ζωντανά OAuth tokens τρίτων. | Envelope encryption (KMS-wrapped key) ή επιβεβαίωση ελάχιστου scope/σύντομης διάρκειας ζωής. |
| M4 | `server/database/schema.ts:208` | `properties_user_ama_idx` είναι unique **ανά χρήστη**, όχι global — δύο διαφορετικοί λογαριασμοί μπορούν να δηλώσουν το ίδιο πραγματικό ΑΜΑ (κρατικός αριθμός μητρώου). | Αξιολόγησε global unique index (χρειάζεται νομική επιβεβαίωση αν επιτρέπεται co-hosting). |
| M5 | `server/database/client.ts` | Χωρίς `statement_timeout`/`idle_timeout` στο pool. Ένα βαρύ query (π.χ. `verifySeriesIntegrity` που φορτώνει όλα τα documents μιας σειράς χωρίς `.limit()`) μπορεί να κρατήσει σύνδεση επ' αόριστον. | Όρισε `statement_timeout`, bound το admin query. |
| M6 | `server/utils/http/safe-public-fetch.ts` | `content-length` pre-check είναι μόνο fast-path — η πραγματική προστασία είναι το byte-counting loop στο decoded stream. Καλό, αλλά χρειάζεται explicit test για compressed oversized response ώστε να μη σπάσει σε refactor. | Πρόσθεσε test case: gzip-bomb response πρέπει να απορρίπτεται. |
| M7 | `server/utils/ical/parser.ts` / `sync-ical.ts` | Χωρίς ανώτατο όριο πλήθους VEVENTs ανά feed (μόνο το μέγεθος 5MB μπλοκάρεται). Χιλιάδες μικρά events χωράνε στο όριο και προκαλούν αργό sync + φόρτο DB. | Cap στα ~2000 VEVENTs ανά feed. |
| M8 | `server/inngest/functions/deliver-document.ts`, `send-reminder.ts` | Όταν λείπει R2/Resend config, γίνεται silent skip + `console.warn` — σε production αυτό σημαίνει "κανείς guest δεν παίρνει PDF" χωρίς alerting. | Alert/metric αντί για μόνο console log. |

---

## 🟡 Low severity (backlog)

1. **`server/api/documents/[id]/download.get.ts`** — χωρίς δικό του rate limit (χαμηλό ρίσκο, UUIDs δεν μαντεύονται).
2. **`server/api/me/index.patch.ts`** — το `phone` δεν έχει format validation πέρα από μήκος (ασυνέπεια με το αυστηρό `afm`).
3. **`server/api/inngest.ts`** — GET introspection endpoint αποκαλύπτει function/event map χωρίς signature σε registration handshake calls· επιβεβαίωσε ότι το production mode πράγματι απαιτεί valid signature και σε GET/PUT, όχι μόνο POST.
4. **`server/database/schema.ts`** — `users.afm` χωρίς unique constraint (ίδιο pattern με M4, χαμηλότερο ρίσκο).
5. **`server/database/schema.ts`** (`sessions.token`, `verifications.value`) — αποθηκεύονται plaintext (default Better Auth pattern, χαμηλό ρίσκο).
6. **`server/utils/takk/calculator.ts:183`** — `remittancePeriod` στο top-level object είναι vestigial/παραπλανητικό — δεν αντιστοιχεί σε πραγματικό document για stays πολλαπλών μηνών.
7. **`server/database/schema.ts`** (`audit_log`) — χωρίς index στο `created_at`, θα κάνει full-scan σε compliance queries καθώς μεγαλώνει.
8. **`server/utils/http/safe-public-fetch.ts`** — bracketed IPv6 literals (`[::1]`) αποτυγχάνουν σιωπηλά αντί να ταξινομούνται ρητά ως blocked (δεν είναι exploit, απλά σπάει αντί να μπλοκάρει σωστά).
9. **Frontend route guards** — η προστασία `app/pages/app/**` βασίζεται σε `definePageMeta({ middleware: 'auth' })` ανά σελίδα (opt-in). Σωστά backed από server-side check, αλλά μια νέα σελίδα χωρίς αυτή τη γραμμή θα ήταν silent regression.
10. **HSTS preload flag** — ενεργό στο `nuxt.config.ts`, αλλά χρειάζεται χειροκίνητο submission στο hstspreload.org για να έχει πραγματικό effect σε πρώτη επίσκεψη.

---

## ✅ Τι λειτουργεί καλά (informational)

- **SSRF guard (`safe-public-fetch.ts`)**: πλήρης έλεγχος — μπλοκάρει decimal/octal/hex IPv4 obfuscation, `169.254.169.254` (cloud metadata), όλα τα private/loopback/link-local/CGNAT ranges, IPv4-mapped IPv6, και σημαντικό: **αποτρέπει DNS-rebinding** πραγματικά (pin του validated IP στο socket connection, όχι απλός έλεγχος hostname string). Redirects ακολουθούνται χειροκίνητα με re-validation σε κάθε hop. Textbook υλοποίηση.
- **Αριθμοδότηση παραστατικών (`numbering.ts`)**: `SELECT ... FOR UPDATE` μέσα σε transaction σωστά σειριοποιεί concurrent allocations· backed από πραγματικά DB unique indexes (`takk_documents_unique_number_idx`, one-receipt-per-stay-month), άρα διπλός αριθμός είναι αδύνατος ακόμα κι αν το app-level lock παρακαμφθεί.
- **Καμία SQL injection**: κάθε `sql\`...\`` site ελέγχθηκε — όλα parameterized, καμία string concatenation user input.
- **better-auth 1.6.25 & Nuxt 4.5.1**: επιβεβαιωμένα **patched** έναντι των πρόσφατων CVEs (CVE-2026-53513 SSRF στο better-auth SSO plugin, CVE-2026-53516 OAuth account-takeover, CVE-2025-61928 unauthenticated API-key creation — όλα fixed σε 1.6.11 ή παλαιότερα· Nuxt CVE-2026-47200/46342/45670/45669 fixed σε 4.4.6). Η εφαρμογή δεν χρησιμοποιεί καν OAuth/SSO plugin, άρα το CVE-2026-53516 δεν εφαρμόζεται ούτως ή άλλως.
- **CSP/CSRF**: nonce-based script-src με `strict-dynamic`, `object-src none`, `frame-ancestors none`, SRI ενεργό. Origin-check middleware μπλοκάρει cross-site mutating requests συνεπώς σε όλα τα `/api/**` εκτός `/api/inngest`.
- **Καμία `v-html` χρήση** πουθενά στο `app/` — μηδενίζει το πιο συνηθισμένο Vue XSS vector.
- **PDF/email injection**: pdfmake παίρνει όλο το user content ως data objects (όχι markup interpolation)· τα email templates κάνουν explicit HTML-escaping σε guest/property/host names πριν την εισαγωγή.
- **Inngest idempotency**: όλες οι functions χρησιμοποιούν per-entity concurrency keys + explicit "already done" checks (`pdfStorageKey`, `alreadyCancelled`, `onConflictDoNothing`) — δεν βρέθηκε σενάριο διπλής έκδοσης/διπλού email.
- **Password policy**: 10-128 χαρακτήρες, απαιτεί κεφαλαίο/πεζό/αριθμό/σύμβολο· rate-limited sign-in/sign-up/password-reset (10/5/5 ανά λεπτό) μέσω custom middleware, ξεχωριστά από τα εσωτερικά Better Auth mechanisms.
- **Test coverage** στοχεύει ακριβώς τα σωστά σημεία: `safe-public-fetch.test.ts`, `rate-limit.test.ts`, `request-ip.test.ts`, `numbering.integration.test.ts`, `email-templates-security.test.ts`, `gate.test.ts` — δείχνει ότι η ομάδα ήδη ξέρει ποια είναι τα ευαίσθητα σημεία.

---

## Προτεινόμενη σειρά ενεργειών πριν το production launch

1. **H1** (path traversal στο `documentSeries`) — 15 λεπτά fix, whitelist regex.
2. **H2** (Inngest signing key fail-fast) — 10 λεπτά fix, ίδιο pattern με `auth.ts`.
3. **H4** (ρητό SSL στο DB client) — 5 λεπτά fix.
4. **H3** (FK στο `cancels_document_id`) — νέο migration, ~30 λεπτά.
5. **H5** (`pnpm audit fix` για brace-expansion) — 5 λεπτά, χαμηλό ρίσκο αλλά εύκολο.
6. **M1, M2** (rate-limit gaps σε help-chat origin check & ical-sources POST) — 20 λεπτά.
7. Τα Medium/Low μπορούν να μπουν στο backlog μετά το launch, με προτεραιότητα στο M8 (silent email/PDF delivery failures χωρίς alerting) πριν αποκτήσεις πραγματικούς πελάτες που βασίζονται σε αυτά τα emails.

Κανένα από τα παραπάνω δεν είναι blocking-critical — το codebase μπορεί να προχωρήσει σε production μετά τα H1-H5, τα οποία συνολικά είναι λιγότερο από 2 ώρες δουλειάς.
