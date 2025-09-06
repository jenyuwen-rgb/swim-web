// next.config.js
const NEXT_PUBLIC_API_URL =
  process.env.NEXT_PUBLIC_API_URL || "https://swimming-record.onrender.com";

module.exports = {
  reactStrictMode: true,
  env: { NEXT_PUBLIC_API_URL },
};
