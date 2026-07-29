-- Security audit fixes (βλ. SECURITY-AUDIT-REPORT.md)
--
-- ⚠️ ΠΡΟΣΟΧΗ ΠΡΙΝ ΤΡΕΞΕΙ ΣΕ PRODUCTION: το CREATE UNIQUE INDEX στο "ama"
-- (global, όχι πια ανά χρήστη) θα ΑΠΟΤΥΧΕΙ αν υπάρχουν ήδη δύο ακίνητα
-- με τον ίδιο ΑΜΑ σε διαφορετικούς λογαριασμούς. Έλεγξε πρώτα με:
--   SELECT ama, count(*) FROM properties GROUP BY ama HAVING count(*) > 1;
-- Αν υπάρχουν διπλότυπα, λύσε τα χειροκίνητα πριν εφαρμόσεις τη migration.

DROP INDEX "properties_user_ama_idx";--> statement-breakpoint
CREATE UNIQUE INDEX "properties_ama_idx" ON "properties" USING btree ("ama");--> statement-breakpoint
ALTER TABLE "takk_documents" ADD CONSTRAINT "takk_documents_cancels_document_id_takk_documents_id_fk" FOREIGN KEY ("cancels_document_id") REFERENCES "public"."takk_documents"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_created_at_idx" ON "audit_log" USING btree ("created_at");
