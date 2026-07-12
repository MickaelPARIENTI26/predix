"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { loginSchema, fieldErrors } from "@/lib/schemas/auth";
import { signIn } from "@/lib/auth/actions";

export function LoginForm({ next }: { next?: string }) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = loginSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await signIn(parsed.data, next);
      // On success the action redirects; we only get here on failure.
      if (res && !res.ok) setFormError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="email" required />
        {errors.email && <p className="text-destructive text-sm">{errors.email}</p>}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Mot de passe</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
        {errors.password && (
          <p className="text-destructive text-sm">{errors.password}</p>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Connexion…" : "Se connecter"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Pas encore de compte ?{" "}
        <Link href="/signup" className="text-foreground underline">
          Créer un compte
        </Link>
      </p>
    </form>
  );
}
