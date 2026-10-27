import { sql } from "drizzle-orm";
import { index, integer, jsonb, pgTable, serial, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/pg-core";

// Session storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);

// User storage table.
// (IMPORTANT) This table is mandatory for Replit Auth, don't drop it.
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  passwordHash: varchar("password_hash"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Password reset tokens for the forgot-password flow.
// Only the SHA-256 hash of the token is stored (never the raw token).
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull(),
  tokenHash: text("token_hash").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type NewPasswordResetToken = typeof passwordResetTokens.$inferInsert;

// External identity providers (Google now; add github/apple by inserting a row
// with a new `provider` value — no schema change needed).
export const userIdentities = pgTable(
  "user_identities",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    provider: text("provider").notNull(),
    providerAccountId: text("provider_account_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("uq_user_identities_provider_account").on(table.provider, table.providerAccountId),
    index("idx_user_identities_user").on(table.userId),
  ],
);

export type UserIdentity = typeof userIdentities.$inferSelect;

// WebAuthn / passkey credentials. publicKey is base64url-encoded COSE key bytes.
export const webauthnCredentials = pgTable(
  "webauthn_credentials",
  {
    id: serial("id").primaryKey(),
    userId: varchar("user_id").notNull(),
    credentialId: text("credential_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").default(0).notNull(),
    transports: text("transports"),
    deviceLabel: text("device_label"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    lastUsedAt: timestamp("last_used_at"),
  },
  (table) => [
    uniqueIndex("uq_webauthn_credentials_credential_id").on(table.credentialId),
    index("idx_webauthn_credentials_user").on(table.userId),
  ],
);

export type WebauthnCredential = typeof webauthnCredentials.$inferSelect;
