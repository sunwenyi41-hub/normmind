"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Building2, Loader2, LockKeyhole } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (password !== confirmation) {
      setMessage("两次输入的密码不一致。");
      return;
    }
    setLoading(true);
    setMessage(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      await supabase.auth.signOut({ scope: "local" });
      router.replace("/login?reset=success");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "密码更新失败，请重新打开重置邮件。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-muted/30 p-6">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-3">
          <div className="grid size-11 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Building2 className="size-5" />
          </div>
          <CardTitle>设置新密码</CardTitle>
          <CardDescription>请设置至少 8 位的新密码，完成后使用新密码登录规智。</CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-4" onSubmit={submit}>
            <PasswordField label="新密码" value={password} onChange={setPassword} />
            <PasswordField label="再次输入新密码" value={confirmation} onChange={setConfirmation} />
            {message ? <p className="rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground" role="alert">{message}</p> : null}
            <Button className="w-full" disabled={loading}>
              {loading ? <Loader2 className="size-4 animate-spin" /> : <>更新密码<ArrowRight className="size-4" /></>}
            </Button>
          </form>
        </CardContent>
      </Card>
    </main>
  );
}

function PasswordField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="block space-y-2 text-sm font-medium">
      {label}
      <div className="relative">
        <LockKeyhole className="absolute start-3 top-3 size-4 text-muted-foreground" />
        <Input className="ps-10" type="password" autoComplete="new-password" minLength={8} required value={value} onChange={(event) => onChange(event.target.value)} placeholder="至少 8 位" />
      </div>
    </label>
  );
}
