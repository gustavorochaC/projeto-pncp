"use client";

import { Button, Card, Input } from "@pncp/ui";
import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage("");
    setIsSubmitting(true);
    const supabase = createClient();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) {
      setIsSubmitting(false);
      setErrorMessage("Nao foi possivel entrar. Verifique e-mail e senha.");
      return;
    }

    startTransition(() => {
      router.replace("/dashboard");
      router.refresh();
    });
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-xl items-center px-6">
      <Card className="w-full space-y-6">
        <div>
          <p className="text-sm text-slate-500">Acesso seguro</p>
          <h1 className="text-3xl font-semibold text-slate-950">Entrar na plataforma</h1>
          <p className="mt-2 text-sm text-slate-500">
            Use sua conta Supabase para acessar o painel.
          </p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <Input
            placeholder="Seu e-mail"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
          <Input
            placeholder="Sua senha"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />

          {errorMessage ? (
            <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">
              {errorMessage}
            </p>
          ) : null}

          <Button className="w-full" disabled={isSubmitting} type="submit">
            {isSubmitting ? "Entrando..." : "Entrar"}
          </Button>
        </form>
      </Card>
    </main>
  );
}
