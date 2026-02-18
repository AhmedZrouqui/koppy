import type { LoaderFunctionArgs } from "@remix-run/node";
import { json } from "@remix-run/node";
import { Link, useLoaderData } from "@remix-run/react";
import {
  Page,
  Layout,
  Text,
  Card,
  Button,
  BlockStack,
  InlineStack,
  Badge,
  Divider,
  Box,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { authenticate } from "../shopify.server";
import { getTranslations } from "~/services/i18n.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
  const { session } = await authenticate.admin(request);
  const t = getTranslations(request, (session as any).locale);

  return json({ t });
};

export default function Index() {
  const { t } = useLoaderData<typeof loader>();
  const h = t.home;

  const features = [
    { icon: "🏪", title: h.feature_bulk_title, description: h.feature_bulk_desc },
    { icon: "🤖", title: h.feature_ai_title, description: h.feature_ai_desc },
    { icon: "📊", title: h.feature_realtime_title, description: h.feature_realtime_desc },
    { icon: "🖼️", title: h.feature_images_title, description: h.feature_images_desc },
    { icon: "🔄", title: h.feature_variants_title, description: h.feature_variants_desc },
    { icon: "📋", title: h.feature_history_title, description: h.feature_history_desc },
  ];

  const steps = [
    { number: "1", title: h.step1_title, description: h.step1_desc },
    { number: "2", title: h.step2_title, description: h.step2_desc },
    { number: "3", title: h.step3_title, description: h.step3_desc },
  ];

  return (
    <Page title="KOPPY — Shopify Store Importer">
      <BlockStack gap="800">

        {/* Hero */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <InlineStack gap="200" align="start">
                <Badge tone="success">{h.badge_ready}</Badge>
                <Badge tone="info">{h.badge_ai}</Badge>
              </InlineStack>
              <Text as="h1" variant="heading2xl">
                {h.hero_title}
              </Text>
              <Text as="p" variant="bodyLg" tone="subdued">
                {h.hero_body}
              </Text>
              <InlineStack gap="300">
                <Link to="/app/import">
                  <Button variant="primary" size="large">
                    {h.cta_import}
                  </Button>
                </Link>
                <Link to="/app/jobs">
                  <Button size="large">{h.cta_history}</Button>
                </Link>
              </InlineStack>
            </BlockStack>
          </Box>
        </Card>

        {/* Features */}
        <BlockStack gap="400">
          <Text as="h2" variant="headingXl">{h.features_title}</Text>
          <Layout>
            {features.map((f) => (
              <Layout.Section variant="oneThird" key={f.title}>
                <Card>
                  <BlockStack gap="300">
                    <Text as="p" variant="headingXl">{f.icon}</Text>
                    <Text as="h3" variant="headingMd">{f.title}</Text>
                    <Text as="p" variant="bodyMd" tone="subdued">{f.description}</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            ))}
          </Layout>
        </BlockStack>

        <Divider />

        {/* How it works */}
        <BlockStack gap="400">
          <Text as="h2" variant="headingXl">{h.steps_title}</Text>
          <Layout>
            {steps.map((s) => (
              <Layout.Section variant="oneThird" key={s.number}>
                <Card>
                  <BlockStack gap="300">
                    <InlineStack gap="300" blockAlign="center">
                      <Box
                        background="bg-fill-brand"
                        borderRadius="full"
                        padding="200"
                        minWidth="32px"
                      >
                        <Text as="span" variant="headingMd" tone="text-inverse" alignment="center">
                          {s.number}
                        </Text>
                      </Box>
                      <Text as="h3" variant="headingMd">{s.title}</Text>
                    </InlineStack>
                    <Text as="p" variant="bodyMd" tone="subdued">{s.description}</Text>
                  </BlockStack>
                </Card>
              </Layout.Section>
            ))}
          </Layout>
        </BlockStack>

        {/* CTA */}
        <Card>
          <Box padding="600">
            <BlockStack gap="400">
              <Text as="h2" variant="headingXl" alignment="center">{h.cta_bottom_title}</Text>
              <Text as="p" variant="bodyLg" tone="subdued" alignment="center">{h.cta_bottom_body}</Text>
              <InlineStack align="center">
                <Link to="/app/import">
                  <Button variant="primary" size="large">{h.cta_bottom_btn}</Button>
                </Link>
              </InlineStack>
            </BlockStack>
          </Box>
        </Card>

      </BlockStack>
    </Page>
  );
}
