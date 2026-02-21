import { useState, useEffect } from "react";
import {
  Page, Layout, Card, TextField, Button, BlockStack,
  Text, Banner, ProgressBar, Badge, InlineStack, Spinner, Box, Divider
} from "@shopify/polaris";
import { useFetcher, useLoaderData } from "@remix-run/react";
import { json, type ActionFunctionArgs, type LoaderFunctionArgs } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import { scrapeShopifyStore, scrapeSingleProduct } from "../services/scraper.server";
import { importQueue } from "~/services/queue.server";
import { getTranslations } from "~/services/i18n.server";
import { interpolate } from "~/utils/interpolate";
import db from "~/db.server";
import { checkAndIncrementImportCount, getShopSubscription } from "~/services/billing.server";
import { PlanKey, PLANS } from "~/services/billing.plan";

// ---- Loader: returns live job status for polling ----
export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const t = getTranslations(request, (session as any).locale);

  const jobs = await db.importJob.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return json({ jobs, t });
};

// ---- Action ----
export const action = async ({ request }: ActionFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const formData = await request.formData();
  const actionType = formData.get("_action");
  const t = getTranslations(request, (session as any).locale);

  if (actionType === "preview") {
    const url = formData.get("url") as string;
    const isSingleProduct = url.includes("/products/");

    try {
      if (isSingleProduct) {
        const product = await scrapeSingleProduct(url);
        return json({ preview: [product], t });
      } else {
        const products = await scrapeShopifyStore(url);
        return json({ preview: products, t });
      }
    } catch (err: any) {
      return json({ error: err.message ?? "An unexpected error occurred. Please try again.", t });
    }
  }

  if (actionType === "bulkImport") {
    let products = JSON.parse(formData.get("products") as string);

    // Trim to remaining quota instead of rejecting entirely
    const sub = await getShopSubscription(session.shop);
    const plan = (sub.plan as PlanKey) ?? "TRIAL";
    const limit = PLANS[plan].limit;

    if (limit !== Infinity) {
      const remaining = Math.max(0, limit - sub.importCount);
      if (remaining === 0) {
        return json({ error: "Import limit reached. Please upgrade your plan.", t });
      }
      if (products.length > remaining) {
        products = products.slice(0, remaining);
      }
    }

    try {
      await checkAndIncrementImportCount(session.shop, products.length);
    } catch (err: any) {
      return json({ error: err.message, t });
    }

    const jobs = await Promise.all(
      products.map((productData: any) =>
        db.importJob.create({
          data: {
            shop: session.shop,
            productTitle: productData.title,
            status: "PENDING",
            sourceUrl: productData.sourceUrl,
          },
        })
      )
    );

    await Promise.all(
      products.map((productData: any, i: number) =>
        importQueue.add(`import-${Date.now()}-${i}`, {
          productData,
          shop: session.shop,
          accessToken: session.accessToken,
          importJobId: jobs[i].id,
        })
      )
    );

    return json({ queued: products.length, trimmed: products.length < JSON.parse(formData.get("products") as string).length, t });
  }

  return json({ t });
};

// ---- Elapsed time counter ----
function ElapsedTime({ createdAt }: { createdAt: string }) {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => setElapsed(Math.floor((Date.now() - start) / 1000));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (elapsed < 60) return <>{elapsed}s</>;
  return <>{Math.floor(elapsed / 60)}m {elapsed % 60}s</>;
}

