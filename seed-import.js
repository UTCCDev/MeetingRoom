const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const fs = require("fs");
const path = require("path");

const prisma = new PrismaClient();

async function main() {
  try {
    console.log("🧹 Cleaning up existing data...");
    
    // Delete existing data in correct order (respecting foreign keys)
    await prisma.booking.deleteMany();
    await prisma.room.deleteMany();
    await prisma.user.deleteMany();

    console.log("✓ Database cleared\n");

    // Create system users
    console.log("👥 Creating system users...");
    
    const systemUsers = [
      {
        email: "user@example.com",
        name: "Regular User",
        password: await bcrypt.hash("password", 10),
        role: "USER",
      },
      {
        email: "system@example.com",
        name: "System Admin",
        password: await bcrypt.hash("password", 10),
        role: "SYSTEM_ADMIN",
      },
    ];

    const createdSystemUsers = await Promise.all(
      systemUsers.map((user) => prisma.user.create({ data: user }))
    );

    console.log("✓ Created system users:", createdSystemUsers.map((u) => u.email).join(", "));

    // Load room data from export
    console.log("\n📖 Loading room data from rooms-export.json...");
    
    const exportPath = path.join(__dirname, "rooms-export.json");
    const exportData = JSON.parse(fs.readFileSync(exportPath, "utf-8"));
    const roomsData = exportData.rooms;

    console.log(`✓ Loaded ${roomsData.length} rooms from export\n`);

    // Get unique departments and create room admins
    console.log("🏢 Creating room admin users by department...");
    
    const departments = [...new Set(roomsData.map((r) => r.department))];
    const departmentAdmins = {};

    for (let i = 0; i < departments.length; i++) {
      const dept = departments[i];
      // Use index-based ASCII email instead of department name
      const adminEmail = `admin${i + 1}@utcc.ac.th`;
      const adminName = `Admin - ${dept}`;

      const admin = await prisma.user.create({
        data: {
          email: adminEmail,
          name: adminName,
          password: await bcrypt.hash("password", 10),
          role: "ROOM_ADMIN",
        },
      });

      departmentAdmins[dept] = admin;
      console.log(`  ✓ ${dept}: ${adminEmail}`);
    }

    console.log(`\n✓ Created ${Object.keys(departmentAdmins).length} room admin users\n`);

    // Create rooms
    console.log("🏛️ Creating rooms...");
    
    let createdCount = 0;
    for (const roomData of roomsData) {
      const admin = departmentAdmins[roomData.department];
      
      if (admin) {
        // Convert amenities string to JSON array
        const amenitiesArray = roomData.amenities
          .split(",")
          .map((a) => a.trim());

        await prisma.room.create({
          data: {
            name: roomData.name,
            description: roomData.description,
            capacity: roomData.capacity,
            amenities: amenitiesArray,
            roomAdminId: admin.id,
            status: true,
          },
        });
        createdCount++;
      }
    }

    console.log(`✓ Created ${createdCount} rooms\n`);

    // Summary
    const userCount = await prisma.user.count();
    const roomCount = await prisma.room.count();
    
    console.log("═══════════════════════════════════════");
    console.log("✨ SEED COMPLETED SUCCESSFULLY ✨");
    console.log("═══════════════════════════════════════");
    console.log(`📊 Database Summary:`);
    console.log(`  • Total Users: ${userCount}`);
    console.log(`  • Total Rooms: ${roomCount}`);
    console.log(`  • System Users: 2 (Regular User + System Admin)`);
    console.log(`  • Room Admins: ${Object.keys(departmentAdmins).length} (by department)`);
    console.log("\n🔑 Default Credentials:");
    console.log("  • Regular User: user@example.com / password");
    console.log("  • System Admin: system@example.com / password");
    console.log("  • Room Admins: admin-[department] / password");
    console.log("═══════════════════════════════════════\n");

  } catch (error) {
    console.error("❌ Error during seed:", error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .then(() => {
    console.log("✅ Seeding complete!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("❌ Seeding failed:", error);
    process.exit(1);
  });
