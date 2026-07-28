CREATE TYPE "public"."document_type" AS ENUM('takk_receipt', 'takk_cancellation');--> statement-breakpoint
CREATE TYPE "public"."property_category" AS ENUM('str_standard', 'str_villa');--> statement-breakpoint
CREATE TYPE "public"."stay_source" AS ENUM('ical_airbnb', 'ical_booking', 'ical_vrbo', 'ical_other', 'manual', 'email');--> statement-breakpoint
CREATE TYPE "public"."stay_status" AS ENUM('confirmed', 'cancelled', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."tax_regime" AS ENUM('individual_upto_2', 'business_3_plus');--> statement-breakpoint
CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"access_token_expires_at" timestamp with time zone,
	"refresh_token_expires_at" timestamp with time zone,
	"scope" text,
	"id_token" text,
	"password" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" uuid,
	"metadata" jsonb,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ical_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"url" text NOT NULL,
	"source" "stay_source" NOT NULL,
	"label" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_synced_at" timestamp with time zone,
	"last_sync_status" text,
	"last_sync_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "properties" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"ama" text NOT NULL,
	"name" text NOT NULL,
	"category" "property_category" DEFAULT 'str_standard' NOT NULL,
	"address_line" text,
	"city" text,
	"postal_code" text,
	"area_sqm" integer,
	"document_series" text DEFAULT 'Α' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"external_uid" text,
	"source" "stay_source" NOT NULL,
	"ical_source_id" uuid,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"nights" integer NOT NULL,
	"guest_name" text,
	"guest_count" integer,
	"status" "stay_status" DEFAULT 'confirmed' NOT NULL,
	"is_complimentary" boolean DEFAULT false NOT NULL,
	"complimentary_note" text,
	"gross_amount_cents" bigint,
	"platform_fee_cents" bigint,
	"payout_amount_cents" bigint,
	"currency" text DEFAULT 'EUR',
	"raw_payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takk_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"stay_id" uuid,
	"document_type" "document_type" DEFAULT 'takk_receipt' NOT NULL,
	"series" text NOT NULL,
	"number" integer NOT NULL,
	"year" integer NOT NULL,
	"issued_at" timestamp with time zone DEFAULT now() NOT NULL,
	"property_ama" text NOT NULL,
	"property_name" text NOT NULL,
	"issuer_name" text,
	"issuer_afm" text,
	"check_in" date NOT NULL,
	"check_out" date NOT NULL,
	"nights" integer NOT NULL,
	"guest_name" text,
	"rate_per_night_cents" integer NOT NULL,
	"total_amount_cents" integer NOT NULL,
	"remittance_period" text NOT NULL,
	"cancels_document_id" uuid,
	"cancellation_reason" text,
	"pdf_storage_key" text,
	"sent_to_guest_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "takk_series" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"property_id" uuid NOT NULL,
	"series" text NOT NULL,
	"year" integer NOT NULL,
	"last_number" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"full_name" text,
	"afm" text,
	"phone" text,
	"locale" text DEFAULT 'el' NOT NULL,
	"declared_property_count" integer DEFAULT 1 NOT NULL,
	"tax_regime" "tax_regime" DEFAULT 'individual_upto_2' NOT NULL,
	"regime_declared_at" timestamp with time zone DEFAULT now() NOT NULL,
	"regime_declared_ip" text,
	"inbound_email_token" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "verifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ical_sources" ADD CONSTRAINT "ical_sources_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "properties" ADD CONSTRAINT "properties_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stays" ADD CONSTRAINT "stays_ical_source_id_ical_sources_id_fk" FOREIGN KEY ("ical_source_id") REFERENCES "public"."ical_sources"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD CONSTRAINT "takk_documents_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takk_documents" ADD CONSTRAINT "takk_documents_stay_id_stays_id_fk" FOREIGN KEY ("stay_id") REFERENCES "public"."stays"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "takk_series" ADD CONSTRAINT "takk_series_property_id_properties_id_fk" FOREIGN KEY ("property_id") REFERENCES "public"."properties"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_user_idx" ON "accounts" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "accounts_provider_idx" ON "accounts" USING btree ("provider_id","account_id");--> statement-breakpoint
CREATE INDEX "audit_log_user_idx" ON "audit_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_log_entity_idx" ON "audit_log" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "ical_sources_property_idx" ON "ical_sources" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "properties_user_idx" ON "properties" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "properties_user_ama_idx" ON "properties" USING btree ("user_id","ama");--> statement-breakpoint
CREATE UNIQUE INDEX "sessions_token_idx" ON "sessions" USING btree ("token");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "stays_property_idx" ON "stays" USING btree ("property_id");--> statement-breakpoint
CREATE INDEX "stays_checkout_idx" ON "stays" USING btree ("check_out");--> statement-breakpoint
CREATE UNIQUE INDEX "stays_property_uid_idx" ON "stays" USING btree ("property_id","external_uid");--> statement-breakpoint
CREATE UNIQUE INDEX "takk_documents_unique_number_idx" ON "takk_documents" USING btree ("property_id","series","year","number");--> statement-breakpoint
CREATE UNIQUE INDEX "takk_documents_one_receipt_per_stay_month_idx" ON "takk_documents" USING btree ("stay_id","remittance_period") WHERE document_type = 'takk_receipt';--> statement-breakpoint
CREATE INDEX "takk_documents_period_idx" ON "takk_documents" USING btree ("property_id","remittance_period");--> statement-breakpoint
CREATE UNIQUE INDEX "takk_series_unique_idx" ON "takk_series" USING btree ("property_id","series","year");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "users_inbound_token_idx" ON "users" USING btree ("inbound_email_token");--> statement-breakpoint
CREATE INDEX "verifications_identifier_idx" ON "verifications" USING btree ("identifier");