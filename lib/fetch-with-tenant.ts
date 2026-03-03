/**
 * Get the x-franqueadora-id header value from localStorage.
 * Works in both client components and standalone fetch calls.
 */
export function getFranqueadoraHeaders(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const active = localStorage.getItem("active_franqueadora_id");
  if (active) return { "x-franqueadora-id": active };
  return {};
}

/**
 * Enhanced fetch that automatically includes the x-franqueadora-id header.
 */
export async function fetchWithTenant(
  url: string,
  options?: RequestInit
): Promise<Response> {
  const tenantHeaders = getFranqueadoraHeaders();
  const mergedHeaders = {
    ...tenantHeaders,
    ...(options?.headers || {}),
  };

  return fetch(url, {
    ...options,
    headers: mergedHeaders,
  });
}
