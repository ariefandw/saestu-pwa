import type { NextConfig } from "next";
import withPWAInit from "@ducanh2912/next-pwa";

/**
 * Konfigurasi PWA menggunakan @ducanh2912/next-pwa.
 */
const withPWA = withPWAInit({
  dest: "public",
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: true,
  reloadOnOnline: true,
  // Kita matikan PWA saat development agar tidak mengganggu proses debugging
  disable: process.env.NODE_ENV === "development",
  workboxOptions: {
    disableDevLogs: true,
  },
});

const nextConfig: NextConfig = {
  output: "standalone",
  /* Menambahkan opsi turbopack kosong untuk memberi tahu Next.js 
     bahwa kita secara sadar menggunakan plugin berbasis Webpack.
     Ini akan menghilangkan error saat menjalankan 'npm run dev'.
  */
  turbopack: {},
};

export default withPWA(nextConfig);