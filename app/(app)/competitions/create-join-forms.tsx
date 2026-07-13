"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createCompetitionSchema,
  joinCompetitionSchema,
} from "@/lib/schemas/competition";
import { createCompetition, joinCompetition } from "@/lib/competitions/actions";

export function CreateCompetitionForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = createCompetitionSchema.safeParse(raw);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Nom invalide.");
      return;
    }
    startTransition(async () => {
      const res = await createCompetition(parsed.data);
      if (res.ok) router.push(`/competitions/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="name">Nom de la compétition</Label>
        <Input id="name" name="name" placeholder="Euro entre potes" maxLength={80} required />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" disabled={pending}>
        {pending ? "Création…" : "Créer la compétition"}
      </Button>
    </form>
  );
}

export function JoinCompetitionForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    const raw = Object.fromEntries(new FormData(e.currentTarget));
    const parsed = joinCompetitionSchema.safeParse(raw);
    if (!parsed.success) {
      setError("Code à 6 caractères.");
      return;
    }
    startTransition(async () => {
      const res = await joinCompetition(parsed.data);
      if (res.ok) router.push(`/competitions/${res.id}`);
      else setError(res.error);
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-3" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="code">Code d&apos;invitation</Label>
        <Input
          id="code"
          name="code"
          placeholder="ABC234"
          maxLength={6}
          autoCapitalize="characters"
          className="uppercase"
          required
        />
      </div>
      {error && <p className="text-destructive text-sm">{error}</p>}
      <Button type="submit" variant="outline" disabled={pending}>
        {pending ? "…" : "Rejoindre"}
      </Button>
    </form>
  );
}
