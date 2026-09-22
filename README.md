# Meeting Room Booking System

ระบบจองห้องประชุมส่วนกลาง (Centralized Meeting Room Booking System) - A comprehensive full-stack web application for managing meeting room bookings within an organization.

## Features

### User Roles & Permissions
- **User**: Regular employees who can browse rooms and book meetings
- **Room Admin**: Manages specific rooms and approves/rejects booking requests
- **System Admin**: Full system control including user and room management

### Core Features
- ✅ Room Catalog with detailed information
- ✅ Availability Calendar for each room
- ✅ Room Booking System with approval workflow
- ✅ Email Notifications for booking status
- ✅ Room Admin Dashboard for booking approvals
- ✅ System Admin Dashboard with statistics
- ✅ User Management
- ✅ Responsive Mobile-First Design

## Tech Stack

- **Frontend & Backend**: Next.js 15 (React 19)
- **Styling**: Tailwind CSS 4
- **Authentication**: NextAuth.js
- **Database**: MySQL
- **ORM**: Prisma 8
- **Email**: Nodemailer
- **Language**: TypeScript

## Project Structure

```
MeetingRoom/
├── app/                        # Next.js app directory
│   ├── api/                   # API routes
│   │   ├── auth/             # Authentication routes
│   │   ├── bookings/         # Booking management
│   │   ├── rooms/            # Room management
│   │   └── admin/            # Admin endpoints
│   ├── auth/                 # Authentication pages
│   ├── rooms/                # Room browsing & booking
│   ├── my-bookings/          # User's bookings
│   ├── admin/                # Admin dashboards
│   ├── layout.tsx            # Root layout
│   ├── page.tsx              # Home page
│   └── globals.css           # Global styles
├── lib/                        # Utility functions
│   ├── auth.ts               # NextAuth configuration
│   ├── prisma.ts             # Prisma client
│   └── email.ts              # Email utilities
├── prisma/
│   └── schema.prisma         # Database schema
├── .env.local                # Environment variables
├── tailwind.config.ts        # Tailwind configuration
├── tsconfig.json             # TypeScript configuration
└── package.json              # Dependencies
```

## Setup Instructions

### Prerequisites
- Node.js 18+ and npm
- MySQL database server
- Git

### Installation

1. **Clone the repository**
   ```bash
   cd c:/xampp/htdocs/MeetingRoom
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Configure environment variables**
   - Copy `.env.local` and update with your configuration:
   ```env
   DATABASE_URL="mysql://user:password@localhost:3306/meetingroom"
   NEXTAUTH_SECRET="your-secret-key"
   NEXTAUTH_URL="http://localhost:3000"
   EMAIL_HOST="smtp.gmail.com"
   EMAIL_PORT="587"
   EMAIL_USER="your-email@gmail.com"
   EMAIL_PASSWORD="your-app-password"
   EMAIL_FROM="noreply@meetingroom.com"
   ```

4. **Setup Database**
   ```bash
   # Generate Prisma client
   npx prisma generate
   
   # Create migration
   npx prisma migrate dev --name init
   
   # (Optional) Open Prisma Studio to view data
   npx prisma studio
   ```

5. **Create Demo Data** (Optional)
   - Use Prisma Studio or create API calls to add demo users and rooms

6. **Start the development server**
   ```bash
   npm run dev
   ```

   The application will be available at `http://localhost:3000`

## Default Routes

### Public
- `GET  /` - Home page (requires login)
- `GET  /auth/login` - Login page
- `GET  /auth/register` - Registration page

### User Routes
- `GET  /rooms` - Browse all rooms
- `GET  /rooms/[id]` - Room details and booking form
- `GET  /my-bookings` - User's booking history

### Room Admin Routes
- `GET  /admin/pending-approvals` - Pending booking requests
- `GET  /admin/my-rooms` - Manage owned rooms
- `PUT  /api/rooms/[id]` - Update room details
- `PUT  /api/bookings/[id]` - Approve/reject bookings

