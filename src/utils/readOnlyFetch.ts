const WRITE_ROLES = new Set(["Admin", "Supervisor", "Staff"]);

/** Enforce read-only access for all page/controller writes, including RPCs. */
export function createReadOnlyFetch(baseFetch: typeof fetch, supabaseUrl: string, usersTable: string): typeof fetch {
  const apiOrigin = new URL(supabaseUrl).origin;
  return async (input, init) => {
    const request = new Request(input, init);
    const url = new URL(request.url);
    const isDataWrite = url.origin === apiOrigin &&
      (url.pathname.startsWith("/rest/v1/") || url.pathname.startsWith("/storage/v1/")) &&
      !["GET", "HEAD", "OPTIONS"].includes(request.method);

    if (isDataWrite) {
      const deny = (message: string) => new Response(JSON.stringify({
        code: "42501", message, details: null, hint: null,
      }), { status: 403, headers: { "Content-Type": "application/json" } });

      try {
        const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
        const payload = token.split(".")[1];
        const userId = payload ? JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/"))).sub : null;
        if (typeof userId !== "string") return deny("An active account is required to change records.");

        const profileUrl = new URL(`/rest/v1/${encodeURIComponent(usersTable)}`, supabaseUrl);
        profileUrl.search = new URLSearchParams({
          select: "role,status", user_uuid: `eq.${userId}`, order: "created_at.desc", limit: "1",
        }).toString();
        const profileResponse = await baseFetch(profileUrl, {
          headers: { Authorization: `Bearer ${token}`, apikey: request.headers.get("apikey") ?? "" },
          cache: "no-store", signal: request.signal,
        });
        if (!profileResponse.ok) return deny("Unable to verify permission to change records.");
        const profiles = await profileResponse.json() as Array<{ role: string; status: string | null }>;
        const profile = profiles[0];
        if (profile?.role === "Viewer") return deny("Viewer accounts have read-only access.");
        if (!profile || profile.status === "Inactive" || !WRITE_ROLES.has(profile.role)) {
          return deny("An active account with write access is required to change records.");
        }
      } catch {
        return deny("Unable to verify permission to change records.");
      }
    }
    return baseFetch(request);
  };
}
