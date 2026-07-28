import {
  pgTable,
  uuid,
  text,
  integer,
  boolean,
  timestamp,
  date,
  jsonb,
  pgEnum,
  uniqueIndex,
  index,
  bigint,
} from 'drizzle-orm/pg-core'
import { relations, sql } from 'drizzle-orm'

// ────────────────────────────────────────────────────────────
// ENUMS
// ────────────────────────────────────────────────────────────

/**
 * Κατηγορία καταλύματος για ΤΑΚΚ.
 * Καθορίζει το ποσό ανά διανυκτέρευση (βλ. server/utils/takk/rates.ts)
 */
export const propertyCategoryEnum = pgEnum('property_category', [
  'str_standard', // Ακίνητα βραχυχρόνιας μίσθωσης
  'str_villa', // Μονοκατοικίες >80τμ, βίλες, αυτοεξυπηρετούμενα
])

/** Πηγή από την οποία ήρθε η διαμονή */
export const staySourceEnum = pgEnum('stay_source', [
  'ical_airbnb',
  'ical_booking',
  'ical_vrbo',
  'ical_other',
  'manual',
  'email',
])

export const stayStatusEnum = pgEnum('stay_status', [
  'confirmed',
  'cancelled',
  'blocked', // ημερολογιακό block, όχι κράτηση — δεν παράγει ΤΑΚΚ
])

/**
 * Τύπος παραστατικού.
 * cancellation = αντιλογιστικό. ΠΟΤΕ δεν διαγράφουμε εκδοθέν παραστατικό.
 */
export const documentTypeEnum = pgEnum('document_type', [
  'takk_receipt',
  'takk_cancellation',
])

/** Φορολογικό καθεστώς χρήστη — καθορίζει τι επιτρέπεται */
export const taxRegimeEnum = pgEnum('tax_regime', [
  'individual_upto_2', // ≤2 ακίνητα: δεν τηρεί βιβλία, εκτός myDATA
  'business_3_plus', // 3+ ακίνητα ή νομικό πρόσωπο: επιτηδευματίας
])

// ────────────────────────────────────────────────────────────
// USERS
// ────────────────────────────────────────────────────────────

export const users = pgTable(
  'users',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    email: text('email').notNull(),

    // ── Πεδία που απαιτεί το Better Auth ──
    name: text('name'),
    emailVerified: boolean('email_verified').notNull().default(false),
    image: text('image'),

    /** @deprecated χρησιμοποίησε το `name` — μένει για συμβατότητα */
    fullName: text('full_name'),
    afm: text('afm'), // ΑΦΜ — απαραίτητο στο παραστατικό
    phone: text('phone'),
    locale: text('locale').notNull().default('el'),

    /**
     * ΚΡΙΣΙΜΟ GATE.
     * Δηλώνεται από τον χρήστη στην εγγραφή και επανελέγχεται.
     * Με 3+ ακίνητα ο χρήστης είναι επιτηδευματίας: βιβλία, ΦΠΑ 13%,
     * τέλος παρεπιδημούντων, υποχρέωση διαβίβασης myDATA.
     * Δεν τον εξυπηρετούμε μέχρι να υπάρξει integration με
     * πιστοποιημένο πάροχο ηλεκτρονικής τιμολόγησης.
     */
    declaredPropertyCount: integer('declared_property_count').notNull().default(1),
    taxRegime: taxRegimeEnum('tax_regime').notNull().default('individual_upto_2'),
    regimeDeclaredAt: timestamp('regime_declared_at', { withTimezone: true })
      .notNull()
      .defaultNow(),
    regimeDeclaredIp: text('regime_declared_ip'),

    /** Προσωπική διεύθυνση inbound email (π.χ. vasilis-x7k2@in.endaxi.app) */
    inboundEmailToken: text('inbound_email_token'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('users_email_idx').on(t.email),
    uniqueIndex('users_inbound_token_idx').on(t.inboundEmailToken),
  ],
)

