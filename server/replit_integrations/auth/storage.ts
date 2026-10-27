import {
  users,
  passwordResetTokens,
  userIdentities,
  webauthnCredentials,
  type User,
  type UpsertUser,
  type WebauthnCredential,
} from "@shared/models/auth";
import { db } from "../../db";
import { and, eq, isNull, lt } from "drizzle-orm";

// Interface for auth storage operations
// (IMPORTANT) These user operations are mandatory for Replit Auth.
export interface IAuthStorage {
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createLocalUser(user: { email: string; passwordHash: string; firstName: string | null; lastName: string | null }): Promise<User>;
  updatePasswordHash(userId: string, passwordHash: string): Promise<void>;
  createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<{ id: number }>;
  findPasswordResetTokenByHash(tokenHash: string): Promise<{ id: number; userId: string; expiresAt: Date; usedAt: Date | null } | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  clearPasswordResetTokensForUser(userId: string): Promise<void>;
  deleteExpiredPasswordResetTokens(): Promise<void>;
  // Social identity links (Google, …)
  findUserIdByIdentity(provider: string, providerAccountId: string): Promise<string | undefined>;
  linkIdentity(userId: string, provider: string, providerAccountId: string): Promise<void>;
  createUserFromOAuth(data: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User>;
  // Passkeys (WebAuthn)
  listPasskeys(userId: string): Promise<WebauthnCredential[]>;
  findPasskeyByCredentialId(credentialId: string): Promise<WebauthnCredential | undefined>;
  createPasskey(data: {
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string | null;
    deviceLabel: string | null;
  }): Promise<WebauthnCredential>;
  updatePasskeyUsage(id: number, counter: number): Promise<void>;
  deletePasskey(userId: string, id: number): Promise<void>;
}

class AuthStorage implements IAuthStorage {
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createLocalUser(userData: { email: string; passwordHash: string; firstName: string | null; lastName: string | null }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: userData.email,
        passwordHash: userData.passwordHash,
        firstName: userData.firstName,
        lastName: userData.lastName,
      })
      .returning();
    return user;
  }

  async updatePasswordHash(userId: string, passwordHash: string): Promise<void> {
    await db.update(users).set({ passwordHash }).where(eq(users.id, userId));
  }

  async createPasswordResetToken(userId: string, tokenHash: string, expiresAt: Date): Promise<{ id: number }> {
    const [row] = await db
      .insert(passwordResetTokens)
      .values({ userId, tokenHash, expiresAt })
      .returning({ id: passwordResetTokens.id });
    return { id: row.id };
  }

  async findPasswordResetTokenByHash(tokenHash: string) {
    const [row] = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);
    if (!row) return undefined;
    return {
      id: row.id,
      userId: row.userId,
      expiresAt: row.expiresAt instanceof Date ? row.expiresAt : new Date(row.expiresAt),
      usedAt: row.usedAt ? (row.usedAt instanceof Date ? row.usedAt : new Date(row.usedAt)) : null,
    };
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await db.update(passwordResetTokens).set({ usedAt: new Date() }).where(eq(passwordResetTokens.id, id));
  }

  async clearPasswordResetTokensForUser(userId: string): Promise<void> {
    await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
  }

  async deleteExpiredPasswordResetTokens(): Promise<void> {
    await db
      .delete(passwordResetTokens)
      .where(and(isNull(passwordResetTokens.usedAt), lt(passwordResetTokens.expiresAt, new Date())));
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  // ── Social identities ──────────────────────────────────────────────────

  async findUserIdByIdentity(provider: string, providerAccountId: string): Promise<string | undefined> {
    const [row] = await db
      .select({ userId: userIdentities.userId })
      .from(userIdentities)
      .where(
        and(
          eq(userIdentities.provider, provider),
          eq(userIdentities.providerAccountId, providerAccountId),
        ),
      )
      .limit(1);
    return row?.userId;
  }

  async linkIdentity(userId: string, provider: string, providerAccountId: string): Promise<void> {
    await db
      .insert(userIdentities)
      .values({ userId, provider, providerAccountId })
      .onConflictDoNothing();
  }

  async createUserFromOAuth(data: {
    email: string;
    firstName: string | null;
    lastName: string | null;
    profileImageUrl: string | null;
  }): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        profileImageUrl: data.profileImageUrl,
      })
      .returning();
    return user;
  }

  // ── Passkeys ───────────────────────────────────────────────────────────

  async listPasskeys(userId: string): Promise<WebauthnCredential[]> {
    return db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.userId, userId))
      .orderBy(webauthnCredentials.createdAt);
  }

  async findPasskeyByCredentialId(credentialId: string): Promise<WebauthnCredential | undefined> {
    const [row] = await db
      .select()
      .from(webauthnCredentials)
      .where(eq(webauthnCredentials.credentialId, credentialId))
      .limit(1);
    return row;
  }

  async createPasskey(data: {
    userId: string;
    credentialId: string;
    publicKey: string;
    counter: number;
    transports: string | null;
    deviceLabel: string | null;
  }): Promise<WebauthnCredential> {
    const [row] = await db.insert(webauthnCredentials).values(data).returning();
    return row;
  }

  async updatePasskeyUsage(id: number, counter: number): Promise<void> {
    await db
      .update(webauthnCredentials)
      .set({ counter, lastUsedAt: new Date() })
      .where(eq(webauthnCredentials.id, id));
  }

  async deletePasskey(userId: string, id: number): Promise<void> {
    await db
      .delete(webauthnCredentials)
      .where(and(eq(webauthnCredentials.userId, userId), eq(webauthnCredentials.id, id)));
  }
}

export const authStorage = new AuthStorage();
