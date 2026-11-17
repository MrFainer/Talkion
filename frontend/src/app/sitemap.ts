import type { MetadataRoute } from "next";

const BASE_URL = "https://talkion.com.br";

export default function sitemap(): MetadataRoute.Sitemap {
  const agora = new Date();

  return [
    { url: `${BASE_URL}/`, lastModified: agora, changeFrequency: "weekly", priority: 1 },
    { url: `${BASE_URL}/lp`, lastModified: agora, changeFrequency: "weekly", priority: 0.8 },
    { url: `${BASE_URL}/termos`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
    { url: `${BASE_URL}/privacidade`, lastModified: agora, changeFrequency: "yearly", priority: 0.3 },
  ];
}
