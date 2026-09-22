const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findUnique({
    where: { email: "user@example.com" },
  });

  if (user) {
    console.log("User found:");
    console.log("- Email:", user.email);
    console.log("- Name:", user.name);
    console.log("- Role:", user.role);
    console.log("- Password hash:", user.password.substring(0, 20) + "...");

    // Test password verification
    const testPassword = "password";
    const isMatch = await bcrypt.compare(testPassword, user.password);
    console.log("\nPassword verification:");
    console.log("- Test password:", testPassword);
    console.log("- Match result:", isMatch);
  } else {
    console.log("User not found!");
  }
}

main()
  .catch((e) => {
    console.error("Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
