import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin-auth";
import { safeGetUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const user = await safeGetUser(supabase);

  if (!user) redirect("/login?next=%2Fadmin");
  if (!isAdminUser(user)) redirect("/?notice=admin-only");

  return children;
}
