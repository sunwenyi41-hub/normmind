import { redirect } from "next/navigation";
import { isAdminUser } from "@/lib/admin-auth";
import { createClient } from "@/lib/supabase/server";

export default async function AdminLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=%2Fadmin");
  if (!isAdminUser(user)) redirect("/?notice=admin-only");

  return children;
}
