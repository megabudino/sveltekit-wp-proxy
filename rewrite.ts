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
 * Rewrite HTML returned by WordPress so it works under the public domain.
 *
 * - Absolute links pointing to the public domain → relative paths.
 * - When `proxyAssets` is false (default), relative src/link for wp-content/wp-includes
 *   are rewritten to absolute WordPress origin URLs.
 * - When `proxyAssets` is true, relative paths are left as-is (served through the proxy).
 */
export function rewriteHtml(
	html: string,
	wordpressUrl: string,
	siteUrl: string,
	proxyAssets = false
): string {
	// Absolute hrefs → relative
	html = html.replace(domainPattern(siteUrl), 'href="$2"');

	if (!proxyAssets) {
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
