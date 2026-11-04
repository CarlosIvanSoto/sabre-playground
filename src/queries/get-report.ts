import { getSabreLegacy } from "@/lib/sabre/client";

export interface ReportOptions {
  date: string
  pcc?: string
}

export async function getReport({ date, pcc }: ReportOptions) {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.dailySales.report({ date, pcc });
    return response;
  } catch (e) {
    console.error("Failed to get booking:", e);
    throw e;
  }
}