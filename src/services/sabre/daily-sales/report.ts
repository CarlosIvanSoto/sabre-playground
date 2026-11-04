'use server'

import { getReport } from "@/queries/get-report";
import { DailySalesReportRS } from "sabre-legacy-client";

export interface DailySalesReportRequest {
  date: string
  pcc?: string
}

export async function getDailySalesReport({ date, pcc }: DailySalesReportRequest): Promise<DailySalesReportRS> {
  try {
    const response = await getReport({ date, pcc });
    return response;
  } catch (e) {
    console.error("Failed to get daily sales report:", e);
    throw e;
  }
}
