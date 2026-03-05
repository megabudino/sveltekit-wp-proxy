/** Configuration for the WordPress reverse proxy. */
export interface WpProxyConfig {
	/** The WordPress origin URL (not publicly exposed). */
	wordpressUrl: string;

	/** The public site URL (used in sitemaps and link rewriting). */
	siteUrl: string;

	/**
	 * Route prefixes that SvelteKit handles natively (not proxied).
	 * Uses `startsWith` matching, so `/blog` also matches `/blog/my-post`.
	 */
	passthroughRoutes: string[];

	/**
	 * Extra SvelteKit-managed URLs to inject into WordPress sitemaps.
	 * Defaults to `passthroughRoutes` if not provided.
	 */
	sitemapUrls?: string[];

	/**
	 * Custom redirects applied before proxying to WordPress.
	 * Maps a path to its target path (e.g. `{ '/sitemap.xml': '/sitemap_index.xml' }`).
	 */
	redirects?: Record<string, string>;

	/**
	 * Cache-Control max-age (in seconds) for sitemap responses.
	 * Defaults to 3600 (1 hour).
	 */
	sitemapCacheSeconds?: number;

	/**
	 * If true, `/wp-content/*` and `/wp-includes/*` are proxied through SvelteKit
	 * so the WordPress origin is never exposed in the HTML source.
	 * Defaults to false (assets rewritten to absolute WordPress URLs).
	 */
	proxyAssets?: boolean;
}
