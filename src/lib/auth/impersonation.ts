import { cookies } from "next/headers";

const IMPERSONATION_COOKIE = "impersonation_session";

export interface ImpersonationSession {
  originalUserId: string;
  originalUserEmail: string;
  impersonatedUserId: string;
  impersonatedUserEmail: string;
  reason: string;
  startedAt: string;
}

/**
 * Start an impersonation session
 */
export async function startImpersonation(
  originalUser: { id: string; email: string },
  targetUser: { id: string; email: string },
  reason?: string
): Promise<ImpersonationSession> {
  const session: ImpersonationSession = {
    originalUserId: originalUser.id,
    originalUserEmail: originalUser.email,
    impersonatedUserId: targetUser.id,
    impersonatedUserEmail: targetUser.email,
    reason: reason ?? "",
    startedAt: new Date().toISOString(),
  };

  // Store in cookie (in production, also store in database)
  const cookieStore = await cookies();
  cookieStore.set(IMPERSONATION_COOKIE, JSON.stringify(session), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 2, // 2 hours max impersonation
    path: "/",
  });

  return session;
}

/**
 * End the current impersonation session
 */
export async function endImpersonation(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(IMPERSONATION_COOKIE);
}

/**
 * Get the current impersonation session
 */
export async function getImpersonationSession(): Promise<ImpersonationSession | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(IMPERSONATION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    return JSON.parse(sessionCookie.value) as ImpersonationSession;
  } catch {
    return null;
  }
}

/**
 * Check if currently impersonating
 */
export async function isImpersonating(): Promise<boolean> {
  const session = await getImpersonationSession();
  return session !== null;
}

/**
 * Get the original user (master admin) from an impersonation session
 */
export async function getOriginalUser(): Promise<{
  id: string;
  email: string;
} | null> {
  const session = await getImpersonationSession();
  if (!session) return null;

  return {
    id: session.originalUserId,
    email: session.originalUserEmail,
  };
}
