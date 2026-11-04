import 'server-only'
import { cookies } from "next/headers";
import { SabreLegacy, SabreOptions } from 'sabre-legacy-client';
import { Sabre } from 'sabre-client';
import { sabre_credentials } from '@/config/env';

let sabre: SabreLegacy | null = null;

interface SabreClientOptions {
  username?: string;
  password?: string;
  organization?: string;
}

export const getSabreLegacy = async (options?: SabreClientOptions) => {
  if (options) {
    sabre = new SabreLegacy(options)
    return sabre
  }
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;
  const sessionData = JSON.parse(sessionToken || "{}");
  if (!sabre) {
    sabre = new SabreLegacy({
      token: sessionData.token
    })
    return sabre
  }
  return sabre
}
export const getSabre = async (options?: SabreClientOptions) => {
  if (options) {
    return new Sabre(options)
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;
  if (token) {
    const sabre = new Sabre(sabre_credentials)
    sabre.setAuthorization(token)
    return sabre
  }
  const sabre = new Sabre(sabre_credentials)
  if (process.env.SABRE_TOKEN) {
    sabre.setAuthorization(process.env.SABRE_TOKEN)
  }
  return sabre
}