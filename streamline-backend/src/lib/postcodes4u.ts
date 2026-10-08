export type PostcodeAddressSummary = {
  id: string;
  label: string;
};

export type PostcodeAddress = {
  label: string;
  addressLine1: string;
  addressLine2: string;
  townCity: string;
  county: string;
  postcode: string;
};

export class PostcodeLookupError extends Error {
  constructor(message: string, public readonly status: number = 502) {
    super(message);
    this.name = "PostcodeLookupError";
  }
}

type JsonObject = Record<string, unknown>;

function object(value: unknown): JsonObject {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as JsonObject)
    : {};
}

function text(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

export function normaliseLookupPostcode(value: string): string {
  const compact = value.toUpperCase().replace(/\s+/g, "");
  if (!/^(GIR0AA|[A-Z]{1,2}\d[A-Z\d]?\d[A-Z]{2})$/.test(compact)) {
    throw new PostcodeLookupError("Enter a full valid UK postcode.", 400);
  }
  return `${compact.slice(0, -3)} ${compact.slice(-3)}`;
}

async function request(
  operation: "ByPostcode" | "ById",
  parameter: "postcode" | "id",
  value: string
): Promise<JsonObject> {
  const username = process.env.POSTCODES4U_USERNAME?.trim();
  const key = process.env.POSTCODES4U_API_KEY?.trim();
  if (!username || !key) {
    throw new PostcodeLookupError(
      "Address lookup is unavailable. Please enter the address manually.",
      503
    );
  }

  const url = new URL(`https://services.3xsoftware.co.uk/Search/${operation}/json`);
  url.searchParams.set("username", username);
  url.searchParams.set("key", key);
  url.searchParams.set(parameter, value);
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "error",
      headers: { Accept: "application/json" },
    });
    if (!response.ok) throw new Error("Provider request failed");
    const data = object(await response.json());
    // Never expose upstream errors or request URLs: they may contain credentials.
    if (data.Error || data.Errors || data.error || data.Message || data.message) {
      throw new Error("Provider returned an error");
    }
    return data;
  } catch {
    throw new PostcodeLookupError(
      "Address lookup is unavailable. Please enter the address manually."
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchPostcodeAddresses(
  postcode: string
): Promise<{ postcode: string; addresses: PostcodeAddressSummary[] }> {
  const normalised = normaliseLookupPostcode(postcode);
  const data = await request("ByPostcode", "postcode", normalised);
  if (!Array.isArray(data.Summaries)) {
    if (data.Summaries === null) return { postcode: normalised, addresses: [] };
    throw new PostcodeLookupError("The address service returned an invalid result.");
  }
  const addresses: PostcodeAddressSummary[] = [];
  const seen = new Set<string>();
  for (const item of data.Summaries) {
    const summary = object(item);
    const id = String(summary.Id ?? "");
    const label = [text(summary.StreetAddress), text(summary.Place)]
      .filter(Boolean)
      .join(", ");
    if (/^\d{1,15}$/.test(id) && label && !seen.has(id)) {
      seen.add(id);
      addresses.push({ id, label });
    }
  }
  if (data.Summaries.length > 0 && addresses.length === 0) {
    throw new PostcodeLookupError("The address service returned an invalid result.");
  }
  return { postcode: normalised, addresses };
}

export async function getPostcodeAddress(id: string): Promise<PostcodeAddress> {
  if (!/^\d{1,15}$/.test(id)) {
    throw new PostcodeLookupError("Select an address from the search results.", 400);
  }
  const data = await request("ById", "id", id);
  const address = object(data.Address);
  if (String(address.AddressId ?? "") !== id) {
    throw new PostcodeLookupError("That address could not be retrieved.");
  }
  const lines = [
    text(address.StreetAddress1),
    text(address.StreetAddress2),
    text(address.StreetAddress3),
  ].filter(Boolean);
  const townCity = text(address.PostTown);
  const postcode = text(address.Postcode);
  if (!lines.length || !townCity || !postcode) {
    throw new PostcodeLookupError("The address service returned an incomplete address.");
  }
  return {
    label: [...lines, townCity, postcode].join(", "),
    addressLine1: lines[0],
    addressLine2: lines.slice(1).join(", "),
    townCity,
    county: text(address.PostalCounty) || text(address.County),
    postcode: normaliseLookupPostcode(postcode),
  };
}
