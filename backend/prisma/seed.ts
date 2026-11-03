import { PrismaClient, UserRole } from "@prisma/client";
import { hashPassword } from "../src/auth/password.util";

const prisma = new PrismaClient();
const environment = (globalThis as typeof globalThis & {
  process?: { env?: Record<string, string | undefined> };
}).process?.env ?? {};

async function main() {
  const seedMode = environment["SEED_MODE"] ?? "demo";
  const demoAdminPassword = environment["DEMO_ADMIN_PASSWORD"];
  if (seedMode !== "admin-only" && seedMode !== "demo") {
    throw new Error("SEED_MODE must be 'admin-only' or 'demo'.");
  }
  if (!demoAdminPassword) {
    throw new Error("Set DEMO_ADMIN_PASSWORD before seeding.");
  }
  const university = await prisma.university.upsert({
    where: { id: seedMode === "admin-only" ? "uni-parametria" : "uni-andes" },
    update: {},
    create: seedMode === "admin-only"
      ? { id: "uni-parametria", name: "ParametrIA" }
      : { id: "uni-andes", name: "Universidad de los Andes", domain: "uniandes.edu.co" },
  });
  const admin = await prisma.user.upsert({
    where: { email: "admin@parametria.edu" },
    update: { passwordHash: await hashPassword(demoAdminPassword), mustSetPassword: false },
    create: { name: "Admin ParametrIA", email: "admin@parametria.edu", passwordHash: await hashPassword(demoAdminPassword), role: UserRole.SUPERADMIN, universityId: university.id },
  });
  if (seedMode === "admin-only") {
    console.info(`ParametrIA initial administrator ready (${admin.email}).`);
    return;
  }

  const demoInstructorPassword = environment["DEMO_INSTRUCTOR_PASSWORD"];
  const demoStudentPassword = environment["DEMO_STUDENT_PASSWORD"];
  if (!demoInstructorPassword || !demoStudentPassword) {
    throw new Error("Set DEMO_INSTRUCTOR_PASSWORD and DEMO_STUDENT_PASSWORD when SEED_MODE=demo.");
  }
  await prisma.provider.upsert({
    where: { id: "openai" },
    update: { name: "OpenAI", baseUrl: "https://api.openai.com/v1", protocol: "OPENAI_COMPATIBLE" },
    create: { id: "openai", name: "OpenAI", logoUrl: "", baseUrl: "https://api.openai.com/v1", protocol: "OPENAI_COMPATIBLE" },
  });
  await prisma.provider.upsert({
    where: { id: "anthropic" },
    update: { name: "Anthropic", baseUrl: "https://api.anthropic.com/v1", protocol: "ANTHROPIC" },
    create: { id: "anthropic", name: "Anthropic", logoUrl: "", baseUrl: "https://api.anthropic.com/v1", protocol: "ANTHROPIC" },
  });
  const instructor = await prisma.user.upsert({
    where: { email: "laura@parametria.edu" },
    update: { passwordHash: await hashPassword(demoInstructorPassword), mustSetPassword: false },
    create: { name: "Dra. Laura Méndez", email: "laura@parametria.edu", passwordHash: await hashPassword(demoInstructorPassword), role: UserRole.INSTRUCTOR, universityId: university.id },
  });
  const student = await prisma.user.upsert({
    where: { email: "sofia@parametria.edu" },
    update: { passwordHash: await hashPassword(demoStudentPassword), mustSetPassword: false },
    create: { name: "Sofía Ramírez", email: "sofia@parametria.edu", passwordHash: await hashPassword(demoStudentPassword), role: UserRole.STUDENT, universityId: university.id },
  });
  const course = await prisma.course.upsert({
    where: { id: "course-seminario-investigacion" },
    update: { instructorId: instructor.id, universityId: university.id },
    create: {
      id: "course-seminario-investigacion",
      name: "Seminario de Investigación",
      instructorId: instructor.id,
      universityId: university.id,
    },
  });
  const classroom = await prisma.classroom.upsert({
    where: { code: "INV-401" },
    update: { courseId: course.id, instructorId: instructor.id },
    create: {
      name: "Seminario de Investigación I",
      code: "INV-401",
      universityId: university.id,
      courseId: course.id,
      instructorId: instructor.id,
      students: { connect: [{ id: student.id }] },
    },
  });
  console.info(`ParametrIA demo data ready (admin: ${admin.email}).`);
}

main()
  .catch((error: unknown) => {
    console.error("Could not seed the database.", error);
    process.exitCode = 1;
  })
  .finally(async () => prisma.$disconnect());