### System Admin Routes
- `GET  /admin/dashboard` - System dashboard with statistics
- `GET  /admin/users` - Manage users and roles
- `GET  /admin/rooms` - Manage all rooms
- `GET  /admin/pending-approvals` - All pending bookings

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/[...nextauth]` - NextAuth endpoints

### Rooms
- `GET  /api/rooms` - Get all active rooms
- `POST /api/rooms` - Create room (System Admin only)
- `GET  /api/rooms/[id]` - Get room details
- `PUT  /api/rooms/[id]` - Update room (Room Admin or System Admin)
- `DELETE /api/rooms/[id]` - Delete room (System Admin only)
- `GET  /api/rooms/[id]/bookings` - Get room's bookings

### Bookings
- `GET  /api/bookings` - Get user's bookings
- `POST /api/bookings` - Create booking request
- `GET  /api/bookings/[id]` - Get booking details
- `PUT  /api/bookings/[id]` - Update booking status
- `DELETE /api/bookings/[id]` - Cancel booking

### Admin
- `GET  /api/admin/pending-bookings` - Get pending bookings
- `GET  /api/admin/users` - Get all users (System Admin)
- `POST /api/admin/users` - Create user (System Admin)
- `PUT  /api/admin/users` - Update user role (System Admin)
- `GET  /api/admin/dashboard-stats` - Dashboard statistics

## Database Schema

### Users
```prisma
- id (PK)
- email (unique)
- name
- password (hashed)
- role (USER | ROOM_ADMIN | SYSTEM_ADMIN)
- createdAt, updatedAt
```

### Rooms
```prisma
- id (PK)
- name
- description
- capacity
- image (URL)
- amenities (JSON)
- roomAdminId (FK)
- status (active/inactive)
- createdAt, updatedAt
```

### Bookings
```prisma
- id (PK)
- userId (FK)
- roomId (FK)
- title
- description
- attendees
- startTime
- endTime
- status (PENDING | APPROVED | REJECTED | CANCELLED)
- rejectionReason
- createdAt, updatedAt
```

## Demo Credentials

After setup, create these demo accounts:

| Email | Password | Role |
|-------|----------|------|
| user@example.com | password | USER |
| admin@example.com | password | ROOM_ADMIN |
| system@example.com | password | SYSTEM_ADMIN |

## Features Walkthrough

### Booking a Room (User)
1. Login as a user
2. Go to "Browse Rooms"
3. Select a room and view its availability
4. Fill in the booking form with meeting details
5. Submit booking (goes to "PENDING" status)
6. Wait for Room Admin approval
7. Receive email notification when approved/rejected

### Approving Bookings (Room Admin)
1. Login as Room Admin
2. Go to "Approve Bookings"
3. Review pending booking requests for your rooms
4. Click "Approve" or "Reject" with reason
5. System sends notification email to the user

### System Administration (System Admin)
1. Login as System Admin
2. Access Dashboard to view statistics
3. Manage Users (create, assign roles)
4. Manage All Rooms (create, delete, assign admins)
5. Review all pending bookings system-wide

## Customization

### Adding Amenities
Edit the amenities list when creating/updating a room. Common amenities:
- Projector
- Whiteboard
- Video Conference
- Printer
- Coffee Machine
- TV Screen

### Email Templates
Customize email templates in `lib/email.ts`

### Styling
Modify Tailwind CSS configuration in `tailwind.config.ts` or add custom styles in `app/globals.css`

## Production Deployment

### Pre-deployment Checklist
1. Update `.env` with production values
2. Set strong `NEXTAUTH_SECRET`
3. Configure email service credentials
4. Run `npm run build` to test build
5. Use a production database
6. Set up HTTPS/SSL

### Build for Production
```bash
npm run build
npm start
```

## Troubleshooting

### Database Connection Issues
- Verify MySQL is running
- Check DATABASE_URL format
- Ensure database exists: `CREATE DATABASE meetingroom;`

### Email Not Sending
- Verify email credentials in `.env.local`
- Check SMTP settings match your email provider
- For Gmail, use App Password (not regular password)

### NextAuth Errors
- Regenerate `NEXTAUTH_SECRET`: `openssl rand -base64 32`
- Verify `NEXTAUTH_URL` matches your domain

### Prisma Issues
```bash
# Regenerate Prisma client
npx prisma generate

# Reset database (WARNING: deletes all data)
npx prisma migrate reset
```

## Performance Tips

1. **Image Optimization**: Use proper image dimensions for room photos
2. **Database Indexes**: Prisma handles common indexes automatically
3. **API Response Caching**: Rooms list updates rarely, consider caching
4. **Email Queue**: For high-volume deployments, implement job queue for emails

## Security Considerations

- Passwords are hashed with bcryptjs
- NextAuth.js handles session management
- Role-based access control on all endpoints
- Input validation on all API routes
- CORS headers configured in Next.js

## Support & Maintenance

- Review logs regularly
- Monitor database size
- Archive old bookings periodically
- Update dependencies: `npm update`
- Keep Node.js and npm updated

## License

ISC

## Author

Meeting Room Booking System v1.0.0

---

**Last Updated**: 21 September 2026
