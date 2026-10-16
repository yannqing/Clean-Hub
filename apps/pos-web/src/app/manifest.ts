import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "CleanHub POS",
    short_name: "CleanHub POS",
    description: "CleanHub store point-of-sale workspace",
    start_url: "/",
    display: "standalone",
    background_color: "#F7F9FC",
    theme_color: "#F7F9FC",
    orientation: "any",
    icons: [
      {
        src: "/cleanhub-logo-mark.jpg",
        sizes: "512x512",
        type: "image/jpeg",
      },
    ],
  };
}
