import type { AppRole } from "@/lib/auth";

const ADMIN_PREFIXES = ["/dashboard", "/products", "/clients", "/expenses", "/production", "/reports", "/inventory", "/export", "/ai", "/users", "/activity"];
const EMPLOYEE_PREFIXES = ["/", "/client", "/visit", "/my-visits", "/profile"];

function isAdminRoute(pathname: string): boolean {
  return ADMIN_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
function isEmployeeRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  return EMPLOYEE_PREFIXES.some((p) => p !== "/" && (pathname === p || pathname.startsWith(p + "/")));
}

export function decideRedirect(args: { pathname: string; role: AppRole | null }): string | null {
  const { pathname, role } = args;

  if (pathname === "/login") {
    if (role === "admin")    return "/dashboard";
    if (role === "employee") return "/";
    return null;
  }

  if (role === null) return "/login";

  if (role === "admin") {
    if (pathname === "/") return "/dashboard";
    return null;
  }

  if (role === "employee") {
    if (isAdminRoute(pathname)) return "/";
    return null;
  }

  return null;
}
