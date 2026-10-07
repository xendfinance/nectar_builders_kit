import type { HttpMethod, TransportRequest } from "@/api/transport";

import type { RouteHandler } from "./http";

export interface Route {
  method: HttpMethod;
  /** Same template syntax as the catalog, e.g. `/orderbooks/:symbol`. */
  path: string;
  handler: RouteHandler;
}

interface CompiledRoute extends Route {
  pattern: RegExp;
  paramNames: string[];
}

export interface RouteMatch {
  handler: RouteHandler;
  params: Record<string, string>;
}

export function createRouter(routes: Route[]) {
  const compiled: CompiledRoute[] = routes.map((route) => {
    const paramNames: string[] = [];
    const source = route.path.replace(/:([A-Za-z]+)/g, (_, name: string) => {
      paramNames.push(name);
      return "([^/]+)";
    });
    return { ...route, pattern: new RegExp(`^${source}$`), paramNames };
  });

  return function match({ method, path }: Pick<TransportRequest, "method" | "path">): RouteMatch | undefined {
    for (const route of compiled) {
      if (route.method !== method) {
        continue;
      }
      const result = route.pattern.exec(path);
      if (!result) {
        continue;
      }
      const params = Object.fromEntries(
        route.paramNames.map((name, index) => [name, decodeURIComponent(result[index + 1] ?? "")])
      );
      return { handler: route.handler, params };
    }
    return undefined;
  };
}
