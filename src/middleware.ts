import { defineMiddleware } from "astro:middleware";

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname, search } = context.url;

  if (pathname !== "/" && pathname !== "/explore") {
    return next();
  }

  let template = "brutal";
  try {
    const res = await fetch(`${context.url.origin}/api/agent-page?slug=chris-crump`);
    const json = await res.json();
    template = json?.data?.template || "brutal";
  } catch {}

if (pathname === "/") {
    return context.rewrite(template === "calm" ? "/calm" : "/brutal");
  }

  if (pathname === "/explore") {
    return context.rewrite(template === "calm"
      ? `/explore-calm${search}`
      : `/explore-brutal${search}`
    );
  }

  return next();
});