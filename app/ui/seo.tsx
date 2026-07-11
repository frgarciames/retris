import type { Handle, RemixNode } from "remix/ui";

export const SITE = {
  name: "Retris",
  // Used wherever a short, standalone tagline reads better than the full blurb.
  tagline: "Free falling-blocks puzzle game",
  description:
    "Retris is a free falling-blocks puzzle game you can play instantly in your " +
    "browser. Race the clock in 20- and 40-line sprints, go head-to-head in live " +
    "1v1 battles, and climb the leaderboard. No install, no account required.",
  locale: "en",
  // 1200x630 is the standard Open Graph / Twitter summary-large-image size.
  ogImage: "/og-image.png",
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;

// Absolute origin for canonical/og:url and the sitemap. Social crawlers and
// search engines need fully-qualified URLs, so set APP_URL in production
// (e.g. https://retris.example.com). Falls back to the dev server origin.
const DEFAULT_SITE_URL = `http://localhost:${process.env.PORT ?? "44100"}`;
export const SITE_URL = (process.env.APP_URL ?? DEFAULT_SITE_URL).replace(/\/+$/, "");

// Resolves an app path (or an already-absolute URL) to an absolute URL.
export function siteUrl(path = "/"): string {
  if (/^https?:\/\//.test(path)) return path;
  return SITE_URL + (path.startsWith("/") ? path : `/${path}`);
}

export interface SeoProps {
  /** Page <title>; reused for og:title / twitter:title. */
  title?: string;
  /** Meta description; falls back to the site description. */
  description?: string;
  /** Canonical path or absolute URL for this page. */
  canonical?: string;
  /** Social share image path or absolute URL. */
  image?: string;
  /** Keep this page out of search results (private/auth pages). */
  noindex?: boolean;
  /** Open Graph type. */
  type?: "website" | "article";
  /** Browser UI tint, usually the active theme background. */
  themeColor?: string;
}

// Renders the SEO/social <head> tags. Returned as a fragment so callers can
// drop it straight into the document head.
export function Seo(handle: Handle<SeoProps>): () => RemixNode {
  return () => {
    let {
      title = SITE.name,
      description = SITE.description,
      canonical,
      image = SITE.ogImage,
      noindex = false,
      type = "website",
      themeColor,
    } = handle.props;

    let url = canonical ? siteUrl(canonical) : undefined;
    let imageUrl = siteUrl(image);

    return (
      <>
        <meta name="description" content={description} />
        <meta name="application-name" content={SITE.name} />
        {themeColor ? <meta name="theme-color" content={themeColor} /> : null}
        <meta
          name="robots"
          content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large"}
        />
        {url ? <link rel="canonical" href={url} /> : null}

        {/* Open Graph */}
        <meta property="og:site_name" content={SITE.name} />
        <meta property="og:type" content={type} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={description} />
        <meta property="og:locale" content={SITE.locale} />
        {url ? <meta property="og:url" content={url} /> : null}
        <meta property="og:image" content={imageUrl} />
        <meta property="og:image:width" content={String(SITE.ogImageWidth)} />
        <meta property="og:image:height" content={String(SITE.ogImageHeight)} />
        <meta property="og:image:alt" content={`${SITE.name} — ${SITE.tagline}`} />

        {/* Twitter */}
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={title} />
        <meta name="twitter:description" content={description} />
        <meta name="twitter:image" content={imageUrl} />
        <meta name="twitter:image:alt" content={`${SITE.name} — ${SITE.tagline}`} />
      </>
    );
  };
}

// Renders a JSON-LD structured-data block. Uses `innerHTML` (raw) because text
// children are HTML-escaped, which would corrupt the JSON; `<` is escaped to a
// unicode sequence so the payload can never break out of the <script>.
export function JsonLd(handle: Handle<{ data: unknown }>): () => RemixNode {
  return () => {
    let json = JSON.stringify(handle.props.data).replace(/</g, "\\u003c");
    return <script type="application/ld+json" innerHTML={json} />;
  };
}

// Structured data for the home page: identifies the site and the game itself so
// search engines can show a richer result. Generic genre terms, no trademark.
export function homeStructuredData(): unknown {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": `${SITE_URL}/#website`,
        name: SITE.name,
        url: siteUrl("/"),
        description: SITE.description,
        inLanguage: SITE.locale,
      },
      {
        "@type": "VideoGame",
        "@id": `${SITE_URL}/#game`,
        name: SITE.name,
        url: siteUrl("/"),
        description: SITE.description,
        image: siteUrl(SITE.ogImage),
        genre: ["Puzzle", "Arcade"],
        applicationCategory: "Game",
        operatingSystem: "Web Browser",
        gamePlatform: "Web browser",
        playMode: ["SinglePlayer", "MultiPlayer"],
        inLanguage: SITE.locale,
        offers: {
          "@type": "Offer",
          price: "0",
          priceCurrency: "USD",
        },
      },
    ],
  };
}
