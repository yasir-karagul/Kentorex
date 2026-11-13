export function getClientIp(request: Request): string {
  const vercelIp = request.headers.get("x-vercel-forwarded-for");
  if (vercelIp) return vercelIp.split(",")[0].trim();
  const cloudflareIp = request.headers.get("cf-connecting-ip");
  if (cloudflareIp) return cloudflareIp.trim();
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",").pop()?.trim() || "unknown";
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
