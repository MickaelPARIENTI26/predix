"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";

export function AppNav({ displayName }: { displayName: string }) {
  const [open, setOpen] = useState(false);

  const links = (
    <>
      <Link
        href="/competitions"
        className="text-muted-foreground hover:text-foreground text-sm"
        onClick={() => setOpen(false)}
      >
        Compétitions
      </Link>
      <Link
        href="/profile"
        className="text-muted-foreground hover:text-foreground text-sm"
        onClick={() => setOpen(false)}
      >
        {displayName}
      </Link>
      <form action={signOut}>
        <Button type="submit" variant="ghost" size="sm">
          Déconnexion
        </Button>
      </form>
    </>
  );

  return (
    <>
      {/* Desktop */}
      <nav className="hidden items-center gap-3 sm:flex">{links}</nav>

      {/* Mobile burger */}
      <div className="sm:hidden">
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
        >
          {open ? <X /> : <Menu />}
        </Button>
        {open && (
          <div className="bg-background absolute inset-x-0 top-full z-20 flex flex-col items-end gap-3 border-b px-4 py-3 shadow-sm">
            {links}
          </div>
        )}
      </div>
    </>
  );
}
