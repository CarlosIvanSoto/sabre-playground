import { getSabreLegacy } from "@/lib/sabre/client";
import { reloadSession } from "../common/session";

export interface QueueCountFilterRequest {
  limit?: number
  offset?: number
  pcc: string
}

export interface QueueCountFilterResponse {
  queueIdentifier: {
    number: string
    count: string
  }[]
}

export async function countFilter({ limit, offset, pcc }: QueueCountFilterRequest): Promise<QueueCountFilterResponse> {
  const sabre = await getSabreLegacy();
  try {
    const response = await sabre.queue.count(pcc);
    const { queueInfo } = response;
    if (!queueInfo.queueIdentifier) return { queueIdentifier: [] }

    const queues = Array.isArray(queueInfo.queueIdentifier) ? queueInfo.queueIdentifier : [queueInfo.queueIdentifier]
    const queuesFiltered = queues.filter(q => {
      const num = Number(q.number)
      if (Number.isNaN(num)) return false
      if (offset && num < offset) return false
      if (limit && num > limit) return false
      return true
    })
    return { queueIdentifier: queuesFiltered }
  } catch (error) {
    console.error(error)
    return { queueIdentifier: [] }
  }
}