const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

const USER_AGENT = "Mozilla/5.0 (compatible; SynapseBot/1.0; +https://synapse.app/bot)";

interface ValidatedResource {
  title: string;
  url: string;
  type: string;
  description: string;
}

interface ValidationResult {
  url: string;
  live: boolean;
  status?: number;
  error?: string;
}

async function checkUrl(url: string): Promise<ValidationResult> {
  try {
    new URL(url);
  } catch {
    return { url, live: false, error: "invalid_url" };
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      method: "HEAD",
      headers: {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,*/*",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timeoutId);

    if (res.status === 405) {
      // Server doesn't allow HEAD — try GET with early abort
      const controller2 = new AbortController();
      const timeoutId2 = setTimeout(() => controller2.abort(), TIMEOUT_MS);
      try {
        const res2 = await fetch(url, {
          method: "GET",
          headers: { "User-Agent": USER_AGENT, "Range": "bytes=0-0" },
          signal: controller2.signal,
          redirect: "follow",
        });
        clearTimeout(timeoutId2);
        return { url, live: res2.status < 400 || res2.status === 416, status: res2.status };
      } catch {
        clearTimeout(timeoutId2);
        return { url, live: true, status: 405 };
      }
    }

    return { url, live: res.status < 400, status: res.status };
  } catch (err: any) {
    clearTimeout(timeoutId);
    if (err?.name === "AbortError") return { url, live: false, error: "timeout" };
    return { url, live: false, error: err?.message || "network_error" };
  }
}

export async function validateResources(resources: ValidatedResource[]): Promise<ValidatedResource[]> {
  if (!resources || resources.length === 0) return [];

  const results = await Promise.allSettled(resources.map(r => checkUrl(r.url)));
  const filtered: ValidatedResource[] = [];

  for (let i = 0; i < resources.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled" && result.value.live) {
      filtered.push(resources[i]);
    } else {
      const reason = result.status === "rejected" ? result.reason : result.value.error || `HTTP ${result.value.status}`;
      console.log(`[LinkValidator] Dead link removed: ${resources[i].url} (${reason})`);
    }
  }

  return filtered;
}

export async function validateAndRefreshResources(
  resources: ValidatedResource[],
  topicTitle: string,
  categoryName: string,
  difficulty: string,
  generateAlternatives: (count: number) => Promise<ValidatedResource[]>
): Promise<ValidatedResource[]> {
  const MIN_RESOURCES = 2;

  const validated = await validateResources(resources);

  if (validated.length >= MIN_RESOURCES) return validated;

  const needed = MIN_RESOURCES - validated.length;
  console.log(`[LinkValidator] Only ${validated.length} live links for ${topicTitle}/${difficulty}. Requesting ${needed} alternatives...`);

  const alternatives = await generateAlternatives(needed + 2);
  if (alternatives.length > 0) {
    const validatedAlternatives = await validateResources(alternatives);
    const combined = [...validated, ...validatedAlternatives].slice(0, 5);
    console.log(`[LinkValidator] Final: ${combined.length} live links for ${topicTitle}/${difficulty}`);
    return combined;
  }

  return validated;
}

export async function revalidateStoredContent(contentJson: any): Promise<{ content: any; changed: boolean }> {
  if (!contentJson?.externalResources?.length) return { content: contentJson, changed: false };

  const original = contentJson.externalResources;
  const validated = await validateResources(original);

  if (validated.length === original.length) return { content: contentJson, changed: false };

  return {
    content: { ...contentJson, externalResources: validated },
    changed: true,
  };
}
