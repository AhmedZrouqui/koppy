import { type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateShopPlan } from "~/services/billing.server";
import type { PlanKey } from "~/services/billing.plan";
import db from "~/db.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
    const subscription = payload.app_subscription;
    const status = subscription?.status;

    // Match by name instead of price — more reliable
    const rawName = subscription?.name?.toUpperCase() as PlanKey;

    console.log(`[webhook] shop: ${shop} | plan: ${rawName} | status: ${status}`);

    if (status === "ACTIVE" && rawName) {
      await updateShopPlan(shop, rawName);
    }

    if (["CANCELLED", "EXPIRED", "DECLINED", "FROZEN"].includes(status)) {
      await db.shopSubscription.update({
        where: { shop },
        data: { plan: "TRIAL_EXPIRED" },
      });
    }
  }

  return new Response("OK", { status: 200 });
};