import { getCurrentUser } from "./get-current-user";
import { assertUserCanLogin } from "./moderation";
import type { CurrentUser } from "./types";

export class AuthRequiredError extends Error {
  constructor() {
    super("AUTH_REQUIRED");
  }
}

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();

  if (!user) throw new AuthRequiredError();
  await assertUserCanLogin(user.id);

  return user;
}

export function isAuthRequiredError(error: unknown) {
  return error instanceof AuthRequiredError;
}
