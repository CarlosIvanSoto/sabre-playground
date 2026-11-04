'use server'

import { getSummary } from "@/queries/get-summary";
import { DailySalesSummaryRS } from "sabre-legacy-client";

export interface DailySalesSummaryRequest {
  date: string
  pcc?: string
}

export async function getDailySalesSummary({ date, pcc }: DailySalesSummaryRequest): Promise<DailySalesSummaryRS> {
  try {
    const response = await getSummary({ date, pcc });
    return response;
  } catch (e) {
    console.error("Failed to get daily sales summary:", e);
    throw e;
  }
}
