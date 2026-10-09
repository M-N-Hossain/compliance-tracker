// prisma/seed.ts
import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../app/generated/prisma/client";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const requirementTemplates = [
  // physical_product
  { category: "physical_product", name: "CE marking declaration", renewalPeriod: "one-time" },
  {
    category: "physical_product",
    name: "EU product safety compliance certificate",
    renewalPeriod: "yearly",
  },
  {
    category: "physical_product",
    name: "Packaging & packaging waste compliance",
    renewalPeriod: "yearly",
  },
  {
    category: "physical_product",
    name: "REACH chemical compliance documentation",
    renewalPeriod: "yearly",
  },

  // food_beverage
  { category: "food_beverage", name: "Food safety certification (HACCP)", renewalPeriod: "yearly" },
  { category: "food_beverage", name: "Food labeling compliance", renewalPeriod: "yearly" },
  {
    category: "food_beverage",
    name: "Health & hygiene inspection certificate",
    renewalPeriod: "yearly",
  },

  // digital_service
  { category: "digital_service", name: "GDPR data processing policy", renewalPeriod: "yearly" },
  {
    category: "digital_service",
    name: "Terms of service & privacy policy",
    renewalPeriod: "yearly",
  },
  {
    category: "digital_service",
    name: "Accessibility compliance statement",
    renewalPeriod: "yearly",
  },

  // data_collecting_service
  {
    category: "data_collecting_service",
    name: "GDPR data processing policy",
    renewalPeriod: "yearly",
  },
  {
    category: "data_collecting_service",
    name: "Data Protection Impact Assessment (DPIA)",
    renewalPeriod: "yearly",
  },
  {
    category: "data_collecting_service",
    name: "Data breach response plan",
    renewalPeriod: "yearly",
  },
  {
    category: "data_collecting_service",
    name: "Cookie consent compliance",
    renewalPeriod: "yearly",
  },
];

async function main() {
  for (const template of requirementTemplates) {
    await prisma.requirementTemplate.upsert({
      where: {
        category_name: { category: template.category, name: template.name },
      },
      update: template,
      create: template,
    });
  }
  console.log(`Seeded ${requirementTemplates.length} requirement templates.`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
    await pool.end();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    await pool.end();
    process.exit(1);
  });
