import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { CompanySetupForm } from "./CompanySetupForm";

export default async function CompanySetupPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: Number(session.user.id) },
  });

  if (user?.companyId) {
    redirect("/dashboard");
  }

  return <CompanySetupForm />;
}
