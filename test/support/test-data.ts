// Creates and clears made-up data for tests that use the test database.
import { vi } from "vitest";
import { getCurrentUser } from "@/lib/currentUser";
import { prisma } from "@/lib/prisma";
import { assertTestDatabaseUrl } from "./database-guard";

// Checked as soon as this file loads, because the functions below delete rows.
assertTestDatabaseUrl(process.env.DATABASE_URL);

// Empties the tables tests write to. Children go first, because they point at their parents.
// Checklist templates stay, because the browser test relies on the seed data.
export async function clearTestData() {
  await prisma.pendingRequirement.deleteMany();
  await prisma.document.deleteMany();
  await prisma.user.deleteMany();
  await prisma.company.deleteMany();
}

// One company and its user, in the same shape getCurrentUser returns.
export async function createCompanyUser(name: string, category: string) {
  const company = await prisma.company.create({
    data: { name, description: `${name} is made up for tests.`, category },
  });
  return prisma.user.create({
    data: { email: `${company.id}@example.test`, passwordHash: "fake", companyId: company.id },
    include: { company: true },
  });
}

// A user with no company yet, or an admin, depending on the flag.
export function createUserWithoutCompany(email: string, isAdmin = false) {
  return prisma.user.create({
    data: { email, passwordHash: "fake", isAdmin },
    include: { company: true },
  });
}

// A checklist item. Safe to call twice, because it finds the existing row.
export function createTemplate(category: string, name: string) {
  return prisma.requirementTemplate.upsert({
    where: { category_name: { category, name } },
    update: {},
    create: { category, name, renewalPeriod: "yearly" },
  });
}

// A document owned by the company, with a storage key in the app's real format.
export function createDocument(companyId: number) {
  return prisma.document.create({
    data: {
      companyId,
      fileUrl: `company-${companyId}/fake.pdf`,
      extractedType: "Fake Certificate",
    },
  });
}

// Decides who the app thinks is logged in. A test file must first replace
// getCurrentUser with vi.mock, because Vitest cannot produce a real login session.
export function logInAs(user: Awaited<ReturnType<typeof getCurrentUser>>) {
  vi.mocked(getCurrentUser).mockResolvedValue(user);
}
