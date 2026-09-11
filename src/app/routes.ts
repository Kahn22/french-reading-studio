export type AppRoute =
  | { name: "home" }
  | { name: "library" }
  | { name: "read"; workId: string };

const safeId = /^[a-z0-9][a-z0-9_-]*$/;

export function parseRoute(hash: string): AppRoute {
  const path = hash.replace(/^#\/?/, "").replace(/\/$/, "");
  if (path === "library") return { name: "library" };
  const read = /^read\/([^/]+)$/.exec(path);
  if (read?.[1] && safeId.test(read[1])) return { name: "read", workId: read[1] };
  return { name: "home" };
}

export function routeHash(route: AppRoute): string {
  if (route.name === "library") return "#/library";
  if (route.name === "read") return `#/read/${route.workId}`;
  return "#/";
}
