"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function InviteCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the code is visible anyway
    }
  }

  return (
    <div className="flex items-center gap-2">
      <code className="bg-muted rounded px-2 py-1 font-mono text-lg tracking-widest">
        {code}
      </code>
      <Button type="button" variant="outline" size="sm" onClick={copy}>
        {copied ? "Copié !" : "Copier"}
      </Button>
    </div>
  );
}
