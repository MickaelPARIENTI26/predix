"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileSchema, fieldErrors } from "@/lib/schemas/auth";
import { updateDisplayName } from "@/lib/auth/actions";

export function ProfileForm({ initialName }: { initialName: string }) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSaved(false);
    const parsed = updateProfileSchema.safeParse({ displayName: name });
    if (!parsed.success) {
      setError(fieldErrors(parsed.error).displayName ?? "Nom invalide.");
      return;
    }
    startTransition(async () => {
      const res = await updateDisplayName(parsed.data);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  const dirty = name.trim() !== initialName;

  return (
    <form onSubmit={onSubmit} className="flex max-w-sm flex-col gap-4" noValidate>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="displayName">Nom affiché</Label>
        <Input
          id="displayName"
          name="displayName"
          value={name}
          maxLength={40}
          onChange={(e) => {
            setName(e.target.value);
            setSaved(false);
          }}
          required
        />
        {error && <p className="text-destructive text-sm">{error}</p>}
        {saved && !dirty && (
          <p role="status" className="text-sm text-green-600">
            Enregistré.
          </p>
        )}
      </div>
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
