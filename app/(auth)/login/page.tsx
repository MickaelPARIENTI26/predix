import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { LoginForm } from "./login-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; error?: string }>;
}) {
  const { next, error } = await searchParams;

  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Se connecter</CardTitle>
        <CardDescription>Content de te revoir.</CardDescription>
      </CardHeader>
      <CardContent>
        {error === "confirm" && (
          <p role="alert" className="text-destructive mb-4 text-sm">
            Lien de confirmation invalide ou expiré. Réessaie de te connecter.
          </p>
        )}
        <LoginForm next={next} />
      </CardContent>
    </Card>
  );
}
