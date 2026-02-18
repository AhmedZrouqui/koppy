export const PLANS = {
  TRIAL: {
    label: "Free Trial",
    price: 0,
    limit: 50,
    billingKey: null as string | null,
  },
  STARTER: {
    label: "Starter",
    price: 2.99,
    limit: 20,
    billingKey: "starter",
  },
  GROWTH: {
    label: "Growth",
    price: 4.99,
    limit: 100,
    billingKey: "growth",
  },
  TRIAL_EXPIRED: {
    label: "Trial Expired",
    price: 0,
    limit: 0,
    billingKey: null as string | null,
  },
  UNLIMITED: {
    label: "Unlimited",
    price: 9.99,
    limit: Infinity,
    billingKey: "unlimited",
  },
} as const;

export type PlanKey = keyof typeof PLANS;