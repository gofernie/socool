import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  // Only rewrite / and /explore
  if (pathname !== "/" && pathname !== "/explore") {
    return next();
  }

  // Fetch agent template
  let template = "brutal";
  try {
    const res = await fetch(`${context.url.origin}/api/agent-page?slug=chris-crump`);
    const json = await res.json();
    template = json?.data?.template || "brutal";
  } catch {}

  if (pathname === "/") {
    const target = template === "calm" ? "/calm" : "/brutal";
    return context.rewrite(target);
  }

  if (pathname === "/explore") {
    const target = template === "calm"
      ? `/explore-calm${search}`
      : `/explore-brutal${search}`;
    return context.rewrite(target);
  }

  return next();
});