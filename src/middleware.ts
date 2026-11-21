import { NextResponse, type NextRequest } from "next/server";

const SESSION_COOKIE = "campus_session";

/**
 * 页面级登录守卫：只判断 Cookie 是否存在（Edge 运行时无法查库）。
 * Cookie 的真实有效性由 tRPC Context 查 Session 表 + 过期时间兜底。
 * /api/*、静态资源与 /login 本身不拦截。
 */
export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);

  if (!hasSession && pathname !== "/login") {
    // 优先使用反向代理透传的公网 Host，避免 Next 用容器内部 hostname 生成跳转地址；
    // Next 15 的中间件跳转必须是绝对 URL，相对 Location 会在运行时抛 Invalid URL。
    const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
    const isLocalHost = host ? /^(localhost|127\.0\.0\.1)(:\d+)?$/i.test(host) : false;
    // 公网站点统一使用 https，避免反代透传的 x-forwarded-proto=http 造成降级跳转
    const proto = isLocalHost ? "http" : "https";
    const target = host ? new URL("/login", `${proto}://${host}`) : new URL("/login", req.url);
    return NextResponse.redirect(target, 307);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)"],
};
