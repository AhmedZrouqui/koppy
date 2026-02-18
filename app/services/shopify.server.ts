import sharp from "sharp";

const SHOPIFY_API_VERSION = "2026-01";

// Exponential backoff for rate limits
async function shopifyGraphQL(admin: any, query: string, variables: any, retries = 5): Promise<any> {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await admin.graphql(query, { variables });
    const json = await response.json();

    // Check for rate limit errors
    const isThrottled = json.errors?.some((e: any) => e.extensions?.code === "THROTTLED");
    if (isThrottled) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s...
      console.debug(`[shopify] Rate limited. Retrying in ${delay}ms...`);
      await new Promise((r) => setTimeout(r, delay));
      continue;
    }

    return json;
  }
  throw new Error("Max retries exceeded due to rate limiting");
}

export async function uploadImageToShopify(admin: any, imageUrl: string): Promise<string> {
  // Step 1: Download and optimize the image (JPEG — universally supported by Shopify)
  const imageResponse = await fetch(imageUrl);
  if (!imageResponse.ok) {
    throw new Error(`Failed to download image: ${imageResponse.status}`);
  }
  const inputBuffer = await imageResponse.arrayBuffer();
  const optimizedBuffer = await sharp(Buffer.from(inputBuffer))
    .resize(2000, 2000, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 85 }) // JPEG instead of WebP — Shopify processes JPEG reliably
    .toBuffer();

  const fileSize = String(optimizedBuffer.byteLength);

  // Step 2: Create a staged upload target with correct fileSize and httpMethod
  const STAGED_UPLOAD_MUTATION = `#graphql
    mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets {
          url
          resourceUrl
          parameters { name value }
        }
        userErrors { field message }
      }
    }`;

  const json = await shopifyGraphQL(admin, STAGED_UPLOAD_MUTATION, {
    input: [{
      filename: "product-image.jpg",
      mimeType: "image/jpeg",
      fileSize,
      resource: "PRODUCT_IMAGE",
      httpMethod: "PUT",
    }],
  });

  if (json.data?.stagedUploadsCreate?.userErrors?.length > 0) {
    throw new Error(json.data.stagedUploadsCreate.userErrors[0].message);
  }

  const target = json.data.stagedUploadsCreate.stagedTargets[0];

  // Step 3: Upload the image buffer via PUT (Shopify S3 targets require PUT, not POST)
  const uploadResponse = await fetch(target.url, {
    method: "PUT",
    headers: {
      "Content-Type": "image/jpeg",
      "Content-Length": fileSize,
    },
    body: new Uint8Array(optimizedBuffer), // Uint8Array is a valid BodyInit in all environments
  });

  if (!uploadResponse.ok) {
    throw new Error(`Staged upload failed: ${uploadResponse.status}`);
  }

  return target.resourceUrl;
}

export async function createProductInShopify(
  admin: any,
  productData: any,
  resourceUrls: string[],
  locationId: string,
): Promise<string> {
  const PRODUCT_CREATE_MUTATION = `#graphql
    mutation productCreate($product: ProductCreateInput!, $media: [CreateMediaInput!]) {
      productCreate(product: $product, media: $media) {
        product {
          id
          title
          variants(first: 100) {
            edges { node { id title } }
          }
        }
        userErrors { field message }
      }
    }`;

  // Build options for the product
  const hasRealOptions =
    productData.options?.length > 0 &&
    !(productData.options.length === 1 && productData.options[0].name === "Title");

  const productInput: any = {
    title: productData.title,
    descriptionHtml: productData.descriptionHtml,
    vendor: productData.vendor,
  };

  if (hasRealOptions) {
    productInput.productOptions = productData.options.map((opt: any) => ({
      name: opt.name,
      values: opt.values.map((v: string) => ({ name: v })),
    }));
  }

  const mediaInput = resourceUrls.map((url) => ({
    alt: productData.title,
    mediaContentType: "IMAGE",
    originalSource: url,
  }));

  const json = await shopifyGraphQL(admin, PRODUCT_CREATE_MUTATION, {
    product: productInput,
    media: mediaInput,
  });

  const { product, userErrors } = json.data.productCreate;
  if (userErrors?.length > 0) throw new Error(userErrors[0].message);

  // Now create variants if there are real options
  if (hasRealOptions && productData.variants?.length > 0) {
    await createVariants(admin, product.id, productData.variants, locationId);
  }

  return product.id;
}

async function createVariants(admin: any, productId: string, variants: any[], locationId: string) {
  const VARIANTS_CREATE_MUTATION = `#graphql
    mutation productVariantsBulkCreate($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
      productVariantsBulkCreate(productId: $productId, variants: $variants) {
        productVariants { id title }
        userErrors { field message }
      }
    }`;

  const variantInput = variants.map((v: any) => ({
    price: v.price,
    sku: v.sku,
    optionValues: Object.values(v.options)
      .filter(Boolean)
      .map((val) => ({ name: val as string })),
    inventoryQuantities: [{
      availableQuantity: v.inventoryQuantity ?? 0,
      locationId: locationId,
    }],
  }));

  const json = await shopifyGraphQL(admin, VARIANTS_CREATE_MUTATION, {
    productId,
    variants: variantInput,
  });

  const { userErrors } = json.data.productVariantsBulkCreate;
  if (userErrors?.length > 0) console.error("Variant errors:", userErrors);
}

export async function getPrimaryLocationId(admin: any): Promise<string> {
  const json = await shopifyGraphQL(admin, `#graphql
    query { locations(first: 1) { edges { node { id } } } }
  `, {});
  return json.data.locations.edges[0].node.id;
}