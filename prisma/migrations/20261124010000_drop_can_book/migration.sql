-- Booking is open to every user again (23 Nov per-department booker limit withdrawn).
ALTER TABLE `users` DROP COLUMN `canBook`;
