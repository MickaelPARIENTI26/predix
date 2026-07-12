import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main className="flex min-h-[100dvh] flex-col items-center justify-center gap-6 p-6">
      <Link href="/" className="text-2xl font-bold tracking-tight">
        Predix
      </Link>
      {children}
    </main>
  );
}
