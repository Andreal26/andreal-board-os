/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@electric-sql/pglite', 'postgres', 'nodemailer'],
  poweredByHeader: false,
};
export default nextConfig;
