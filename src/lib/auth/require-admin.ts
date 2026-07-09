import { requireUser } from "./require-user";
import type { CurrentUser } from "./types";

export class AdminRequiredError extends Error {
  constructor() {
    super("ADMIN_REQUIRED");
  }
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();

  if (!user.profile?.is_admin) throw new AdminRequiredError();

  return user;
}

export function isAdminRequiredError(error: unknown) {
  return error instanceof AdminRequiredError;
}
