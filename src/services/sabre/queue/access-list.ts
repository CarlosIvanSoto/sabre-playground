import { getSabreLegacy } from "@/lib/sabre/client";

export interface GetPNRListRequest {
  number: string;
  pcc: string;
  primaryPassenger?: boolean
}
export interface GetPNRListResponse {
  list: {
    num: string
    bookingId: string
    placeBy: string
    date: string // YYYY-MM-DDTHH:MM
    name?: string
  }[]
}

export async function getPNRList({ number, pcc, primaryPassenger }: GetPNRListRequest): Promise<GetPNRListResponse> {
  const sabre = await getSabreLegacy();
  try {
    const { list } = await sabre.queue.accessList({
      number, pcc, primaryPassenger
    })
    return { list };
  } catch (e) {
    console.error("Failed to get PNR list:", e);
    throw e;
  }
}