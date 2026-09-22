const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");

const prisma = new PrismaClient();

async function main() {
  // Delete existing data (clean slate)
  await prisma.booking.deleteMany();
  await prisma.room.deleteMany();
  await prisma.user.deleteMany();

  console.log("Creating demo users...");

  // Create demo users
  const users = [
    {
      email: "user@example.com",
      name: "Regular User",
      password: await bcrypt.hash("password", 10),
      role: "USER",
    },
    {
      email: "admin@example.com",
      name: "Room Admin",
      password: await bcrypt.hash("password", 10),
      role: "ROOM_ADMIN",
    },
    {
      email: "system@example.com",
      name: "System Admin",
      password: await bcrypt.hash("password", 10),
      role: "SYSTEM_ADMIN",
    },
  ];

  const createdUsers = await Promise.all(
    users.map((user) => prisma.user.create({ data: user }))
  );

  console.log("Created users:", createdUsers.map((u) => u.email));

  // Create demo rooms
  console.log("Creating demo rooms...");

  const rooms = [
    {
      name: "Executive Conference Room",
      description: "Large room for executive meetings and presentations",
      capacity: 20,
      image:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
      amenities: JSON.stringify([
        "Projector",
        "Video Conference",
        "Whiteboard",
        "Printer",
      ]),
      roomAdminId: createdUsers[1].id, // Room Admin
      status: true,
    },
    {
      name: "Meeting Room A",
      description: "Medium-sized meeting room with comfortable seating",
      capacity: 10,
      image:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
      amenities: JSON.stringify(["Projector", "Whiteboard", "TV Screen"]),
      roomAdminId: createdUsers[1].id, // Room Admin
      status: true,
    },
    {
      name: "Breakout Room B",
      description: "Small team collaboration space",
      capacity: 6,
      image:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
      amenities: JSON.stringify(["Whiteboard", "Coffee Machine"]),
      roomAdminId: createdUsers[1].id, // Room Admin
      status: true,
    },
    {
      name: "Training Room",
      description: "Large room equipped for training sessions",
      capacity: 30,
      image:
        "https://images.unsplash.com/photo-1552664730-d307ca884978?w=500&h=500&fit=crop",
      amenities: JSON.stringify([
        "Projector",
        "Video Conference",
        "TV Screen",
        "Printer",
      ]),
      roomAdminId: createdUsers[1].id, // Room Admin
      status: true,
    },
  ];

  const createdRooms = await Promise.all(
    rooms.map((room) => prisma.room.create({ data: room }))
  );

  console.log("Created rooms:", createdRooms.map((r) => r.name));

  // Create some demo bookings
  console.log("Creating demo bookings...");

  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  const bookings = [
    {
      userId: createdUsers[0].id, // Regular User
      roomId: createdRooms[0].id,
      title: "Team Standup",
      description: "Daily team standup meeting",
      attendees: 5,
      startTime: new Date(tomorrow.getTime() + 9 * 60 * 60 * 1000), // 9 AM tomorrow
      endTime: new Date(tomorrow.getTime() + 10 * 60 * 60 * 1000), // 10 AM tomorrow
      status: "APPROVED",
    },
    {
      userId: createdUsers[0].id,
      roomId: createdRooms[1].id,
      title: "Project Review",
      description: "Q3 project review meeting",
      attendees: 8,
      startTime: new Date(tomorrow.getTime() + 14 * 60 * 60 * 1000), // 2 PM tomorrow
      endTime: new Date(tomorrow.getTime() + 15 * 60 * 60 * 1000), // 3 PM tomorrow
      status: "PENDING",
    },
  ];

  const createdBookings = await Promise.all(
    bookings.map((booking) => prisma.booking.create({ data: booking }))
  );

  console.log(
    "Created bookings:",
    createdBookings.map((b) => b.title)
  );

  console.log("\n✅ Demo data created successfully!");
  console.log("\nDemo Credentials:");
  console.log("- user@example.com / password (USER)");
  console.log("- admin@example.com / password (ROOM_ADMIN)");
  console.log("- system@example.com / password (SYSTEM_ADMIN)");
}

main()
  .catch((e) => {
    console.error("Error seeding database:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
