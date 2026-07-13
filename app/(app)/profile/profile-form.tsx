"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateProfileSchema, fieldErrors } from "@/lib/schemas/auth";
import { updateProfile } from "@/lib/auth/actions";

export function ProfileForm({
  initialName,
  initialPhone,
}: {
  initialName: string;
  initialPhone: string;
}) {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string>("");
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setErrors({});
    setSaved(false);
    const parsed = updateProfileSchema.safeParse({ displayName: name, phone });
    if (!parsed.success) {
      setErrors(fieldErrors(parsed.error));
      return;
    }
    startTransition(async () => {
      const res = await updateProfile(parsed.data);
      if (res.ok) setSaved(true);
      else setError(res.error);
    });
  }

  const dirty = name.trim() !== initialName || phone.trim() !== initialPhone;

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
          value={phone}
          onChange={(e) => {
            setPhone(e.target.value);
            setSaved(false);
          }}
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
      {error && <p className="text-destructive text-sm">{error}</p>}
      {saved && !dirty && (
        <p role="status" className="text-sm text-green-600">
          Enregistré.
        </p>
      )}
      <Button type="submit" disabled={pending || !dirty}>
        {pending ? "Enregistrement…" : "Enregistrer"}
      </Button>
    </form>
  );
}
