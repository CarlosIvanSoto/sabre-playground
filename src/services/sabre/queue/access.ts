'use server'

import { getSabreLegacy } from "@/lib/sabre/client";
import { QueueAccessOptions, QueueAccessResponse } from "sabre-legacy-client";


export async function getQueueAccess(request: QueueAccessOptions): Promise<QueueAccessResponse> {
  const { pcc, number } = request;
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.queue.access({ pcc, number });
    // await sabre.queue.exit()
    return response;
  } catch (e) {
    console.error("Failed to access queue:", e);
    throw e;
  }
}

export interface QueueRemoveResponse extends QueueAccessResponse { }

export async function getQueueRemove(): Promise<QueueRemoveResponse> {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.queue.remove();
    return response;
  } catch (e) {
    console.error("Failed to remove pnr from queue:", e);
    throw e;
  }
}

export interface QueueIgnoreResponse extends QueueAccessResponse { }

export async function getQueueIgnore(): Promise<QueueIgnoreResponse> {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.queue.ignore();
    return response;
  } catch (e) {
    console.error("Failed to ignore pnr in queue:", e);
    throw e;
  }
}

export interface BookingText {
  text: string[]
}
export interface QueueExitResponse {
  paragraph: BookingText
}

export async function getQueueExit(): Promise<QueueExitResponse> {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.queue.exit();
    return response;
  } catch (e) {
    console.error("Failed to exit queue:", e);
    throw e;
  }
}