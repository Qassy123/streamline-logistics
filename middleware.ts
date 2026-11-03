import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  const pathname=request.nextUrl.pathname;
  if(pathname==="/admin/login")return NextResponse.next();
  if(pathname==="/admin"||pathname.startsWith("/admin/")){
    if(/^as_[a-f0-9]{64}$/.test(request.cookies.get("streamline_admin_session")?.value||""))return NextResponse.next();
    const login=new URL("/admin/login",request.url);login.searchParams.set("next",pathname+request.nextUrl.search);return NextResponse.redirect(login);
  }
  if(["/account-recovery","/reset-password"].includes(pathname)&&request.nextUrl.searchParams.get("kind")==="staff")return NextResponse.next();
  // Email clients fetch the logo without website login credentials.
  if (request.nextUrl.pathname === "/email-logo.png") {
    return NextResponse.next();
  }

  const authHeader = request.headers.get("authorization");

  if (authHeader) {
    const authValue = authHeader.split(" ")[1];
    const [username, password] = atob(authValue).split(":");

    if (
      username === process.env.PREVIEW_USERNAME &&
      password === process.env.PREVIEW_PASSWORD
    ) {
      return NextResponse.next();
    }
  }

  return new NextResponse("Authentication required", {
    status: 401,
    headers: {
      "WWW-Authenticate": 'Basic realm="Streamline Preview"',
    },
  });
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|images|favicon.ico).*)",
  ],
};
