/**
 * Rotas públicas — sem sessão, sem casca do painel.
 *
 * Fonte única: usada pelo `ProtectedRoute`, pelo `SubscriptionGuard` e pelo
 * `AppShell`. Antes cada arquivo tinha a própria lista, e isso deixou `/lp`
 * de fora de um deles.
 *
 * Regra do matcher: `"/"` casa só exato (senão tudo seria público); as demais
 * casam por prefixo, para cobrir subrotas (`/lp/obrigado`, `/termos/...`).
 */
export const PUBLIC_ROUTES = ["/", "/lp", "/login", "/privacidade", "/termos"] as const;

/**
 * Rotas públicas que também são renderizadas no servidor (HTML completo na
 * primeira resposta). Ficam de fora `/` e `/login`, que continuam atrás do gate
 * de hidratação como antes — mudar as duas telas de maior tráfego não faz parte
 * deste ajuste.
 */
export const SERVER_RENDERED_PUBLIC_ROUTES = ["/lp", "/privacidade", "/termos"] as const;

function matches(routes: readonly string[], pathname: string | null | undefined): boolean {
  if (!pathname) return false;

  return routes.some((route) =>
    route === "/" ? pathname === "/" : pathname === route || pathname.startsWith(`${route}/`),
  );
}

export function isPublicRoute(pathname: string | null | undefined): boolean {
  return matches(PUBLIC_ROUTES, pathname);
}

export function rendersOnServer(pathname: string | null | undefined): boolean {
  return matches(SERVER_RENDERED_PUBLIC_ROUTES, pathname);
}
