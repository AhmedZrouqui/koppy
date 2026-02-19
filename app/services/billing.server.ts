import db from "~/db.server";
import { PLANS, type PlanKey } from "~/services/billing.plan";

export class BillingError extends Error {
  constructor(
    public readonly plan: PlanKey,
    public readonly limit: number,
    public readonly used: number,
    public readonly requested: number,
  ) {
    super(
      `Import limit reached. Your ${PLANS[plan].label} plan allows ${limit} imports per month. ` +
      `You have used ${used} and are trying to import ${requested} more.`
    );
    this.name = "BillingError";
  }
}

// ---- Get or create subscription record ----
export async function getShopSubscription(shop: string) {
  let sub = await db.shopSubscription.findUnique({ where: { shop } });

  if (!sub) {
    const trialEndsAt = new Date();
    trialEndsAt.setDate(trialEndsAt.getDate() + 2); // 2-day trial

    sub = await db.shopSubscription.create({
      data: {
        shop,
        plan: "TRIAL",
        trialUsed: false,
        importCount: 0,
        periodStart: new Date(),
        trialEndsAt,
      },
    });
  }

  // Check if trial has expired — downgrade to block imports
  if (sub.plan === "TRIAL" && sub.trialEndsAt && new Date() > sub.trialEndsAt) {
    console.log("Trial has expired");
    sub = await db.shopSubscription.update({
      where: { shop },
      data: { trialUsed: true, plan: "TRIAL_EXPIRED" },
    });
  }

  // Reset import count if billing period has rolled over (30 days)
  const daysSincePeriodStart =
    (Date.now() - new Date(sub.periodStart).getTime()) / (1000 * 60 * 60 * 24);

  if (daysSincePeriodStart >= 30) {
    sub = await db.shopSubscription.update({
      where: { shop },
      data: {
        importCount: 0,
        periodStart: new Date(),
      },
    });
  }

  return sub;
}

// ---- Atomic check + increment — prevents race condition ----
export async function checkAndIncrementImportCount(shop: string, count: number): Promise<void> {
  const sub = await getShopSubscription(shop);
  const plan = (sub.plan as PlanKey) ?? "TRIAL";

  // Block expired trials entirely
  if (sub.plan === "TRIAL_EXPIRED") {
    throw new BillingError("TRIAL" as PlanKey, 0, 0, count);
  }

  const planConfig = PLANS[plan];
  const limit = planConfig.limit;

  if (limit === Infinity) return; // Unlimited — skip check

  const used = sub.importCount;

  // Atomic DB update — only succeeds if there's still room
  const result = await db.shopSubscription.updateMany({
    where: {
      shop,
      importCount: { lte: limit - count },
    },
    data: { importCount: { increment: count } },
  });

  if (result.count === 0) {
    throw new BillingError(plan, limit, used, count);
  }
}

// ---- Update plan (called from webhook or billing callback) ----
export async function updateShopPlan(shop: string, plan: PlanKey): Promise<void> {
  await db.shopSubscription.upsert({
    where: { shop },
    create: {
      shop,
      plan,
      trialUsed: plan !== "TRIAL",
      importCount: 0,
      periodStart: new Date(),
    },
    update: {
      plan,
      trialUsed: true,
      importCount: 0,
      periodStart: new Date(),
    },
  });
}

// ---- Mark trial as used ----
export async function markTrialUsed(shop: string): Promise<void> {
  await db.shopSubscription.update({
    where: { shop },
    data: { trialUsed: true },
  });
}

// ---- Get remaining imports for the current period ----
export function getRemainingImports(sub: { plan: string; importCount: number }): number {
  const plan = (sub.plan as PlanKey) ?? "TRIAL";
  const limit = PLANS[plan].limit;
  if (limit === Infinity) return Infinity;
  return Math.max(0, limit - sub.importCount);
}