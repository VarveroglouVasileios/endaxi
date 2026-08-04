-- Μόνο τα feedback tables. Οι υπόλοιπες αλλαγές που το drizzle-kit diff
-- συμπεριέλαβε (properties_ama_idx, audit_log_created_at_idx,
-- takk_documents cancels_document_id fk) είναι ΗΔΗ εφαρμοσμένες στη βάση
-- (0002_security_audit_fixes.sql, εφαρμόστηκε χειροκίνητα σε προηγούμενο
-- session) — το drizzle journal απλά δεν είχε ενημερωθεί. Αφαιρέθηκαν εδώ
-- για να μην ξαναπροσπαθήσει να τις εφαρμόσει (θα απέτυχαν ως ήδη υπαρκτές).
CREATE TYPE "public"."feedback_type" AS ENUM('positive', 'negative', 'idea');--> statement-breakpoint
CREATE TABLE "feedback_comments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"post_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "feedback_posts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" "feedback_type" DEFAULT 'idea' NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_post_id_feedback_posts_id_fk" FOREIGN KEY ("post_id") REFERENCES "public"."feedback_posts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_comments" ADD CONSTRAINT "feedback_comments_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedback_posts" ADD CONSTRAINT "feedback_posts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "feedback_comments_post_idx" ON "feedback_comments" USING btree ("post_id","created_at");--> statement-breakpoint
CREATE INDEX "feedback_posts_created_idx" ON "feedback_posts" USING btree ("created_at");
