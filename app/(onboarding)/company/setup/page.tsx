// app/(onboarding)/company/setup/page.tsx
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/currentUser";
import { CompanySetupForm } from "./CompanySetupForm";

export default async function CompanySetupPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.companyId) redirect("/dashboard");

  return <CompanySetupForm />;
}
