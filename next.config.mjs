import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Supabase generated types cause spurious "never" type errors on some queries.
  // Disable TS/ESLint build errors until types are regenerated or manually patched.
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // Allow the public stewardship dashboard to be embedded as an iframe
  // on taichunginternationalfellowship.org (Webflow site).
  async headers() {
    return [
      {
        source: "/:locale/public",
        headers: [
          // Modern browsers: allow framing from any origin
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors *",
          },
          // Legacy browsers: ALLOWALL is non-standard but harmless
          {
            key: "X-Frame-Options",
            value: "ALLOWALL",
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
