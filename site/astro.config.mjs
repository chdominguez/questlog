import { defineConfig } from "astro/config";
import starlight from "@astrojs/starlight";
import { REPO, SITE_URL } from "../shared/brand.ts";

export default defineConfig({
  site: SITE_URL,
  integrations: [starlight({
    title: "Questie",
    description: "Courses you play. Runnable katas, graded written answers and spaced review, from a topic, your notes or a repo. Open source.",
    logo: { light: "./src/assets/questie-light.svg", dark: "./src/assets/questie-dark.svg", alt: "Questie" },
    favicon: "/favicon.svg",
    social: [{ icon: "github", label: "GitHub", href: `https://github.com/${REPO}` }],
    editLink: { baseUrl: `https://github.com/${REPO}/edit/main/site/` },
    customCss: ["./src/styles/questie.css"],
    head: [
      { tag: "meta", attrs: { property: "og:image", content: `${SITE_URL}/og.png` } },
      { tag: "meta", attrs: { name: "twitter:card", content: "summary_large_image" } },
    ],
    components: { Hero: "./src/components/Hero.astro" },
    lastUpdated: true,
    sidebar: [
      { label: "Learn", items: [{ autogenerate: { directory: "learn" } }] },
      { label: "Build with AI", items: [{ autogenerate: { directory: "ai" } }] },
      { label: "Author courses", items: [{ autogenerate: { directory: "authoring" } }] },
      { label: "Self-host", items: [{ autogenerate: { directory: "self-host" } }] },
      { label: "Contribute", items: [{ autogenerate: { directory: "contribute" } }] },
      { label: "Pricing", link: "/pricing/" },
      { label: "License", link: "/license/" },
    ],
  })],
  vite: { server: { fs: { allow: [".."] } } }, // pricing and brand import ../shared
});
