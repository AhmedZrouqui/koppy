export interface ScrapedProduct {
  title: string;
  descriptionHtml: string;
  vendor: string;
  sourceUrl: string;
  images: string[];
  variants: Array<{
    title: string;
    price: string;
    sku: string;
    inventoryQuantity: number;
    options: Record<string, string>;
  }>;
  options: Array<{
    name: string;
    values: string[];
  }>;
}

function normalizeShopifyUrl(input: string): string {
  const url = new URL(input.startsWith("http") ? input : `https://${input}`);
  return `${url.protocol}//${url.hostname}`;
}

function friendlyFetchError(status: number, context: "store" | "product"): string {
  if (status === 401 || status === 403) {
    return "This store is password-protected or private. Please make the store public before importing.";
  }
  if (status === 404) {
    return context === "product"
      ? "Product not found. Please check the URL and try again."
      : "Store not found. Please check the URL and try again.";
  }
  if (status === 429) {
    return "The store is rate-limiting requests. Please wait a moment and try again.";
  }
  if (status >= 500) {
    return "The store is currently unavailable. Please try again later.";
  }
  return `Unexpected error (HTTP ${status}). Please check the URL and try again.`;
}

async function safeFetch(url: string): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Accept: "application/json" },
    });
  } catch (err: any) {
    // Network-level error (DNS failure, connection refused, etc.)
    throw new Error(
      "Could not connect to this store. Please verify the URL is a valid, publicly accessible Shopify store."
    );
  }
  return response;
}

async function parseShopifyJson(response: Response, context: "store" | "product"): Promise<any> {
  if (!response.ok) {
    throw new Error(friendlyFetchError(response.status, context));
  }

  let data: any;
  try {
    data = await response.json();
  } catch {
    throw new Error(
      "This doesn't appear to be a public Shopify store. The URL returned an unexpected response."
    );
  }

  // Shopify stores always return { products: [...] } or { product: {...} }
  if (context === "store" && !Array.isArray(data?.products)) {
    throw new Error(
      "This doesn't appear to be a public Shopify store. Please enter a valid Shopify store URL (e.g. https://example.myshopify.com)."
    );
  }
  if (context === "product" && !data?.product) {
    throw new Error(
      "Product not found. Please check the URL and try again."
    );
  }

  return data;
}

// Fetch all products from a Shopify store using the public products.json API
export async function scrapeShopifyStore(storeUrl: string): Promise<ScrapedProduct[]> {
  const base = normalizeShopifyUrl(storeUrl);
  const products: ScrapedProduct[] = [];
  let page = 1;
  const limit = 250; // Max allowed by Shopify

  while (true) {
    const url = `${base}/products.json?limit=${limit}&page=${page}`;
    const response = await safeFetch(url);

    if (!response.ok) {
      if (page === 1) {
        throw new Error(friendlyFetchError(response.status, "store"));
      }
      break; // No more pages
    }

    const data = await parseShopifyJson(response, "store");
    if (!data.products || data.products.length === 0) break;

    for (const p of data.products) {
      products.push(mapShopifyProduct(p, base));
    }

    if (data.products.length < limit) break; // Last page
    page++;
  }

  if (products.length === 0) {
    throw new Error(
      "No products found in this store. The store may be empty or its catalog may not be publicly accessible."
    );
  }

  return products;
}

// Fetch a single product by handle or full URL
export async function scrapeSingleProduct(urlOrHandle: string): Promise<ScrapedProduct> {
  let base: string;
  let handle: string;

  if (urlOrHandle.includes("/products/")) {
    const url = new URL(urlOrHandle);
    base = `${url.protocol}//${url.hostname}`;
    handle = url.pathname.split("/products/")[1].split("?")[0];
  } else {
    throw new Error("URL must contain /products/ to import a single product.");
  }

  const response = await safeFetch(`${base}/products/${handle}.json`);
  const data = await parseShopifyJson(response, "product");
  return mapShopifyProduct(data.product, base);
}

function mapShopifyProduct(p: any, base: string): ScrapedProduct {
  return {
    title: p.title,
    descriptionHtml: p.body_html || "",
    vendor: p.vendor || "Imported",
    sourceUrl: `${base}/products/${p.handle}`,
    images: p.images.map((img: any) => img.src),
    options: p.options.map((opt: any) => ({
      name: opt.name,
      values: opt.values,
    })),
    variants: p.variants.map((v: any) => ({
      title: v.title,
      price: v.price,
      sku: v.sku || `IMP-${v.id}`,
      inventoryQuantity: v.inventory_quantity ?? 0,
      options: {
        option1: v.option1,
        option2: v.option2,
        option3: v.option3,
      },
    })),
  };
}