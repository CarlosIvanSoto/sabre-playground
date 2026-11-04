import { getSabre } from "@/lib/sabre/client";

export async function getBooking({ bookingId }: { bookingId: string }) {
  const sabre = await getSabre();
  try {
    const response = await sabre.booking.get({
      confirmationId: bookingId
    });
    return response;
  } catch (e) {
    console.error("Failed to get booking:", e);
    throw e;
  }
}