// ────────────────────────────────────────────────────────────
// AUTH (Better Auth)
// ────────────────────────────────────────────────────────────

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    token: text('token').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('sessions_token_idx').on(t.token),
    index('sessions_user_idx').on(t.userId),
  ],
)

export const accounts = pgTable(
  'accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    accountId: text('account_id').notNull(),
    providerId: text('provider_id').notNull(),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at', { withTimezone: true }),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at', { withTimezone: true }),
    scope: text('scope'),
    idToken: text('id_token'),
    /** Μόνο για email/password — hashed, ποτέ plaintext */
    password: text('password'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('accounts_user_idx').on(t.userId),
    uniqueIndex('accounts_provider_idx').on(t.providerId, t.accountId),
  ],
)

export const verifications = pgTable(
  'verifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('verifications_identifier_idx').on(t.identifier)],
)

// ────────────────────────────────────────────────────────────
// PROPERTIES
// ────────────────────────────────────────────────────────────

export const properties = pgTable(
  'properties',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),

    /** Αριθμός Μητρώου Ακινήτου — το ένα πράγμα που έχει κάθε host */
    ama: text('ama').notNull(),
    name: text('name').notNull(),
    category: propertyCategoryEnum('category').notNull().default('str_standard'),

    addressLine: text('address_line'),
    city: text('city'),
    postalCode: text('postal_code'),
    /** Τετραγωνικά — >80τμ μονοκατοικία αλλάζει κατηγορία ΤΑΚΚ */
    areaSqm: integer('area_sqm'),

    /** Σειρά παραστατικών για αυτό το ακίνητο (π.χ. "Α") */
    documentSeries: text('document_series').notNull().default('Α'),

    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('properties_user_idx').on(t.userId),
    uniqueIndex('properties_user_ama_idx').on(t.userId, t.ama),
  ],
)

// ────────────────────────────────────────────────────────────
// iCAL SOURCES
// ────────────────────────────────────────────────────────────

export const icalSources = pgTable(
  'ical_sources',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    url: text('url').notNull(),
    source: staySourceEnum('source').notNull(),
    label: text('label'),

    isActive: boolean('is_active').notNull().default(true),
    lastSyncedAt: timestamp('last_synced_at', { withTimezone: true }),
    lastSyncStatus: text('last_sync_status'),
    lastSyncError: text('last_sync_error'),
    consecutiveFailures: integer('consecutive_failures').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index('ical_sources_property_idx').on(t.propertyId)],
)

// ────────────────────────────────────────────────────────────
// STAYS (διαμονές)
// ────────────────────────────────────────────────────────────

export const stays = pgTable(
  'stays',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'cascade' }),

    /** UID από το iCal — για idempotent sync */
    externalUid: text('external_uid'),
    source: staySourceEnum('source').notNull(),
    icalSourceId: uuid('ical_source_id').references(() => icalSources.id, {
      onDelete: 'set null',
    }),

    checkIn: date('check_in').notNull(),
    checkOut: date('check_out').notNull(),
    /** Υπολογίζεται: checkOut - checkIn. Αποθηκεύεται για audit. */
    nights: integer('nights').notNull(),

    guestName: text('guest_name'),
    guestCount: integer('guest_count'),

    status: stayStatusEnum('status').notNull().default('confirmed'),

    /**
     * ΔΩΡΕΑΝ ΔΙΑΜΟΝΗ — δεν επιβαρύνεται με ΤΑΚΚ.
     *
     * ΑΑΔΕ, FAQ ΤΑΚΚ (Ιαν 2026): «Οι δωρεάν διαμονές δεν επιβαρύνονται
     * με το τέλος ανθεκτικότητας στην κλιματική κρίση.»
     *
     * ⚠️ Το iCal ΔΕΝ μας λέει την τιμή, οπότε δεν μπορούμε να το
     * ανιχνεύσουμε αυτόματα. Ο host το σημαδεύει χειροκίνητα ΠΡΙΝ την
     * έκδοση — μετά είναι αργά, γιατί το παραστατικό είναι append-only
     * και θέλει αντιλογιστικό.
     */
    isComplimentary: boolean('is_complimentary').notNull().default(false),
    complimentaryNote: text('complimentary_note'),

    /**
     * Ποσά — ΔΕΝ χρειάζονται για ΤΑΚΚ (σταθερό ανά διανυκτέρευση).
     * Γεμίζουν από inbound email, για το reconciliation module.
     */
    grossAmountCents: bigint('gross_amount_cents', { mode: 'number' }),
    platformFeeCents: bigint('platform_fee_cents', { mode: 'number' }),
    payoutAmountCents: bigint('payout_amount_cents', { mode: 'number' }),
    currency: text('currency').default('EUR'),

    rawPayload: jsonb('raw_payload'),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('stays_property_idx').on(t.propertyId),
    index('stays_checkout_idx').on(t.checkOut),
    // Idempotency: ένα externalUid ανά ακίνητο
    uniqueIndex('stays_property_uid_idx').on(t.propertyId, t.externalUid),
  ],
)

