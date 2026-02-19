import { json, type LoaderFunctionArgs } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { Page, Card, Badge, Text, BlockStack, InlineStack } from "@shopify/polaris";
import db from "../db.server";
import { getTranslations } from "~/services/i18n.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const t = getTranslations(request, (session as any).locale);

  const jobs = await db.importJob.findMany({
    where: { shop: session.shop },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return json({ jobs, t });
};

export default function JobsPage() {
  const { jobs, t } = useLoaderData<typeof loader>();
  const tj = t.jobs;

  const statusBadge = (status: string) => {
    const map: Record<string, "info" | "success" | "critical"> = {
      PENDING: "info",
      COMPLETED: "success",
      FAILED: "critical",
    };
    const labelMap: Record<string, string> = {
      PENDING: t.import.status_pending,
      COMPLETED: t.import.status_completed,
      FAILED: t.import.status_failed,
    };
    return <Badge tone={map[status] ?? "info"}>{labelMap[status] ?? status}</Badge>;
  };

  return (
    <Page title={tj.page_title}>
      <Card>
        {jobs.length === 0 ? (
          <Text as="p" tone="subdued">{tj.empty}</Text>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #e1e3e5" }}>
                  {[tj.col_product, tj.col_status, tj.col_shopify_id, tj.col_started].map((h) => (
                    <th key={h} style={{ textAlign: "left", padding: "8px 12px", color: "#6d7175", fontWeight: 500 }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {jobs.map((job) => (
                  <tr key={job.id} style={{ borderBottom: "1px solid #f1f2f3" }}>
                    <td style={{ padding: "8px 12px", fontWeight: 500 }}>{job.productTitle}</td>
                    <td style={{ padding: "8px 12px" }}>{statusBadge(job.status)}</td>
                    <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: "12px", color: "#6d7175" }}>
                      {job.productId ? job.productId.replace("gid://shopify/Product/", "#") : "—"}
                    </td>
                    <td style={{ padding: "8px 12px", color: "#6d7175" }}>
                      {new Date(job.createdAt).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </Page>
  );
}