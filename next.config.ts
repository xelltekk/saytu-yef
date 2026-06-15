import type { NextConfig } from "next";
import withPWA from "@ducanh2912/next-pwa";

const nextConfig: NextConfig = {};

export default withPWA({
  dest: "public",
  sw: "sw.js",
  scope: "/",
  register: false,
  disable: process.env.NODE_ENV === "development",
  cacheStartUrl: false,
  dynamicStartUrl: true,
  reloadOnOnline: false,
  fallbacks: {
    document: "/offline",
  },
  workboxOptions: {
    skipWaiting: false,
    clientsClaim: true,
    cleanupOutdatedCaches: true,
    maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
    navigateFallback: "/offline",
    navigateFallbackDenylist: [/^\/api\//, /^\/auth\//],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
        handler: "CacheFirst",
        options: {
          cacheName: "google-fonts-webfonts",
          expiration: {
            maxEntries: 8,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
        handler: "StaleWhileRevalidate",
        options: {
          cacheName: "google-fonts-stylesheets",
          expiration: {
            maxEntries: 8,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: /\/_next\/static\/.*\.(?:js|css|woff2)$/i,
        handler: "CacheFirst",
        options: {
          cacheName: "next-static-assets",
          expiration: {
            maxEntries: 96,
            maxAgeSeconds: 365 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: ({ sameOrigin, url }) =>
          sameOrigin &&
          (url.pathname.startsWith("/icons/") ||
            url.pathname === "/favicon.ico" ||
            url.pathname === "/manifest.json"),
        handler: "CacheFirst",
        options: {
          cacheName: "pwa-shell-assets",
          expiration: {
            maxEntries: 32,
            maxAgeSeconds: 30 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
      {
        urlPattern: ({ request, sameOrigin, url }) =>
          sameOrigin &&
          request.mode === "navigate" &&
          !url.pathname.startsWith("/api/") &&
          !url.pathname.startsWith("/auth/"),
        handler: "NetworkFirst",
        options: {
          cacheName: "app-pages",
          networkTimeoutSeconds: 3,
          expiration: {
            maxEntries: 24,
            maxAgeSeconds: 7 * 24 * 60 * 60,
          },
          cacheableResponse: {
            statuses: [0, 200],
          },
        },
      },
    ],
  },
})(nextConfig);
