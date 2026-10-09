/*
  Warnings:

  - A unique constraint covering the columns `[category,name]` on the table `RequirementTemplate` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "RequirementTemplate_category_name_key" ON "RequirementTemplate"("category", "name");