// ---- UI ----
export default function ImportPage() {
  const { t: loaderT, jobs: initialJobs } = useLoaderData<typeof loader>();
  const [url, setUrl] = useState("");
  const fetcher = useFetcher<any>();
  const pollFetcher = useFetcher<any>();

  const isLoading = fetcher.state !== "idle";

  // Use fetcher data (action response) or fall back to loader data
  const t = fetcher.data?.t ?? pollFetcher.data?.t ?? loaderT;
  const preview = fetcher.data?.preview;
  const error = fetcher.data?.error;
  const jobs: any[] = pollFetcher.data?.jobs ?? initialJobs ?? [];

  const pending = jobs.filter((j) => j.status === "PENDING").length;
  const completed = jobs.filter((j) => j.status === "COMPLETED").length;
  const failed = jobs.filter((j) => j.status === "FAILED").length;
  const total = jobs.length;
  const progress = total > 0 ? Math.round((completed / total) * 100) : 0;
  const isImporting = pending > 0;
  const allDone = total > 0 && pending === 0;

  // Adaptive polling: fast while importing, slow when idle
  useEffect(() => {
    const interval = setInterval(() => {
      pollFetcher.load("/app/import");
    }, isImporting ? 1500 : 5000);
    return () => clearInterval(interval);
  }, [isImporting]);

  // Initial load
  useEffect(() => {
    pollFetcher.load("/app/import");
  }, []);

  const handlePreview = () => {
    fetcher.submit({ url, _action: "preview" }, { method: "POST" });
  };

  const handleBulkImport = () => {
    fetcher.submit(
      { products: JSON.stringify(preview), _action: "bulkImport" },
      { method: "POST" }
    );
  };

  // Translations — safe fallback while t is loading
  const ti = t?.import;
  const statusLabel = (status: string) => {
    if (!ti) return status;
    const map: Record<string, string> = {
      PENDING: ti.status_pending,
      COMPLETED: ti.status_completed,
      FAILED: ti.status_failed,
    };
    return map[status] ?? status;
  };

  const statusBadge = (status: string) => {
    const toneMap: Record<string, "info" | "success" | "critical" | "warning"> = {
      PENDING: "warning",
      COMPLETED: "success",
      FAILED: "critical",
    };
    return <Badge tone={toneMap[status] ?? "info"}>{statusLabel(status)}</Badge>;
  };

  const previewCount = preview?.length ?? 0;
  const previewLabel = ti
    ? interpolate(previewCount === 1 ? ti.preview_found : ti.preview_found_plural, { count: previewCount })
    : `${previewCount} products`;

  return (
    <Page title={ti?.page_title ?? "Store Importer"}>
      {/* Inline styles for animations */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }
        .live-dot {
          display: inline-block;
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #008060;
          animation: pulse 1.2s ease-in-out infinite;
          margin-right: 6px;
          vertical-align: middle;
        }
        .progress-bar-wrap { transition: all 0.4s ease; }
      `}</style>

      <Layout>
        {/* Input */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">{ti?.url_heading ?? "Shopify Store or Product URL"}</Text>
              <Text as="p" variant="bodyMd" tone="subdued">
                {ti?.url_hint ?? "Paste a full store URL to import all products, or a single /products/ URL for one item."}
              </Text>
              <InlineStack gap="300">
                <div style={{ flexGrow: 1 }}>
                  <TextField
                    label="URL"
                    labelHidden
                    value={url}
                    onChange={setUrl}
                    placeholder={ti?.url_placeholder ?? "https://some-store.myshopify.com"}
                    autoComplete="off"
                  />
                </div>
                <Button variant="primary" onClick={handlePreview} loading={isLoading}>
                  {ti?.btn_analyze ?? "Analyze"}
                </Button>
              </InlineStack>

              {/* Friendly error banner */}
              {error && (
                <Banner tone="critical" title={ti?.error_banner_title ?? "Could not load store"}>
                  <Text as="p">{error}</Text>
                </Banner>
              )}

              {fetcher.data?.trimmed && (
                <Banner tone="warning" title={ti?.trimmed_banner_title ?? "Partial import started"}>
                  <Text as="p">
                    {ti
                      ? interpolate(ti.trimmed_banner_body, { queued: fetcher.data.queued })
                      : `Only ${fetcher.data.queued} products were queued based on your remaining plan quota. Upgrade to import more.`}
                  </Text>
                </Banner>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Preview */}
        {preview && !error && (
          <Layout.Section>
            <Card>
              <BlockStack gap="400">
                <InlineStack align="space-between" blockAlign="center">
                  <BlockStack gap="100">
                    <Text as="h2" variant="headingMd">{previewLabel}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">
                      {ti?.preview_subtitle ?? "Review the list below, then click Import All to start."}
                    </Text>
                  </BlockStack>
                  <Button variant="primary" onClick={handleBulkImport} loading={isLoading}>
                    {ti?.btn_import_all ?? "Import All to Shopify"}
                  </Button>
                </InlineStack>

                <Divider />

                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                        {[ti?.col_title, ti?.col_vendor, ti?.col_variants, ti?.col_images].map((h, i) => (
                          <th key={i} style={{ textAlign: i >= 2 ? "right" : "left", padding: "8px 12px", color: "#6d7175", fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {preview.slice(0, 15).map((p: any, i: number) => (
                        <tr key={i} style={{ borderBottom: "1px solid #f1f2f3" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 500 }}>{p.title}</td>
                          <td style={{ padding: "8px 12px", color: "#6d7175" }}>{p.vendor}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.variants.length}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>{p.images.length}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preview.length > 15 && (
                  <Text as="p" tone="subdued">
                    {ti ? interpolate(ti.preview_showing, { count: preview.length }) : `Showing 15 of ${preview.length}.`}
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        {/* Live Import Progress */}
        {total > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="500">
                {/* Header with live indicator */}
                <InlineStack align="space-between" blockAlign="center">
                  <InlineStack gap="200" blockAlign="center">
                    <Text as="h2" variant="headingMd">{ti?.progress_title ?? "Import Progress"}</Text>
                    {isImporting && (
                      <span style={{ fontSize: "13px", color: "#008060", fontWeight: 500 }}>
                        <span className="live-dot" />
                        {ti?.live_label ?? "Live"}
                      </span>
                    )}
                  </InlineStack>
                  <Text as="p" variant="bodyMd" tone="subdued">
                    {ti ? interpolate(ti.completed_of, { completed, total }) : `${completed} / ${total}`}
                  </Text>
                </InlineStack>

                {/* Completion banners */}
                {allDone && failed === 0 && (
                  <Banner tone="success" title={ti?.banner_success_title ?? "Import complete!"}>
                    <Text as="p">
                      {ti ? interpolate(ti.banner_success_body, { count: completed }) : `${completed} products imported.`}
                    </Text>
                  </Banner>
                )}
                {allDone && failed > 0 && (
                  <Banner tone="warning" title={ti?.banner_warning_title ?? "Import finished with some failures"}>
                    <Text as="p">
                      {ti
                        ? interpolate(
                            failed === 1 ? ti.banner_warning_body : ti.banner_warning_body_plural,
                            { completed, failed }
                          )
                        : `${completed} imported, ${failed} failed.`}
                    </Text>
                  </Banner>
                )}

                {/* Progress bar */}
                <div className="progress-bar-wrap">
                  <ProgressBar progress={progress} size="medium" tone={failed > 0 && allDone ? "highlight" : "primary"} />
                </div>

                {/* Stats row */}
                <InlineStack gap="600">
                  {[
                    { label: ti?.stat_pending ?? "Pending", value: pending, icon: pending > 0 ? "⏳" : null, tone: undefined },
                    { label: ti?.stat_completed ?? "Completed", value: completed, icon: null, tone: "success" as const },
                    { label: ti?.stat_failed ?? "Failed", value: failed, icon: null, tone: failed > 0 ? "critical" as const : undefined },
                    { label: ti?.stat_total ?? "Total", value: total, icon: null, tone: undefined },
                  ].map(({ label, value, icon, tone }) => (
                    <BlockStack gap="100" key={label}>
                      <Text as="p" variant="bodyMd" tone="subdued">{label}</Text>
                      <InlineStack gap="100" blockAlign="center">
                        {icon && <span>{icon}</span>}
                        <Text as="p" variant="headingMd" tone={tone}>{value}</Text>
                      </InlineStack>
                    </BlockStack>
                  ))}
                </InlineStack>

                <Divider />

                {/* Live job table */}
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                        {[ti?.col_product, ti?.col_status, ti?.col_shopify_id, ti?.col_time].map((h, i) => (
                          <th key={i} style={{ textAlign: i === 3 ? "right" : "left", padding: "8px 12px", color: "#6d7175", fontWeight: 500 }}>
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.slice(0, 50).map((j: any) => (
                        <tr
                          key={j.id}
                          style={{
                            borderBottom: "1px solid #f1f2f3",
                            transition: "background 0.3s ease",
                            background:
                              j.status === "COMPLETED" ? "#f6fff9" :
                              j.status === "FAILED" ? "#fff4f4" : "transparent",
                          }}
                        >
                          <td style={{ padding: "8px 12px" }}>
                            <InlineStack gap="200" blockAlign="center">
                              {j.status === "PENDING" && <span style={{ display: "inline-flex" }}><Spinner size="small" /></span>}
                              {j.status === "COMPLETED" && <span>✅</span>}
                              {j.status === "FAILED" && <span>❌</span>}
                              <span style={{ fontWeight: j.status === "COMPLETED" ? 500 : 400 }}>
                                {j.productTitle}
                              </span>
                            </InlineStack>
                          </td>
                          <td style={{ padding: "8px 12px" }}>{statusBadge(j.status)}</td>
                          <td style={{ padding: "8px 12px", color: "#6d7175", fontFamily: "monospace", fontSize: "12px" }}>
                            {j.productId ? j.productId.replace("gid://shopify/Product/", "#") : "—"}
                          </td>
                          <td style={{ padding: "8px 12px", textAlign: "right", color: "#6d7175" }}>
                            {j.status === "PENDING"
                              ? <ElapsedTime createdAt={j.createdAt} />
                              : new Date(j.updatedAt).toLocaleTimeString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {isImporting && (
                  <Text as="p" variant="bodyMd" tone="subdued" alignment="center">
                    {ti?.polling_label ?? "Updating every 1.5 seconds…"}
                  </Text>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}