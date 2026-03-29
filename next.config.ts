import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const nextConfig = {
  serverExternalPackages: ["@prisma/client", "bcryptjs"],
};

export default withNextIntl(nextConfig);