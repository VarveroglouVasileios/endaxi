# Migrations

## Γιατί δεν υπάρχουν migration files στο repo ακόμα

Σκέφτηκα να τα γράψω με το χέρι, αλλά είναι **λάθος**: το `drizzle-kit`
κρατά snapshot (`meta/0000_snapshot.json`) για να ξέρει την τρέχουσα
κατάσταση. Ένα χειρόγραφο `.sql` χωρίς το αντίστοιχο snapshot σπάει την
αλυσίδα — το επόμενο `generate` θα προσπαθήσει να ξαναφτιάξει τα πάντα.

Άρα το baseline παράγεται **μία φορά, τοπικά**:

```bash
pnpm db:generate          # δημιουργεί 0000_*.sql + meta/
git add server/database/migrations
git commit -m "baseline schema"
```

Από εκεί και πέρα, κάθε αλλαγή στο `schema.ts` → `pnpm db:generate` →
review του SQL → commit.

**Μην χρησιμοποιήσεις ποτέ `db:push` σε παραγωγή.** Το `push` συγκρίνει
και εφαρμόζει χωρίς αρχείο, χωρίς ιστορικό, χωρίς review. Είναι εντάξει
για γρήγορο τοπικό πείραμα και τίποτα άλλο.

---

## Ο κανόνας που ισχύει μόνο εδώ

Ο `takk_documents` είναι **append-only πίνακας νομικών παραστατικών με
υποχρεωτικά συνεχόμενη αρίθμηση**. Ένα χαλασμένο migration δεν σημαίνει
«χάσαμε δεδομένα» — σημαίνει «οι πελάτες μας πήραν πρόστιμο».

Πριν από κάθε migration που αγγίζει `takk_documents` ή `takk_series`:

```bash
# 1. Branch της παραγωγής (γι' αυτό επιλέξαμε Neon)
#    Neon dashboard → Branches → New branch from production

# 2. Εφαρμογή στο branch
DATABASE_URL="<branch-url>" pnpm db:migrate

# 3. Έλεγχος ακεραιότητας — ΤΟ ΚΡΙΣΙΜΟ ΒΗΜΑ
DATABASE_URL="<branch-url>" pnpm db:verify

# 4. Μόνο αν βγει καθαρό → παραγωγή
DATABASE_URL="<prod-url>" pnpm db:migrate
```

---

## Απαγορευμένες αλλαγές

Σε αυτούς τους πίνακες:

| Ποτέ | Γιατί |
|---|---|
| `DROP COLUMN` σε `takk_documents` | Τα snapshot δεδομένα είναι η απόδειξη του παραστατικού |
| Αλλαγή τύπου σε `number`, `series`, `year` | Σπάει η ταυτότητα του παραστατικού |
| `DELETE` / `TRUNCATE` | Ακύρωση γίνεται με αντιλογιστικό, ποτέ με διαγραφή |
| Αφαίρεση του `takk_documents_one_receipt_per_stay_month_idx` | Είναι η μόνη εγγύηση κατά διπλών παραστατικών υπό concurrency |
| Αφαίρεση του `takk_documents_unique_number_idx` | Είναι η μόνη εγγύηση κατά διπλής αρίθμησης |

Αν χρειαστεί νέο πεδίο: **πρόσθεσε nullable column**. Μη μετακινήσεις,
μη μετονομάσεις, μη σβήσεις.
