# sveltekit-wp-proxy

A declarative SvelteKit hook that reverse-proxies your site through WordPress — serve WordPress pages alongside SvelteKit routes from a single domain.

## Why?

You're migrating from WordPress to SvelteKit (or running them side-by-side) and want:

- A **single public domain** for both WordPress and SvelteKit pages
- The WordPress origin **hidden** from end-users
- SvelteKit-managed routes to inject into WordPress **sitemaps**
- Full control over **redirects** that existed at the webserver level

## Installation

Copy the `sveltekit-wp-proxy` directory into your `src/lib/` folder.

> Requires `@sveltejs/kit` (uses the `Handle` hook type).

## Usage

Create (or update) `src/hooks.server.ts`:

```ts
import { createWpProxyHandle } from '$lib/sveltekit-wp-proxy';

export const handle = createWpProxyHandle({
  wordpressUrl: 'https://wordpress.example.com',
  siteUrl: 'https://www.example.com',
  passthroughRoutes: ['/about', '/contact'],
});
```

That's it. Every route **not** listed in `passthroughRoutes` is proxied to WordPress. Routes listed there are resolved by SvelteKit as usual.

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `wordpressUrl` | `string` | *required* | WordPress origin URL (not publicly exposed) |
| `siteUrl` | `string` | *required* | Public site URL (used in sitemaps and link rewriting) |
| `passthroughRoutes` | `string[]` | *required* | Route prefixes handled by SvelteKit (`startsWith` matching) |
| `sitemapUrls` | `string[]` | `passthroughRoutes` | SvelteKit URLs to inject into WordPress sitemaps |
| `redirects` | `Record<string, string>` | `{}` | Path-to-path redirects applied before proxying (301) |
| `sitemapCacheSeconds` | `number` | `3600` | `Cache-Control` max-age for sitemap responses |
| `proxyAssets` | `boolean` | `false` | If `true`, proxy `wp-content`/`wp-includes` through SvelteKit to hide the WordPress origin |

## How it works

```
Client request
      │
      ├─ /sitemap-svelte.xml  → generated XML with SvelteKit URLs
      ├─ matches redirects?   → 301 redirect
      ├─ matches passthrough?  → SvelteKit resolves normally
      └─ everything else      → proxied to WordPress
                                    │
                                    ├─ 3xx → Location rewritten to public domain
                                    ├─ HTML → links rewritten (absolute → relative)
                                    ├─ XML  → SvelteKit URLs injected into sitemaps
                                    └─ other → passed through (CSS, JS, images…)
```

### HTML rewriting

- **Absolute links** (`href`) pointing to the public domain are converted to relative paths
- **`wp-content` / `wp-includes` assets**: rewritten to absolute WordPress URLs (default), or left relative when `proxyAssets: true`

### Sitemap injection

- SvelteKit URLs are injected into WordPress `<urlset>` sitemaps
- A `<sitemap>` entry for `/sitemap-svelte.xml` is added to `<sitemapindex>` responses
- A dedicated `/sitemap-svelte.xml` endpoint is served for SvelteKit-only pages

## Example with all options

```ts
export const handle = createWpProxyHandle({
  wordpressUrl: 'https://wp-backend.internal',
  siteUrl: 'https://www.mysite.com',
  passthroughRoutes: ['/app', '/docs'],
  sitemapUrls: ['/app', '/docs', '/docs/getting-started'],
  redirects: {
    '/sitemap.xml': '/sitemap_index.xml',
    '/old-page': '/new-page',
  },
  sitemapCacheSeconds: 7200,
  proxyAssets: true,
});
```

## License

[MIT](./LICENSE)
