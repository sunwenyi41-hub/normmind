import type { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null | undefined) {
  if (!user) return false;

  const role = typeof user.app_metadata?.role === "string"
    ? user.app_metadata.role.toLowerCase()
    : "";
  if (role === "admin") return true;

  // Production authorization must come from trusted app metadata.
  // The email allowlist is only a local bootstrap convenience.
  if (process.env.NODE_ENV === "production") return false;

  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
}
