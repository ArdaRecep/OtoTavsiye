import { getCurrentUser } from "./get-current-user";
import type { CurrentUser } from "./types";

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) throw new AuthRequiredError();

  return user;
}

export function isAuthRequiredError(error: unknown) {
  return error instanceof AuthRequiredError;
}
