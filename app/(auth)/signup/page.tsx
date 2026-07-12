import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { SignupForm } from "./signup-form";

export default function SignupPage() {
  return (
    <Card className="w-full max-w-sm">
      <CardHeader>
        <CardTitle>Créer un compte</CardTitle>
        <CardDescription>Rejoins tes amis sur Predix.</CardDescription>
      </CardHeader>
      <CardContent>
        <SignupForm />
      </CardContent>
    </Card>
  );
}
