"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { signupSchema, fieldErrors } from "@/lib/schemas/auth";
import { signUp } from "@/lib/auth/actions";

export function SignupForm() {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>("");
  const [sentTo, setSentTo] = useState<string>("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setFormError("");
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    setErrors({});
    startTransition(async () => {
      const res = await signUp(parsed.data);
      // On the "logged in immediately" path the action redirects.
      if (res && !res.ok) setFormError(res.error);
      else if (res && res.ok && res.needsConfirmation) setSentTo(parsed.data.email);
    });
  }

  if (sentTo) {
    return (
      <div role="status" className="flex w-full max-w-sm flex-col gap-3 text-sm">
        <p className="font-medium">Vérifie tes emails</p>
        <p className="text-muted-foreground">
          Un lien de confirmation a été envoyé à <strong>{sentTo}</strong>. Clique
          dessus pour activer ton compte, puis connecte-toi.
        </p>
        <Link href="/login" className="text-foreground underline">
          Aller à la connexion
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="flex w-full max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Nom affiché</Label>
        <Input
          id="displayName"
          name="displayName"
          type="text"
          autoComplete="nickname"
          maxLength={40}
          required
        />
        {errors.displayName && (
          <p className="text-destructive text-sm">{errors.displayName}</p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="phone">Téléphone</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          required
        />
        {errors.phone ? (
          <p className="text-destructive text-sm">{errors.phone}</p>
        ) : (
          <p className="text-muted-foreground text-xs">
            Pour les rappels WhatsApp avant les matchs.
          </p>
        )}
      </div>
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
          autoComplete="new-password"
          required
        />
        {errors.password ? (
          <p className="text-destructive text-sm">{errors.password}</p>
        ) : (
          <p className="text-muted-foreground text-xs">Au moins 8 caractères.</p>
        )}
      </div>
      {formError && (
        <p role="alert" className="text-destructive text-sm">
          {formError}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer mon compte"}
      </Button>
      <p className="text-muted-foreground text-center text-sm">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-foreground underline">
          Se connecter
        </Link>
      </p>
    </form>
  );
}
