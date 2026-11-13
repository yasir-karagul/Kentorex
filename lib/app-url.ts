import { ServiceConfigurationError } from "./auth-errors";

export function getAppUrl(): URL {
  const value = process.env.APP_URL;
  if (!value) throw new ServiceConfigurationError("APP_URL must be set to the website origin.");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new ServiceConfigurationError("APP_URL must be set to the website origin.");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    !url.hostname ||
    url.username ||
    url.password ||
    url.pathname !== "/" ||
    url.search ||
    url.hash ||
    (process.env.NODE_ENV === "production" && url.protocol !== "https:")
  ) {
    throw new ServiceConfigurationError("APP_URL must be a website origin using HTTPS in production.");
  }
  return url;
}