// ────────────────────────────────────────────────────────────
// ΤΑΚΚ SERIES — ο counter. Το πιο κρίσιμο κομμάτι.
// ────────────────────────────────────────────────────────────

/**
 * Ένας counter ανά (ακίνητο, σειρά, έτος).
 * Η αύξηση γίνεται ΠΑΝΤΑ μέσα σε transaction με SELECT ... FOR UPDATE.
 * Ο νόμος απαιτεί συνεχόμενη αρίθμηση χωρίς κενά.
 */
export const takkSeries = pgTable(
  'takk_series',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),

    series: text('series').notNull(),
    year: integer('year').notNull(),
    lastNumber: integer('last_number').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex('takk_series_unique_idx').on(t.propertyId, t.series, t.year),
  ],
)

// ────────────────────────────────────────────────────────────
// ΤΑΚΚ DOCUMENTS — append-only. ΠΟΤΕ UPDATE.
// ────────────────────────────────────────────────────────────

export const takkDocuments = pgTable(
  'takk_documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    propertyId: uuid('property_id')
      .notNull()
      .references(() => properties.id, { onDelete: 'restrict' }),
    stayId: uuid('stay_id').references(() => stays.id, { onDelete: 'restrict' }),

    documentType: documentTypeEnum('document_type').notNull().default('takk_receipt'),

    // ── Ταυτότητα παραστατικού (νομική απαίτηση) ──
    series: text('series').notNull(),
    number: integer('number').notNull(),
    year: integer('year').notNull(),
    issuedAt: timestamp('issued_at', { withTimezone: true }).notNull().defaultNow(),

    // ── Snapshot δεδομένων τη στιγμή της έκδοσης ──
    // Αποθηκεύονται αντιγραμμένα ώστε το παραστατικό να μένει
    // αναλλοίωτο ακόμα κι αν αλλάξει το ακίνητο ή η διαμονή.
    propertyAma: text('property_ama').notNull(),
    propertyName: text('property_name').notNull(),
    issuerName: text('issuer_name'),
    issuerAfm: text('issuer_afm'),

    checkIn: date('check_in').notNull(),
    checkOut: date('check_out').notNull(),
    nights: integer('nights').notNull(),
    guestName: text('guest_name'),

    ratePerNightCents: integer('rate_per_night_cents').notNull(),
    totalAmountCents: integer('total_amount_cents').notNull(),

    /**
     * Μήνας απόδοσης (YYYY-MM).
     * Καθορίζεται από την ΗΜΕΡΟΜΗΝΙΑ ΑΝΑΧΩΡΗΣΗΣ (check-out),
     * όχι από την άφιξη. Λύνει το «check-out την 1η του μήνα».
     */
    remittancePeriod: text('remittance_period').notNull(),

    /** Αν πρόκειται για αντιλογιστικό, δείχνει στο ακυρούμενο */
    cancelsDocumentId: uuid('cancels_document_id'),
    cancellationReason: text('cancellation_reason'),

    pdfStorageKey: text('pdf_storage_key'),
    sentToGuestAt: timestamp('sent_to_guest_at', { withTimezone: true }),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    // Καμία διπλή αρίθμηση, ποτέ
    uniqueIndex('takk_documents_unique_number_idx').on(
      t.propertyId,
      t.series,
      t.year,
      t.number,
    ),
    /**
     * ΚΡΙΣΙΜΟ: ένα ΕΝΕΡΓΟ παραστατικό ανά διαμονή **ΚΑΙ ΜΗΝΑ**.
     *
     * Γιατί (stayId, remittancePeriod) και όχι μόνο stayId:
     * η ΑΑΔΕ απαιτεί ξεχωριστό παραστατικό για κάθε ημερολογιακό μήνα
     * που καλύπτει η διαμονή (FAQ ΤΑΚΚ Ιαν 2026, ερ. 7). Μια διαμονή
     * 30/10 → 02/11 παράγει ΔΥΟ παραστατικά.
     *
     * Ο έλεγχος «υπάρχει ήδη;» στον κώδικα ΔΕΝ αρκεί: υπό ταυτόχρονα
     * transactions όλα διαβάζουν «δεν υπάρχει» πριν κάνει commit το
     * πρώτο. Μόνο η βάση μπορεί να το εγγυηθεί.
     */
    uniqueIndex('takk_documents_one_receipt_per_stay_month_idx')
      .on(t.stayId, t.remittancePeriod)
      .where(sql`document_type = 'takk_receipt'`),
    index('takk_documents_period_idx').on(t.propertyId, t.remittancePeriod),
  ],
)

