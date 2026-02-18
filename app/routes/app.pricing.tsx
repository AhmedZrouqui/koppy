import { json, type LoaderFunctionArgs, type ActionFunctionArgs } from "@remix-run/node";
import { useLoaderData, useSubmit, useNavigation } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, BlockStack,
  Box, Badge, Grid, Divider, Banner,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { getShopSubscription, updateShopPlan } from "~/services/billing.server";
import { getTranslations } from "~/services/i18n.server";
import { PLANS, type PlanKey } from "~/services/billing.plan";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const t = getTranslations(request, (session as any).locale);

  const subscription = await getShopSubscription(session.shop);
  const currentPlan = (subscription.plan as PlanKey) ?? "TRIAL";
  const trialEndsAt = subscription.trialEndsAt?.toISOString() ?? null;

  return json({ currentPlan, trialEndsAt, t });
};

// export const action = async ({ request }: ActionFunctionArgs) => {
//   const { session, billing } = await authenticate.admin(request);
//   const formData = await request.formData();
//   const planKey = formData.get("plan") as PlanKey;
//   const planConfig = PLANS[planKey];
//   const billingKey = planConfig?.billingKey;

//   if (!planConfig || !planConfig.billingKey) {
//     return json({ error: "Invalid plan" });
//   }

//   if (!billingKey) return json({ error: "Invalid plan" });

//   await billing.request({
//     plan: billingKey as "starter" | "growth" | "unlimited",
//     isTest: true,
//     returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/pricing`,
//   });

//   return null;
// };

export const action = async ({ request }: ActionFunctionArgs) => {
  const { session, billing } = await authenticate.admin(request);
  const formData = await request.formData();
  const planKey = (formData.get("plan") as string)?.toUpperCase() as PlanKey;
  const planConfig = PLANS[planKey];
  const billingKey = planConfig?.billingKey;

  console.log("=== BILLING DEBUG ===");
  console.log("planKey received:", planKey);
  console.log("planConfig:", planConfig);
  console.log("billingKey:", billingKey);

  if (!planConfig || !billingKey) {
    return json({ error: "Invalid plan" });
  }

  if (process.env.NODE_ENV === "development") {
    await updateShopPlan(session.shop, planKey);
    return json({ success: true, plan: planKey });
  }

  try {
    await billing.request({
      plan: billingKey as "starter" | "growth" | "unlimited",
      returnUrl: `https://${session.shop}/admin/apps/${process.env.SHOPIFY_API_KEY}/app/pricing`,
    });
  } catch (err: any) {
    console.error("=== BILLING ERROR DETAIL ===");
    console.error("message:", err.message);
    console.error("cause:", err.cause);
    console.error("response:", err.response);
    console.error("full:", JSON.stringify(err, null, 2));
    throw err;
  }

  return null;
};

export default function PricingPage() {
  const { currentPlan, trialEndsAt, t } = useLoaderData<typeof loader>();
  const submit = useSubmit();
  const nav = useNavigation();

  const isLoading = nav.state === "submitting";
  const isTrialExpired = currentPlan === "TRIAL_EXPIRED";
  const isTrial = currentPlan === "TRIAL";

  const trialEndDate = trialEndsAt
    ? new Date(trialEndsAt).toLocaleDateString(undefined, { month: "long", day: "numeric", year: "numeric" })
    : null;

  const handleSelectPlan = (planKey: string) => {
    submit({ plan: planKey }, { method: "POST" });
  };

  return (
    <Page title="Plans & Pricing">
      <Layout>
        {/* Trial expired warning — shown above plans */}
        {isTrialExpired && (
          <Layout.Section>
            <Banner tone="critical" title="Your free trial has expired">
              <Text as="p">
                Your imports are paused. Subscribe to a plan below to continue importing products.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Grid>
            {(Object.keys(PLANS) as PlanKey[])
              .filter((k) => k !== "TRIAL" && k !== "TRIAL_EXPIRED")
              .map((key) => {
                const plan = PLANS[key];
                const isCurrent = currentPlan === key;

                return (
                  <Grid.Cell key={key} columnSpan={{ xs: 6, sm: 6, md: 4, lg: 4, xl: 4 }}>
                    <Card>
                      <BlockStack gap="400">
                        <Box padding="200">
                          <BlockStack gap="200" align="center">
                            <Text as="h2" variant="headingLg">{plan.label}</Text>
                            <Text as="h3" variant="heading3xl">
                              ${plan.price}
                              <Text as="span" variant="bodyMd" tone="subdued">/mo</Text>
                            </Text>
                          </BlockStack>
                        </Box>

                        <Divider />

                        <Box padding="400" minHeight="100px">
                          <BlockStack gap="300">
                            <Text as="p" variant="bodyMd">
                              Built for stores needing up to{" "}
                              <strong>{plan.limit === Infinity ? "Unlimited" : plan.limit}</strong>{" "}
                              product imports per month.
                            </Text>
                            {plan.limit === Infinity && (
                              <Badge tone="success">Best Value</Badge>
                            )}
                          </BlockStack>
                        </Box>

                        <Button
                          variant={isCurrent ? "secondary" : "primary"}
                          disabled={isCurrent}
                          onClick={() => handleSelectPlan(key)}
                          loading={isLoading}
                          fullWidth
                        >
                          {isCurrent ? "Current Plan" : isTrialExpired ? "Subscribe Now" : "Subscribe"}
                        </Button>
                      </BlockStack>
                    </Card>
                  </Grid.Cell>
                );
              })}
          </Grid>
        </Layout.Section>

        {/* Active trial notice */}
        {isTrial && trialEndDate && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <Text as="h2" variant="headingMd">Free Trial Active</Text>
                <Text as="p">
                  Your free trial ends on <strong>{trialEndDate}</strong>. Subscribe to a plan above
                  to keep importing after it expires. You won't be charged until then.
                </Text>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}