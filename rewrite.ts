/**
 * HTML / XML rewriting utilities for the WordPress reverse proxy.
 */

/** Build a domain-matching regex from a public site URL. */
function domainPattern(siteUrl: string): RegExp {
	const { hostname } = new URL(siteUrl);
	// Strip leading "www." so we match both variants
	const bare = hostname.replace(/^www\./, '');
	const escaped = bare.replace(/\./g, '\\.');
	return new RegExp(`href=["']https?://(www\\.)?${escaped}([^"']*)["']`, 'gi');
}

/**
 * Build a regex that matches absolute URLs for a given origin,
 * capturing the path portion (everything after the origin).
 */
function originPattern(origin: string): RegExp {
	const escaped = origin.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
	return new RegExp(escaped, 'gi');
}

/**
 * Rewrite HTML returned by WordPress so it works under the public domain.
 *
 * - Absolute links pointing to the public domain → relative paths.
 * - When `proxyAssets` is true, absolute WordPress origin URLs for
 *   wp-content/wp-includes are stripped to relative paths (served through the proxy).
 * - When `proxyAssets` is false (default), those URLs are left pointing to the WordPress origin.
 */
export function rewriteHtml(
	html: string,
	wordpressUrl: string,
	siteUrl: string,
	proxyAssets = false,
	additionalOrigins: string[] = []
): string {
	// Absolute hrefs → relative
	html = html.replace(domainPattern(siteUrl), 'href="$2"');

	if (proxyAssets) {
		// Strip all WordPress origin URLs to relative paths
		// so assets are served through the SvelteKit proxy
		const origins = [wordpressUrl, ...additionalOrigins];
		for (const origin of origins) {
			html = html.replace(originPattern(origin), '');
		}
	} else {
		// Rewrite relative src → absolute WordPress origin
		html = html.replace(
			/src=["']\/wp-content\/([^"']+)["']/gi,
			`src="${wordpressUrl}/wp-content/$1"`
		);
		html = html.replace(
			/src=["']\/wp-includes\/([^"']+)["']/gi,
			`src="${wordpressUrl}/wp-includes/$1"`
		);

		// <link> href for wp-content / wp-includes
		html = html.replace(
			/<link([^>]*?)href=["']\/wp-content\/([^"']+)["']/gi,
			`<link$1href="${wordpressUrl}/wp-content/$2"`
		);
		html = html.replace(
			/<link([^>]*?)href=["']\/wp-includes\/([^"']+)["']/gi,
			`<link$1href="${wordpressUrl}/wp-includes/$2"`
		);
	}

	return html;
}

/** Inject SvelteKit URLs into a `<urlset>` sitemap. */
export function injectIntoSitemap(xml: string, siteUrl: string, urls: string[]): string {
	const today = new Date().toISOString().split('T')[0];
	const entries = urls
		.map(
			(url) =>
				`\t<url>\n\t\t<loc>${siteUrl}${url}</loc>\n\t\t<lastmod>${today}</lastmod>\n\t</url>`
		)
		.join('\n');
	return xml.replace('</urlset>', `${entries}\n</urlset>`);
}

/** Inject a SvelteKit sitemap reference into a `<sitemapindex>`. */
export function injectIntoSitemapIndex(xml: string, siteUrl: string): string {
	const entry = `\t<sitemap>\n\t\t<loc>${siteUrl}/sitemap-svelte.xml</loc>\n\t</sitemap>`;
	return xml.replace('</sitemapindex>', `${entry}\n</sitemapindex>`);
}

/** Generate a standalone sitemap XML for the SvelteKit-managed URLs. */
export function buildSvelteSitemap(siteUrl: string, urls: string[]): string {
	const today = new Date().toISOString().split('T')[0];
	const entries = urls
		.map(
			(url) =>
				`\t<url>\n\t\t<loc>${siteUrl}${url}</loc>\n\t\t<lastmod>${today}</lastmod>\n\t</url>`
		)
		.join('\n');
	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${entries}\n</urlset>`;
}
