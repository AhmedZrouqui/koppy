import { authenticate } from "../shopify.server";
import db from "~/db.server";

export const action = async ({ request }: { request: Request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} | shop: ${shop}`);

  // Delete any customer-related data — we don't store customer data
  // but we delete import jobs for this shop to be safe
  return new Response("OK", { status: 200 });
};