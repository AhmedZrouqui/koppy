import { Queue, Worker } from "bullmq";
import IORedis from "ioredis";
import { rewriteDescription } from "~/services/ai.server";
import { createProductInShopify, getPrimaryLocationId, uploadImageToShopify } from "./shopify.server";
import db from "~/db.server"; // ✅ shared instance, not new PrismaClient()

const connection = new IORedis(process.env.REDIS_URL || "redis://127.0.0.1:6379", {
  maxRetriesPerRequest: null,
  tls: process.env.REDIS_URL?.startsWith("rediss://") ? {} : undefined,
});

export const importQueue = new Queue("product-import", { connection: connection as any });

export const importWorker = new Worker(
  "product-import",
  async (job: { data: { productData: any; shop: any; accessToken: any; importJobId: any; }; updateProgress: (arg0: number) => any; }) => {
    const { productData, shop, accessToken, importJobId } = job.data;

    const admin = {
      graphql: async (query: string, options: any) => {
        const response = await fetch(
          `https://${shop}/admin/api/2026-01/graphql.json`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Shopify-Access-Token": accessToken,
            },
            body: JSON.stringify({ query, variables: options.variables }),
          }
        );
        return response;
      },
    };

    try {
      // Step 1: AI Rewrite
      await job.updateProgress(10);
      const optimizedDescription = await rewriteDescription(
        productData.title,
        productData.descriptionHtml
      );

      const locationId = await getPrimaryLocationId(admin);

      // Step 2: Upload images (with per-image error tolerance)
      await job.updateProgress(30);
      const resourceUrls = (
        await Promise.allSettled(
          productData.images.map((url: string) => uploadImageToShopify(admin, url))
        )
      )
        .filter((r) => r.status === "fulfilled")
        .map((r) => (r as PromiseFulfilledResult<string>).value);

      // Step 3: Create product
      await job.updateProgress(70);
      const productId = await createProductInShopify(
        admin,
        { ...productData, descriptionHtml: optimizedDescription },
        resourceUrls,
        locationId,
      );

      // Step 4: Update DB
      await job.updateProgress(100);
      await db.importJob.update({
        where: { id: importJobId },
        data: { status: "COMPLETED", productId },
      });

      return { success: true, productId };
    } catch (error) {
      await db.importJob.update({
        where: { id: importJobId },
        data: { status: "FAILED" },
      });
      throw error;
    }
  },
  {
    connection: connection as any,
    concurrency: 2, // Keep within Shopify's GraphQL rate limit bucket
  }
);