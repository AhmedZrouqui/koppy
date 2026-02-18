import { type ActionFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { updateShopPlan } from "~/services/billing.server";

export const action = async ({ request }: ActionFunctionArgs) => {
  const { topic, shop, session, payload } = await authenticate.webhook(request);

  if (topic === "APP_SUBSCRIPTIONS_UPDATE") {
    // payload is AppSubscription
    // We need to parse the payload to match it to our internal plan keys
    // The payload structure depends on API version, but generally contains name and status.
    
    // Simple logic: check the active line item
    const lineItem = payload.app_subscription?.line_items?.[0];
    const planName = lineItem?.plan?.pricing_details?.price === "2.99" ? "STARTER" :
                     lineItem?.plan?.pricing_details?.price === "4.99" ? "GROWTH" :
                     lineItem?.plan?.pricing_details?.price === "9.99" ? "UNLIMITED" : null;

    if (planName) {
        await updateShopPlan(shop, planName);
    } else {
        // If canceled or expired, might want to set to a default or handling
        // For now we just track active upgrades.
        // If status is CANCELLED, we might want to downgrade to free/trial logic or block access.
        // But for this task, we focus on tracking the plan.
    }
  }

  return new Response();
};
