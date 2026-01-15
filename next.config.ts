import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "top-left",
  },
  // Mark native Node.js modules as server-only externals (not bundled by webpack)
  serverExternalPackages: [
    "wrtc",
    "sdp-transform",
    "@discordjs/opus",
    "@alexanderolsen/libsamplerate-js",
  ],
  experimental: {
    optimizePackageImports: [
      "lucide-react",
      "recharts",
      "framer-motion",
      "date-fns",
      "@radix-ui/react-accordion",
      "@radix-ui/react-avatar",
      "@radix-ui/react-checkbox",
      "@radix-ui/react-dialog",
      "@radix-ui/react-dropdown-menu",
      "@radix-ui/react-popover",
      "@radix-ui/react-select",
      "@radix-ui/react-tabs",
      "@radix-ui/react-tooltip",
    ],
  },
};

export default nextConfig;
