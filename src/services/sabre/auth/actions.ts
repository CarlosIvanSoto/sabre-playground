'use server'

import { getSabreLegacy } from "@/lib/sabre/client";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

interface CreateSessionOptions {
  username: string;
  password: string;
  organization: string;
  domain?: string;
}

export async function createSession(options: CreateSessionOptions) {
  console.log("Creating session...", options)
  const cookieStore = await cookies();
  const sabre = await getSabreLegacy({
    username: options.username,
    password: options.password,
    organization: options.organization,
  })
  try {
    const response = await sabre.authentication.sessionCreate()
    console.log("Session created successfully:", response)
  } catch (e) {
    console.error("Failed to create session:", e)
    throw e
  }
  const sessionToken = sabre.getAuthorization()
  const sessionTime = 10 * 60; // 10 minutos en segundos (600)
  const expiresAt = Date.now() + sessionTime * 1000;

  const sessionData = JSON.stringify({
    token: sessionToken,
    expiresAt: expiresAt
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

export async function refreshSession() {
  const cookieStore = await cookies();
  const sabre = await getSabreLegacy()
  try {
    const response = await sabre.authentication.ping()
    console.log("Session refreshed successfully:", response)
  } catch (e) {
    console.error("Failed to refresh session:", e)
    throw e
  }
  const sessionToken = sabre.getAuthorization()
  const sessionTime = 10 * 60; // 10 minutos en segundos (600)
  const expiresAt = Date.now() + sessionTime * 1000;

  const sessionData = JSON.stringify({
    token: sessionToken,
    expiresAt: expiresAt
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

export async function closeSession() {
  const cookieStore = await cookies();
  const sabre = await getSabreLegacy()

  try {
    // Only attempt to close if we can initialize the client (which implies we have a token)
    if (sabre) {
      await sabre.authentication.sessionClose()
      console.log("Session closed successfully")
    }
  } catch (e) {
    console.error("Failed to close session cleanly:", e)
  }

  cookieStore.delete("sessionToken")
  redirect("/sabre")
}