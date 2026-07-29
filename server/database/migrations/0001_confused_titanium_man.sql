ALTER TABLE "takk_documents" ADD COLUMN "issuer_address_line" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "issuer_address_city" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "issuer_address_postal_code" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "property_address_line" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "property_city" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "property_postal_code" text;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "property_category_snapshot" "property_category";--> statement-breakpoint
ALTER TABLE "takk_documents" ADD COLUMN "rate_breakdown" jsonb;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "legal_address_line" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "legal_address_city" text;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "legal_address_postal_code" text;--> statement-breakpoint
CREATE UNIQUE INDEX "takk_documents_one_cancellation_per_document_idx" ON "takk_documents" USING btree ("cancels_document_id") WHERE cancels_document_id is not null;