import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireUser, getProfile } from "@/lib/auth/user";
import { ProfileForm } from "./profile-form";

export default async function ProfilePage() {
  const user = await requireUser();
  const profile = await getProfile();

  return (
    <div className="flex flex-col gap-6 py-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mon profil</h1>
        <p className="text-muted-foreground text-sm">{user.email}</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Nom affiché</CardTitle>
          <CardDescription>
            Le nom que tes amis verront dans les classements.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileForm initialName={profile?.display_name ?? ""} />
        </CardContent>
      </Card>
    </div>
  );
}
