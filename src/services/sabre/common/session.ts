'use server'
import { cookies } from "next/headers";

export async function reloadSession() {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get("sessionToken")?.value;
  if (!sessionToken) {
    throw new Error("No session token found");
  }
  const { token } = JSON.parse(sessionToken);
  const sessionTime = 10 * 60; // 10 minutos en segundos (600)
  const expiresAt = Date.now() + sessionTime * 1000;

  const sessionData = JSON.stringify({
    token,
    expiresAt
  });

  cookieStore.set({
    name: 'sessionToken',
    value: sessionData,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: sessionTime,
  });
}