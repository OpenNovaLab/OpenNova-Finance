import { NextRequest, NextResponse } from "next/server"
import { verifySession } from "@/lib/access-session"

const ACCESS_COOKIE = "onf_access"

function isBypassEnabled(): boolean {
  return process.env.ACCESS_CONTROL_BYPASS === "true"
}

function isPublicPath(pathname: string): boolean {
  if (pathname === "/access") return true
  if (pathname.startsWith("/api/access/exchange")) return true
  if (pathname.startsWith("/api/access/logout")) return true
  if (pathname === "/api/health/convex") return true
  return false
}

/**
 * Routes de service du pont local Hermes : pas de session navigateur,
 * l'authentification se fait dans la route elle-même, par la clé de
 * service HERMES_BRIDGE_KEY (comparaison à temps constant). Seules ces
 * deux combinaisons méthode + chemin sont exemptées ; la lecture des
 * briefings pour l'interface (GET /api/hermes/briefings) reste protégée
 * par la session d'accès.
 */
function isServicePath(request: NextRequest): boolean {
  const { pathname } = request.nextUrl
  if (pathname === "/api/hermes/briefings" && request.method === "POST") return true
  if (pathname === "/api/hermes/snapshot" && request.method === "GET") return true
  return false
}

export async function middleware(request: NextRequest) {
  if (isBypassEnabled()) return NextResponse.next()

  const { pathname } = request.nextUrl
  if (isPublicPath(pathname)) return NextResponse.next()
  if (isServicePath(request)) return NextResponse.next()

  const isProd = process.env.NODE_ENV === "production"
  const secret = process.env.ACCESS_SESSION_SECRET
  if (isProd && !secret) {
    return NextResponse.redirect(new URL("/access?reason=config", request.url))
  }
  if (!secret) return NextResponse.next()

  const token = request.cookies.get(ACCESS_COOKIE)?.value
  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 })
    }
    return NextResponse.redirect(new URL("/access", request.url))
  }

  const session = await verifySession(token, secret)
  if (!session) {
    if (pathname.startsWith("/api/")) {
      const response = NextResponse.json({ ok: false, error: "session_expired" }, { status: 401 })
      response.cookies.delete(ACCESS_COOKIE)
      return response
    }
    const response = NextResponse.redirect(new URL("/access?reason=expired", request.url))
    response.cookies.delete(ACCESS_COOKIE)
    return response
  }

  return NextResponse.next()
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
