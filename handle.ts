import type { Handle } from '@sveltejs/kit';
import type { WpProxyConfig } from './types.js';
import {
	rewriteHtml,
	injectIntoSitemap,
	injectIntoSitemapIndex,
	buildSvelteSitemap
} from './rewrite.js';

/**
 * Create a SvelteKit `Handle` hook that reverse-proxies requests to WordPress.
 *
 * Routes listed in `passthroughRoutes` are resolved by SvelteKit;
 * everything else is forwarded to the WordPress origin.
 */
export function createWpProxyHandle(config: WpProxyConfig): Handle {
	const { wordpressUrl, siteUrl, passthroughRoutes } = config;
	const sitemapUrls = config.sitemapUrls ?? passthroughRoutes;
	const redirects = config.redirects ?? {};
	const sitemapCache = `public, max-age=${config.sitemapCacheSeconds ?? 3600}`;
	const proxyAssets = config.proxyAssets ?? false;
	const additionalOrigins = config.additionalOrigins ?? [];

	return async ({ event, resolve }) => {
		const { pathname, search } = event.url;

		// ── Dedicated SvelteKit sitemap ──
		if (pathname === '/sitemap-svelte.xml') {
			return new Response(buildSvelteSitemap(siteUrl, sitemapUrls), {
				headers: { 'content-type': 'application/xml', 'cache-control': sitemapCache }
			});
		}

		// ── Custom redirects ──
		if (pathname in redirects) {
			return new Response(null, {
				status: 301,
				headers: { location: redirects[pathname] }
			});
		}

		// ── SvelteKit-native routes ──
		if (passthroughRoutes.some((prefix) => pathname.startsWith(prefix))) {
			return resolve(event);
		}

		// ── Proxy to WordPress ──
		const upstream = new URL(pathname + search, wordpressUrl);

		const headers = new Headers(event.request.headers);
		headers.delete('accept-encoding');
		headers.delete('host');
		headers.delete('content-length');

		let upstreamResp: Response;
		try {
			upstreamResp = await fetch(upstream, {
				method: event.request.method,
				headers,
				redirect: 'manual',
				body:
					event.request.method === 'GET' || event.request.method === 'HEAD'
						? undefined
						: event.request.body
			});
		} catch {
			return new Response('Bad Gateway', { status: 502 });
		}

		// ── Redirects: rewrite Location to the public domain ──
		if (upstreamResp.status >= 300 && upstreamResp.status < 400) {
			const location = upstreamResp.headers.get('location');
			if (location) {
				try {
					const loc = new URL(location);
					const rewritten = `${siteUrl}${loc.pathname}${loc.search}`;
					return new Response(null, {
						status: upstreamResp.status,
						headers: { location: rewritten }
					});
				} catch {
					// Relative URL — pass through as-is
					return new Response(null, {
						status: upstreamResp.status,
						headers: { location }
					});
				}
			}
		}

		const clean = new Headers(upstreamResp.headers);
		clean.delete('content-encoding');
		clean.delete('content-length');
		clean.delete('transfer-encoding');

		const contentType = upstreamResp.headers.get('content-type') ?? '';

		// ── XML (sitemaps) ──
		if (contentType.includes('text/xml') || contentType.includes('application/xml')) {
			let xml = await upstreamResp.text();
			xml = xml.replace(/<\?xml-stylesheet[^?]*\?>\s*/g, '');

			if (xml.includes('</urlset>')) {
				xml = injectIntoSitemap(xml, siteUrl, sitemapUrls);
			} else if (xml.includes('</sitemapindex>')) {
				xml = injectIntoSitemapIndex(xml, siteUrl);
			}

			clean.set('cache-control', sitemapCache);

			return new Response(xml, {
				status: upstreamResp.status,
				statusText: upstreamResp.statusText,
				headers: clean
			});
		}

		// ── HTML ──
		if (contentType.includes('text/html')) {
			const html = await upstreamResp.text();
			return new Response(rewriteHtml(html, wordpressUrl, siteUrl, proxyAssets, additionalOrigins), {
				status: upstreamResp.status,
				statusText: upstreamResp.statusText,
				headers: clean
			});
		}

		// ── Everything else (CSS, JS, images, fonts …) ──
		return new Response(upstreamResp.body, {
			status: upstreamResp.status,
			statusText: upstreamResp.statusText,
			headers: clean
		});
	};
}
