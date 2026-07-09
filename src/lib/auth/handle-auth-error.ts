import { isAdminRequiredError } from "./require-admin";
import { isAuthRequiredError } from "./require-user";

export function authErrorResponse(error: unknown) {
  if (isAuthRequiredError(error)) {
    return Response.json({ error: "Giriş gerekli." }, { status: 401 });
  }

  if (isAdminRequiredError(error)) {
    return Response.json({ error: "Yetkin yok." }, { status: 403 });
  }

  return null;
}
