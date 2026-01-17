import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isStaticAsset =
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/icons/") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.json" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    /\.(png|svg|jpg|jpeg|webp|gif|ico|css|js|map)$/.test(pathname);

  if (isStaticAsset) {
    return response;
  }

  const isAuthCallback = pathname === "/auth/callback";
  const isPolicyPath = pathname.startsWith("/policy");
  if (!user && pathname !== "/login" && !isAuthCallback && !isPolicyPath) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  const isAdminPath = pathname.startsWith("/admin");
  const isAdminAccess = pathname === "/admin/access";
  if (user && isAdminPath && !isAdminAccess) {
    const adminAccess = request.cookies.get("admin_access")?.value;
    if (adminAccess !== "1") {
      const redirectUrl = request.nextUrl.clone();
      redirectUrl.pathname = "/admin/access";
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }
  }

  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|api).*)"],
};
