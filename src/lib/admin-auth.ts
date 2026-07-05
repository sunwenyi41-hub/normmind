import type { User } from "@supabase/supabase-js";

export function isAdminUser(user: User | null | undefined) {
  if (!user) return false;

  const role = typeof user.app_metadata?.role === "string"
    ? user.app_metadata.role.toLowerCase()
    : "";
  if (role === "admin") return true;

  const allowedEmails = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);

  return Boolean(user.email && allowedEmails.includes(user.email.toLowerCase()));
}
