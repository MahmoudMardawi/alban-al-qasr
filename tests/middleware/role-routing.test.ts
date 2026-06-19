import { describe, it, expect } from "vitest";
import { decideRedirect } from "@/middleware-logic";

describe("decideRedirect", () => {
  it("unauth on protected route → /login", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: null })).toBe("/login");
    expect(decideRedirect({ pathname: "/", role: null })).toBe("/login");
  });

  it("unauth on /login → stays", () => {
    expect(decideRedirect({ pathname: "/login", role: null })).toBeNull();
  });

  it("admin landing on /login → /dashboard", () => {
    expect(decideRedirect({ pathname: "/login", role: "admin" })).toBe("/dashboard");
  });

  it("employee landing on /login → /", () => {
    expect(decideRedirect({ pathname: "/login", role: "employee" })).toBe("/");
  });

  it("admin on admin route → stays", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: "admin" })).toBeNull();
  });

  it("employee on /dashboard → /", () => {
    expect(decideRedirect({ pathname: "/dashboard", role: "employee" })).toBe("/");
  });

  it("admin on / → /dashboard (admin's home is dashboard)", () => {
    expect(decideRedirect({ pathname: "/", role: "admin" })).toBe("/dashboard");
  });

  it("employee on employee route → stays", () => {
    expect(decideRedirect({ pathname: "/", role: "employee" })).toBeNull();
  });
});
