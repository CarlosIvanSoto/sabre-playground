import { NextResponse, type NextRequest } from "next/server";

export function checkSession(request: NextRequest) {
  let sabreResponse = NextResponse.next({
    request
  })
  const sessionToken = request.cookies.get('sessionToken')
  // const sessionData = JSON.parse(sessionToken?.value || '{}')
  // const sabre = new SabreLegacy({
  //   token: sessionData.token
  // })

  if (
    !sessionToken &&
    request.nextUrl.pathname.startsWith('/sabre') &&
    request.nextUrl.pathname !== '/sabre'
  ) {
    console.log("No session token found, redirecting to /sabre")
    const url = request.nextUrl.clone()
    url.pathname = '/sabre'
    return NextResponse.redirect(url)
  }

  return sabreResponse
}