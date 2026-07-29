/**
 * Βοηθητικά για integration tests σε ΠΡΑΓΜΑΤΙΚΗ Postgres.
 *
 * Τα pure-function tests δεν αρκούν για την αρίθμηση: το
 * `SELECT ... FOR UPDATE` έχει νόημα μόνο με αληθινό transaction
 * isolation. Γι' αυτό εδώ σηκώνουμε πραγματική βάση.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { sql } from 'drizzle-orm'
import * as schema from '../../server/database/schema'

export type TestDb = ReturnType<typeof drizzle<typeof schema>>

export function connectionString(): string {
  const connectionString = (
    process.env.TEST_DATABASE_URL ??
    'postgresql://endaxi:endaxi@127.0.0.1:54330/endaxi_test'
  )
  const url = new URL(connectionString)

  if (
    process.env.DATABASE_URL
    && new URL(process.env.DATABASE_URL).toString() === url.toString()
  ) {
    throw new Error('Refusing destructive tests: TEST_DATABASE_URL matches DATABASE_URL')
  }

  if (!url.pathname.toLowerCase().endsWith('_test')) {
    throw new Error('Refusing destructive tests: database name must end with "_test"')
  }

  const isLocal = url.hostname === '127.0.0.1' || url.hostname === 'localhost'
  if (!isLocal && process.env.ALLOW_REMOTE_TEST_DATABASE !== '1') {
    throw new Error(
      'Refusing destructive tests on a remote host without ALLOW_REMOTE_TEST_DATABASE=1',
    )
  }

  return connectionString
}

export function createTestDb(): { db: TestDb; close: () => Promise<void> } {
  // ΣΗΜΑΝΤΙΚΟ: max > 1. Με μία μόνο σύνδεση, τα «ταυτόχρονα» αιτήματα
  // σειριοποιούνται από το pool και το concurrency test γίνεται ψεύτικο.
  const client = postgres(connectionString(), { max: 20, prepare: false })
  const db = drizzle(client, { schema })
  return { db, close: () => client.end({ timeout: 5 }) }
}

/**
 * Δημιουργεί το schema. Χρησιμοποιούμε raw SQL αντί για drizzle-kit
 * ώστε τα tests να μην εξαρτώνται από migration files.
 */
export async function createSchema(db: TestDb): Promise<void> {
  await db.execute(sql`
    DROP TABLE IF EXISTS audit_log, takk_documents, takk_series, stays,
      ical_sources, properties, sessions, accounts, verifications, users CASCADE;
    DROP TYPE IF EXISTS property_category, stay_source, stay_status,
      document_type, tax_regime CASCADE;

    CREATE TYPE property_category AS ENUM ('str_standard', 'str_villa');
    CREATE TYPE stay_source AS ENUM ('ical_airbnb','ical_booking','ical_vrbo','ical_other','manual','email');
    CREATE TYPE stay_status AS ENUM ('confirmed','cancelled','blocked');
    CREATE TYPE document_type AS ENUM ('takk_receipt','takk_cancellation');
    CREATE TYPE tax_regime AS ENUM ('individual_upto_2','business_3_plus');

    CREATE TABLE users (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      email text NOT NULL,
      name text,
      email_verified boolean NOT NULL DEFAULT false,
      image text,
      full_name text,
      afm text,
      phone text,
      locale text NOT NULL DEFAULT 'el',
      legal_address_line text,
      legal_address_city text,
      legal_address_postal_code text,
      declared_property_count integer NOT NULL DEFAULT 1,
      tax_regime tax_regime NOT NULL DEFAULT 'individual_upto_2',
      regime_declared_at timestamptz NOT NULL DEFAULT now(),
      regime_declared_ip text,
      inbound_email_token text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX users_email_idx ON users (email);

    -- ── Auth (Better Auth) ──
    CREATE TABLE sessions (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token text NOT NULL,
      expires_at timestamptz NOT NULL,
      ip_address text, user_agent text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX sessions_token_idx ON sessions (token);

    CREATE TABLE accounts (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      account_id text NOT NULL,
      provider_id text NOT NULL,
      access_token text, refresh_token text,
      access_token_expires_at timestamptz, refresh_token_expires_at timestamptz,
      scope text, id_token text, password text,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX accounts_provider_idx ON accounts (provider_id, account_id);

    CREATE TABLE verifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      identifier text NOT NULL,
      value text NOT NULL,
      expires_at timestamptz NOT NULL,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE properties (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ama text NOT NULL,
      name text NOT NULL,
      category property_category NOT NULL DEFAULT 'str_standard',
      address_line text, city text, postal_code text, area_sqm integer,
      document_series text NOT NULL DEFAULT 'Α',
      is_active boolean NOT NULL DEFAULT true,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX properties_ama_idx ON properties (ama);

    CREATE TABLE ical_sources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      url text NOT NULL,
      source stay_source NOT NULL,
      label text,
      is_active boolean NOT NULL DEFAULT true,
      last_synced_at timestamptz,
      last_sync_status text,
      last_sync_error text,
      consecutive_failures integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now()
    );

    CREATE TABLE stays (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
      external_uid text,
      source stay_source NOT NULL,
      ical_source_id uuid REFERENCES ical_sources(id) ON DELETE SET NULL,
      check_in date NOT NULL,
      check_out date NOT NULL,
      nights integer NOT NULL,
      guest_name text,
      guest_count integer,
      status stay_status NOT NULL DEFAULT 'confirmed',
      is_complimentary boolean NOT NULL DEFAULT false,
      complimentary_note text,
      gross_amount_cents bigint,
      platform_fee_cents bigint,
      payout_amount_cents bigint,
      currency text DEFAULT 'EUR',
      raw_payload jsonb,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX stays_property_uid_idx ON stays (property_id, external_uid);

    CREATE TABLE takk_series (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
      series text NOT NULL,
      year integer NOT NULL,
      last_number integer NOT NULL DEFAULT 0,
      created_at timestamptz NOT NULL DEFAULT now(),
      updated_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX takk_series_unique_idx ON takk_series (property_id, series, year);

    CREATE TABLE takk_documents (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      property_id uuid NOT NULL REFERENCES properties(id) ON DELETE RESTRICT,
      stay_id uuid REFERENCES stays(id) ON DELETE RESTRICT,
      document_type document_type NOT NULL DEFAULT 'takk_receipt',
      series text NOT NULL,
      number integer NOT NULL,
      year integer NOT NULL,
      issued_at timestamptz NOT NULL DEFAULT now(),
      property_ama text NOT NULL,
      property_name text NOT NULL,
      issuer_name text,
      issuer_afm text,
      issuer_address_line text,
      issuer_address_city text,
      issuer_address_postal_code text,
      property_address_line text,
      property_city text,
      property_postal_code text,
      property_category_snapshot property_category,
      rate_breakdown jsonb,
      check_in date NOT NULL,
      check_out date NOT NULL,
      nights integer NOT NULL,
      guest_name text,
      rate_per_night_cents integer NOT NULL,
      total_amount_cents integer NOT NULL,
      remittance_period text NOT NULL,
      cancels_document_id uuid REFERENCES takk_documents(id) ON DELETE RESTRICT,
      cancellation_reason text,
      pdf_storage_key text,
      sent_to_guest_at timestamptz,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE UNIQUE INDEX takk_documents_unique_number_idx
      ON takk_documents (property_id, series, year, number);
    -- Ένα ενεργό παραστατικό ανά διαμονή ΚΑΙ ΜΗΝΑ.
    -- Διαμονή που διασχίζει μήνες παράγει ξεχωριστό παραστατικό ανά μήνα
    -- (ΑΑΔΕ FAQ ΤΑΚΚ, ερ. 7). Η μόνη πραγματική εγγύηση υπό concurrency.
    CREATE UNIQUE INDEX takk_documents_one_receipt_per_stay_month_idx
      ON takk_documents (stay_id, remittance_period)
      WHERE document_type = 'takk_receipt';
    CREATE UNIQUE INDEX takk_documents_one_cancellation_per_document_idx
      ON takk_documents (cancels_document_id)
      WHERE cancels_document_id IS NOT NULL;

    CREATE TABLE audit_log (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid REFERENCES users(id) ON DELETE SET NULL,
      action text NOT NULL,
      entity_type text NOT NULL,
      entity_id uuid,
      metadata jsonb,
      ip_address text,
      user_agent text,
      created_at timestamptz NOT NULL DEFAULT now()
    );
    CREATE INDEX audit_log_created_at_idx ON audit_log (created_at);
  `)
}

