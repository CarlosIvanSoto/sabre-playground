import { getBooking } from "@/services/sabre/booking/get-booking";

export default async function BookingPage({ params }: PageProps<'/sabre/booking/[bookingId]'>) {
  const { bookingId } = await params
  const booking = await getBooking({ bookingId });

  return (
    <div>
      <h1>Booking {bookingId}</h1>
      <pre>{JSON.stringify(booking, null, 2)}</pre>
    </div>
  )
}
