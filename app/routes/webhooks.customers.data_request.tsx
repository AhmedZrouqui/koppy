import { authenticate } from "../shopify.server";

export const action = async ({ request }: { request: Request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} | shop: ${shop}`);
  // Log the request — no personal data stored beyond sessions
  return new Response("OK", { status: 200 });
};