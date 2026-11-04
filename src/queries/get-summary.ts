import { getSabreLegacy } from "@/lib/sabre/client";

export interface SummaryOptions {
  date: string
  pcc?: string
  airline?: {
    code?: string
    number?: string
  }
  settlementType?: 'TAT' | 'TCH' | 'TKT'
  documentType?: 'TKT' | 'EMD' | 'RFEMD' | 'RFND' | 'MCO'
  documentNumber?: string
}

export async function getSummary({ date, pcc }: SummaryOptions) {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.dailySales.summary({ date, pcc });
    return response;
  } catch (e) {
    console.error("Failed to get booking:", e);
    throw e;
  }
}