// ────────────────────────────────────────────────────────────
// AUDIT LOG — ποιος, πότε, τι, από πού
// ────────────────────────────────────────────────────────────

export const auditLog = pgTable(
  'audit_log',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
    action: text('action').notNull(),
    entityType: text('entity_type').notNull(),
    entityId: uuid('entity_id'),
    metadata: jsonb('metadata'),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index('audit_log_user_idx').on(t.userId),
    index('audit_log_entity_idx').on(t.entityType, t.entityId),
  ],
)

// ────────────────────────────────────────────────────────────
// RELATIONS
// ────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  properties: many(properties),
}))

export const propertiesRelations = relations(properties, ({ one, many }) => ({
  user: one(users, { fields: [properties.userId], references: [users.id] }),
  icalSources: many(icalSources),
  stays: many(stays),
  takkDocuments: many(takkDocuments),
}))

export const icalSourcesRelations = relations(icalSources, ({ one, many }) => ({
  property: one(properties, {
    fields: [icalSources.propertyId],
    references: [properties.id],
  }),
  stays: many(stays),
}))

export const staysRelations = relations(stays, ({ one, many }) => ({
  property: one(properties, {
    fields: [stays.propertyId],
    references: [properties.id],
  }),
  icalSource: one(icalSources, {
    fields: [stays.icalSourceId],
    references: [icalSources.id],
  }),
  takkDocuments: many(takkDocuments),
}))

export const takkDocumentsRelations = relations(takkDocuments, ({ one }) => ({
  property: one(properties, {
    fields: [takkDocuments.propertyId],
    references: [properties.id],
  }),
  stay: one(stays, { fields: [takkDocuments.stayId], references: [stays.id] }),
}))

// ────────────────────────────────────────────────────────────
// TYPES
// ────────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect
export type NewUser = typeof users.$inferInsert
export type Property = typeof properties.$inferSelect
export type NewProperty = typeof properties.$inferInsert
export type IcalSource = typeof icalSources.$inferSelect
export type Stay = typeof stays.$inferSelect
export type NewStay = typeof stays.$inferInsert
export type TakkDocument = typeof takkDocuments.$inferSelect
export type PropertyCategory = (typeof propertyCategoryEnum.enumValues)[number]
export type StaySource = (typeof staySourceEnum.enumValues)[number]
