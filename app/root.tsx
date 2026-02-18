import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export const meta = () => [
  { title: "Koppy — Shopify Store Importer" },
  { name: "description", content: "Bulk import products from any Shopify store in seconds." },
  { name: "robots", content: "noindex, nofollow" },
  { property: "og:title", content: "Koppy — Shopify Store Importer" },
  { property: "og:description", content: "Bulk import products from any Shopify store." },
];

export const links = () => [
  { rel: "icon", href: "/favicon.ico" },
  // or SVG:
  { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
];

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
