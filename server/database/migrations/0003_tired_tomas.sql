CREATE TYPE "public"."inbound_email_status" AS ENUM('matched', 'unmatched_stay', 'unrecognized_format', 'unknown_recipient');--> statement-breakpoint
CREATE TYPE "public"."stay_amount_source" AS ENUM('manual', 'email_auto');--> statement-breakpoint
CREATE TABLE "inbound_emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"to_address" text NOT NULL,
	"from_address" text,
	"subject" text,
	"status" "inbound_email_status" NOT NULL,
	"parsed_amount_cents" bigint,
	"parsed_check_in" date,
	"parsed_check_out" date,
	"matched_stay_id" uuid,
	"text_excerpt" text,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "stays" ADD COLUMN "amount_source" "stay_amount_source" DEFAULT 'manual' NOT NULL;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbound_emails" ADD CONSTRAINT "inbound_emails_matched_stay_id_stays_id_fk" FOREIGN KEY ("matched_stay_id") REFERENCES "public"."stays"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inbound_emails_user_idx" ON "inbound_emails" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "inbound_emails_status_idx" ON "inbound_emails" USING btree ("status");