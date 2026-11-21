import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { vi } from "vitest";
import { AuthDialog } from "../src/components/AuthDialog";
import { AuthProvider } from "../src/context/auth";

export type Handler = (req: { method: string; path: string; body: unknown }) => { status?: number; body: unknown } | undefined;

/**
 * Replace fetch with a tiny fake server. Handlers are tried in order; the first that returns
 * a response wins. Every call is recorded in `calls` so tests can check what was sent.
 */
export function mockApi(...handlers: Handler[]) {
  const calls: { method: string; path: string; body: unknown }[] = [];
  const fetchMock = vi.fn(async (url: string, init: RequestInit = {}) => {
    const method = (init.method ?? "GET").toUpperCase();
    const path = url.replace(/^\/api/, "");
    const body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    calls.push({ method, path, body });
    for (const h of handlers) {
      const res = h({ method, path, body });
      if (res) {
        return new Response(JSON.stringify(res.body), { status: res.status ?? 200, headers: { "Content-Type": "application/json" } });
      }
    }
    return new Response(JSON.stringify({ message: `No mock for ${method} ${path}` }), { status: 404, headers: { "Content-Type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

/**
 * Render a page inside the same providers the app uses, at a given URL.
 * `layout` wraps the routes the way App.tsx does (e.g. <RequireUser /> for signed-in pages).
 */
export function renderPage(path: string, routes: { path: string; element: ReactNode }[], layout?: ReactNode) {
  const pages = routes.map((r) => <Route key={r.path} path={r.path} element={r.element} />);
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <Routes>{layout ? <Route element={layout}>{pages}</Route> : pages}</Routes>
          <AuthDialog />
        </MemoryRouter>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

export const customer = {
  id: 7,
  name: "Priya Raman",
  email: "priya@example.com",
  phone: "9876543210",
  role: "CUSTOMER",
  mustChangePassword: false,
  createdAt: "2026-11-01T00:00:00.000Z",
};

export const signedInAs =
  (user: unknown): Handler =>
  ({ method, path }) =>
    method === "GET" && path === "/auth/me" ? { body: { user } } : undefined;
