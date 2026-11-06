// POST alias of DELETE /api/bookings/[id] (cancel): the production server blocks PUT and DELETE.
export { DELETE as POST } from "../route";
