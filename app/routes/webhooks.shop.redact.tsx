import { authenticate } from "../shopify.server";
import db from "~/db.server";

export const action = async ({ request }: { request: Request }) => {
  const { topic, shop } = await authenticate.webhook(request);
  console.log(`[webhook] ${topic} | shop: ${shop}`);

  // Shop uninstalled and requested data deletion — delete everything
  await db.importJob.deleteMany({ where: { shop } });
  await db.shopSubscription.deleteMany({ where: { shop } });
  await db.session.deleteMany({ where: { shop } });

  return new Response("OK", { status: 200 });
};