export async function truncateAll(db: TestDb): Promise<void> {
  await db.execute(sql`
    TRUNCATE audit_log, takk_documents, takk_series, stays,
      ical_sources, properties, sessions, accounts, verifications, users
      RESTART IDENTITY CASCADE;
  `)
}

// ── Fixtures ────────────────────────────────────────────────

/** Συνθετικό ΑΦΜ που περνά τον αλγόριθμο ελέγχου. */
export const VALID_TEST_AFM = (() => {
  const first8 = '12345678'
  let sum = 0
  for (let i = 0; i < 8; i++) sum += Number(first8[i]) * 2 ** (8 - i)
  return first8 + String((sum % 11) % 10)
})()

export async function seedUser(
  db: TestDb,
  overrides: Partial<typeof schema.users.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.users)
    .values({
      email: `host-${crypto.randomUUID()}@example.gr`,
      name: 'Βασίλης Βαρβέρογλου',
      fullName: 'Βασίλης Βαρβέρογλου',
      // Έγκυρο κατά τον αλγόριθμο ελέγχου — δεν είναι υπαρκτό ΑΦΜ
      afm: VALID_TEST_AFM,
      legalAddressLine: 'Οδός Δοκιμής 1',
      legalAddressCity: 'Αθήνα',
      legalAddressPostalCode: '11742',
      taxRegime: 'individual_upto_2',
      declaredPropertyCount: 1,
      ...overrides,
    })
    .returning()
  return row!
}

export async function seedProperty(
  db: TestDb,
  userId: string,
  overrides: Partial<typeof schema.properties.$inferInsert> = {},
) {
  const [row] = await db
    .insert(schema.properties)
    .values({
      userId,
      ama: `AMA-${crypto.randomUUID().slice(0, 8)}`,
      name: 'Διαμέρισμα Κουκάκι',
      category: 'str_standard',
      documentSeries: 'Α',
      addressLine: 'Δράκου 12',
      city: 'Αθήνα',
      postalCode: '11742',
      ...overrides,
    })
    .returning()
  return row!
}

export async function seedStay(
  db: TestDb,
  propertyId: string,
  overrides: Partial<typeof schema.stays.$inferInsert> = {},
) {
  const checkIn = overrides.checkIn ?? '2026-07-10'
  const checkOut = overrides.checkOut ?? '2026-07-13'
  const [row] = await db
    .insert(schema.stays)
    .values({
      propertyId,
      source: 'ical_airbnb',
      externalUid: crypto.randomUUID(),
      checkIn,
      checkOut,
      nights: 3,
      guestName: 'Ελένη Παπαδοπούλου',
      status: 'confirmed',
      ...overrides,
    })
    .returning()
  return row!
}
