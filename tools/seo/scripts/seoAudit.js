import * as cheerio from "cheerio";
import { request } from "undici";

/** ---------------------------
 * Shared helpers
 * ---------------------------
 */

export const normalizeSpace = (s = "") => String(s).replace(/\s+/g, " ").trim();
export const safeLower = (s = "") => normalizeSpace(s).toLowerCase();

export const toAbsoluteUrl = (maybeUrl, baseUrl) => {
  try {
    return new URL(maybeUrl).toString();
  } catch {
    try {
      return new URL(maybeUrl, baseUrl).toString();
    } catch {
      return null;
    }
  }
};

export const tryParseUrl = (u) => {
  try {
    return new URL(u);
  } catch {
    return null;
  }
};

export const makeFinding = ({
  id,
  pass,
  severity = "warn",
  message,
  details,
  group,
}) => ({
  id,
  pass: Boolean(pass),
  severity, // "error" | "warn" | "info"
  message,
  ...(group ? { group } : {}),
  ...(details ? { details } : {}),
});

export const pushFinding = (findings, finding) => {
  findings.push(finding);
  return findings;
};

export const parseHtml = (html) => cheerio.load(html ?? "");

/** ---------------------------
 * Network helpers
 * ---------------------------
 */

export const httpRequest = async (
  url,
  { method = "GET", headers, timeoutMs = 15000 } = {}
) => {
  const res = await request(url, {
    method,
    headers: {
      "user-agent": "seo-audit-bot/1.0",
      accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ...(headers || {}),
    },
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
    maxRedirections: 0, // manual redirect inspection
  });

  let bodyText = null;
  if (method === "GET") {
    const ctype = String(res.headers["content-type"] || "");
    if (
      ctype.includes("text") ||
      ctype.includes("xml") ||
      ctype.includes("json") ||
      ctype.includes("html")
    ) {
      bodyText = await res.body.text();
    } else {
      await res.body.arrayBuffer();
    }
  } else {
    await res.body.arrayBuffer();
  }

  return {
    url,
    status: res.statusCode,
    headers: res.headers,
    bodyText,
  };
};

export const headOrGet = async (url, opts = {}) => {
  const head = await httpRequest(url, { ...opts, method: "HEAD" }).catch(
    () => null
  );
  if (head && head.status && head.status !== 405 && head.status !== 501)
    return head;
  return httpRequest(url, { ...opts, method: "GET" });
};

export const isOkStatus = (status) => status === 200 || status === 304;

/** ---------------------------
 * Lighthouse helpers (best effort)
 * ---------------------------
 */

export const getLcpImageUrlFromLhr = (lhr) => {
  try {
    const audit = lhr?.audits?.["largest-contentful-paint-element"];
    const item = audit?.details?.items?.[0];
    if (!item) return null;

    if (item.url && typeof item.url === "string") return item.url;

    const snippet = item.node?.snippet || "";
    const m = snippet.match(/\ssrc\s*=\s*["']([^"']+)["']/i);
    if (m?.[1]) return m[1];

    const m2 = snippet.match(/\sdata-src\s*=\s*["']([^"']+)["']/i);
    if (m2?.[1]) return m2[1];

    return null;
  } catch {
    return null;
  }
};

/** ---------------------------
 * HEAD audits
 * ---------------------------
 */

export const auditTitle = ($, findings, config = {}) => {
  const group = "head";
  const min = config?.title?.min ?? 15;
  const warnOver = config?.title?.warnOver ?? 60;

  const title = normalizeSpace($("head > title").first().text());
  if (!title) {
    return pushFinding(
      findings,
      makeFinding({
        id: "meta-title",
        group,
        severity: "error",
        pass: false,
        message: "Missing <title> in <head>.",
      })
    );
  }

  pushFinding(
    findings,
    makeFinding({
      id: "meta-title-minlen",
      group,
      severity: "error",
      pass: title.length >= min,
      message:
        title.length >= min
          ? "Title length meets minimum."
          : `Title too short (${title.length} < ${min}).`,
      details: { value: title, length: title.length },
    })
  );

  if (title.length > warnOver) {
    pushFinding(
      findings,
      makeFinding({
        id: "meta-title-maxlen",
        group,
        severity: "warn",
        pass: false,
        message: `Title longer than ${warnOver} characters (${title.length}).`,
        details: { value: title, length: title.length },
      })
    );
  }

  if (config?.title?.warnOnSpecialChars) {
    const allowed = config?.title?.allowedCharsRegex
      ? new RegExp(config.title.allowedCharsRegex)
      : /^[a-z0-9\s\-–—:|,.'"/&()]+$/i;

    if (!allowed.test(title)) {
      pushFinding(
        findings,
        makeFinding({
          id: "meta-title-specialchars",
          group,
          severity: "warn",
          pass: false,
          message:
            "Title contains characters outside the allowed set (check special characters rule).",
          details: { value: title },
        })
      );
    }
  }

  return findings;
};

export const auditMetaDescription = ($, findings, config = {}) => {
  const group = "head";
  const min = config?.description?.min ?? 30;
  const warnOver = config?.description?.warnOver ?? 160;

  const content = normalizeSpace(
    $('head meta[name="description"]').attr("content")
  );
  if (!content) {
    return pushFinding(
      findings,
      makeFinding({
        id: "meta-description",
        group,
        severity: "error",
        pass: false,
        message: 'Missing <meta name="description"> in <head>.',
      })
    );
  }

  pushFinding(
    findings,
    makeFinding({
      id: "meta-description-minlen",
      group,
      severity: "error",
      pass: content.length > min,
      message:
        content.length > min
          ? "Meta description length meets minimum."
          : `Meta description too short (${content.length} <= ${min}).`,
      details: { value: content, length: content.length },
    })
  );

  if (content.length > warnOver) {
    pushFinding(
      findings,
      makeFinding({
        id: "meta-description-maxlen",
        group,
        severity: "warn",
        pass: false,
        message: `Meta description longer than ${warnOver} (${content.length}).`,
        details: { length: content.length },
      })
    );
  }

  return findings;
};

export const auditCanonical = ($, findings, { pageUrl } = {}, config = {}) => {
  const group = "head";
  const requireHttps = config?.canonical?.requireHttps ?? true;
  const requireAbsolute = config?.canonical?.requireAbsolute ?? true;

  const hrefRaw = normalizeSpace($('head link[rel="canonical"]').attr("href"));
  if (!hrefRaw) {
    return pushFinding(
      findings,
      makeFinding({
        id: "canonical",
        group,
        severity: "error",
        pass: false,
        message: 'Missing canonical link (<link rel="canonical">).',
      })
    );
  }

  const hrefAbs = toAbsoluteUrl(hrefRaw, pageUrl);
  if (requireAbsolute && !hrefAbs) {
    return pushFinding(
      findings,
      makeFinding({
        id: "canonical-absolute",
        group,
        severity: "error",
        pass: false,
        message: "Canonical must be an absolute URL.",
        details: { href: hrefRaw },
      })
    );
  }

  const u = tryParseUrl(hrefAbs || hrefRaw);
  if (!u) {
    return pushFinding(
      findings,
      makeFinding({
        id: "canonical-parse",
        group,
        severity: "error",
        pass: false,
        message: "Canonical URL is invalid (cannot parse).",
        details: { href: hrefRaw },
      })
    );
  }

  if (requireHttps) {
    pushFinding(
      findings,
      makeFinding({
        id: "canonical-https",
        group,
        severity: "error",
        pass: u.protocol === "https:",
        message:
          u.protocol === "https:"
            ? "Canonical uses https."
            : `Canonical is not https (protocol: ${u.protocol}).`,
        details: { canonical: u.toString() },
      })
    );
  }

  if ((config?.canonical?.warnOnQueryParams ?? true) && u.search) {
    pushFinding(
      findings,
      makeFinding({
        id: "canonical-query",
        group,
        severity: "warn",
        pass: false,
        message:
          "Canonical URL contains query parameters (review parameter handling rules).",
        details: { canonical: u.toString() },
      })
    );
  }

  return findings;
};

export const auditHreflang = (
  $,
  findings,
  { pageUrl, expectLocalized = false } = {},
  config = {}
) => {
  const group = "head";
  const requireXDefault = config?.hreflang?.requireXDefault ?? true;

  const tags = $('head link[rel="alternate"][hreflang]')
    .toArray()
    .map((el) => ({
      hreflang: normalizeSpace($(el).attr("hreflang")),
      href: normalizeSpace($(el).attr("href")),
    }));

  if (!tags.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "hreflang-presence",
        group,
        severity: expectLocalized ? "error" : "info",
        pass: !expectLocalized,
        message: expectLocalized
          ? "Expected hreflang tags but none found."
          : "No hreflang tags found (ok if not localized).",
      })
    );
    return findings;
  }

  if (requireXDefault) {
    const hasX = tags.some((t) => safeLower(t.hreflang) === "x-default");
    pushFinding(
      findings,
      makeFinding({
        id: "hreflang-xdefault",
        group,
        severity: "warn",
        pass: hasX,
        message: hasX ? "x-default present." : "Missing x-default hreflang.",
      })
    );
  }

  for (const t of tags) {
    const abs = toAbsoluteUrl(t.href, pageUrl);
    const u = abs ? tryParseUrl(abs) : null;
    const ok = Boolean(u && u.protocol === "https:");
    pushFinding(
      findings,
      makeFinding({
        id: `hreflang-${t.hreflang || "missing"}`,
        group,
        severity: "warn",
        pass: ok,
        message: ok
          ? `hreflang ${t.hreflang} href OK.`
          : `hreflang ${t.hreflang || "(missing)"} has invalid or non-https href.`,
        details: { hreflang: t.hreflang, href: t.href, resolvedHref: abs },
      })
    );
  }

  return findings;
};

export const auditOpenGraph = ($, findings, { pageUrl } = {}) => {
  const group = "head";
  const get = (p) =>
    normalizeSpace($(`head meta[property="${p}"]`).attr("content"));

  const required = [
    "og:title",
    "og:url",
    "og:image",
    "og:description",
    "og:type",
    "og:site_name",
    "og:locale",
  ];

  for (const p of required) {
    const v = get(p);
    pushFinding(
      findings,
      makeFinding({
        id: `og-${p}`,
        group,
        severity: "warn",
        pass: Boolean(v),
        message: v ? `${p} present.` : `Missing ${p}.`,
      })
    );
  }

  const url = get("og:url");
  if (url) {
    const abs = toAbsoluteUrl(url, pageUrl);
    const u = abs ? tryParseUrl(abs) : null;
    pushFinding(
      findings,
      makeFinding({
        id: "og-url-https",
        group,
        severity: "warn",
        pass: Boolean(u && u.protocol === "https:"),
        message:
          u && u.protocol === "https:"
            ? "og:url is absolute https."
            : "og:url should be an absolute https URL.",
        details: { ogUrl: url, resolved: abs },
      })
    );
  }

  const img = get("og:image");
  if (img) {
    const abs = toAbsoluteUrl(img, pageUrl);
    const u = abs ? tryParseUrl(abs) : null;
    pushFinding(
      findings,
      makeFinding({
        id: "og-image-https",
        group,
        severity: "warn",
        pass: Boolean(u && u.protocol === "https:"),
        message:
          u && u.protocol === "https:"
            ? "og:image is absolute https."
            : "og:image should be an absolute https URL.",
        details: { ogImage: img, resolved: abs },
      })
    );
  }

  const w = get("og:image:width");
  const h = get("og:image:height");
  if (w || h) {
    pushFinding(
      findings,
      makeFinding({
        id: "og-image-dimensions",
        group,
        severity: "warn",
        pass: /^\d+$/.test(w) && /^\d+$/.test(h),
        message:
          /^\d+$/.test(w) && /^\d+$/.test(h)
            ? "og:image:width and og:image:height are numeric."
            : "og:image:width/height should be numeric.",
        details: { width: w, height: h },
      })
    );
  }

  return findings;
};

export const auditViewport = ($, findings) => {
  const group = "head";
  const c = normalizeSpace($('head meta[name="viewport"]').attr("content"));

  pushFinding(
    findings,
    makeFinding({
      id: "viewport",
      group,
      severity: "error",
      pass: Boolean(c),
      message: c ? "Viewport meta present." : "Missing viewport meta.",
    })
  );

  if (c && !/width\s*=\s*device-width/i.test(c)) {
    pushFinding(
      findings,
      makeFinding({
        id: "viewport-width-device",
        group,
        severity: "warn",
        pass: false,
        message: `Viewport meta missing width=device-width (${c}).`,
        details: { content: c },
      })
    );
  }

  return findings;
};

export const extractFaviconHrefs = ($) => {
  const rels = [
    'link[rel="icon"]',
    'link[rel="shortcut icon"]',
    'link[rel="apple-touch-icon"]',
    'link[rel="apple-touch-icon-precomposed"]',
  ];

  const hrefs = rels
    .flatMap((sel) =>
      $(sel)
        .toArray()
        .map((el) => normalizeSpace($(el).attr("href")))
    )
    .filter(Boolean);

  return [...new Set(hrefs)];
};

export const auditFavicon = async ($, findings, { pageUrl } = {}) => {
  const group = "head";
  const hrefs = extractFaviconHrefs($);

  if (!hrefs.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "favicon",
        group,
        severity: "warn",
        pass: false,
        message: "No favicon link tags found in <head>.",
      })
    );
    return findings;
  }

  const href = hrefs[0];
  const abs = toAbsoluteUrl(href, pageUrl);
  if (!abs) {
    pushFinding(
      findings,
      makeFinding({
        id: "favicon-url",
        group,
        severity: "warn",
        pass: false,
        message: "Favicon href could not be resolved to an absolute URL.",
        details: { href },
      })
    );
    return findings;
  }

  const res = await headOrGet(abs).catch(() => ({ status: 0 }));
  const ok = isOkStatus(res.status);

  pushFinding(
    findings,
    makeFinding({
      id: "favicon-status",
      group,
      severity: ok ? "info" : "warn",
      pass: ok,
      message: ok
        ? `Favicon responded with ${res.status}.`
        : `Favicon did not respond with 200/304 (got ${res.status}).`,
      details: { faviconUrl: abs, status: res.status },
    })
  );

  return findings;
};

export const auditLcpPreload = (
  $,
  findings,
  { pageUrl, lcpImageUrl } = {},
  config = {}
) => {
  const group = "head";
  const enabled = config?.lcpPreload?.enabled ?? true;
  if (!enabled) return findings;

  if (!lcpImageUrl) {
    pushFinding(
      findings,
      makeFinding({
        id: "lcp-preload",
        group,
        severity: "info",
        pass: true,
        message: "No LCP image URL detected (text LCP or unavailable).",
      })
    );
    return findings;
  }

  const lcpAbs = toAbsoluteUrl(lcpImageUrl, pageUrl) || lcpImageUrl;

  const preloads = $('head link[rel="preload"][as="image"]')
    .toArray()
    .map((el) => normalizeSpace($(el).attr("href")))
    .filter(Boolean)
    .map((h) => toAbsoluteUrl(h, pageUrl) || h);

  const has = preloads.some((h) => h === lcpAbs);

  pushFinding(
    findings,
    makeFinding({
      id: "lcp-preload",
      group,
      severity: "warn",
      pass: has,
      message: has ? "LCP image is preloaded." : "Missing preload for LCP image.",
      details: { lcpImageUrl: lcpAbs, preloads },
    })
  );

  return findings;
};

/** ---------------------------
 * BODY audits
 * ---------------------------
 */

export const auditH1 = ($, findings, config = {}) => {
  const group = "body";
  const warnOver = config?.headings?.h1WarnOver ?? 100;

  const h1s = $("h1").toArray();
  pushFinding(
    findings,
    makeFinding({
      id: "h1-count",
      group,
      severity: "error",
      pass: h1s.length === 1,
      message:
        h1s.length === 1
          ? "Exactly one H1 found."
          : `Found ${h1s.length} H1 tags (expected 1).`,
    })
  );

  if (h1s.length >= 1) {
    const t = normalizeSpace($(h1s[0]).text());
    pushFinding(
      findings,
      makeFinding({
        id: "h1-text",
        group,
        severity: "error",
        pass: t.length > 0,
        message: t.length > 0 ? "H1 contains text." : "H1 is empty.",
        details: { text: t, length: t.length },
      })
    );

    if (t.length > warnOver) {
      pushFinding(
        findings,
        makeFinding({
          id: "h1-length",
          group,
          severity: "warn",
          pass: false,
          message: `H1 longer than ${warnOver} characters (${t.length}).`,
          details: { length: t.length },
        })
      );
    }
  }

  const firstHeading = $("h1,h2,h3,h4,h5,h6").first().get(0);
  if (
    firstHeading &&
    firstHeading.tagName &&
    firstHeading.tagName.toLowerCase() !== "h1"
  ) {
    pushFinding(
      findings,
      makeFinding({
        id: "heading-sequence-first",
        group,
        severity: "warn",
        pass: false,
        message: `First heading is <${firstHeading.tagName.toLowerCase()}> (expected <h1>).`,
      })
    );
  }

  return findings;
};

export const auditH2 = ($, findings, config = {}) => {
  const group = "body";
  const forbid = (config?.links?.forbidAnchorText ?? [
    "click here",
    "learn more",
    "more",
  ]).map((x) => x.toLowerCase());

  const h2s = $("h2").toArray();
  if (!h2s.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "h2-presence",
        group,
        severity: "info",
        pass: true,
        message: "No H2 found (not always required).",
      })
    );
    return findings;
  }

  const firstH2 = $("h2").first();
  const beforeFirstH2 = firstH2.prevAll("h3,h4,h5,h6");
  if (beforeFirstH2.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "heading-sequence-h2",
        group,
        severity: "warn",
        pass: false,
        message: "Found H3+ before the first H2.",
      })
    );
  }

  const texts = h2s.map((n) => normalizeSpace($(n).text())).filter(Boolean);
  const seen = new Map();
  const dups = [];
  for (const t of texts) {
    const k = safeLower(t);
    const count = (seen.get(k) ?? 0) + 1;
    seen.set(k, count);
  }
  for (const [k, count] of seen.entries()) {
    if (count > 1) dups.push({ text: k, count });
  }

  pushFinding(
    findings,
    makeFinding({
      id: "h2-unique",
      group,
      severity: dups.length ? "warn" : "info",
      pass: dups.length === 0,
      message: dups.length
        ? "Duplicate H2 text found."
        : "H2 text appears unique.",
      details: dups.length ? { duplicates: dups } : undefined,
    })
  );

  const linkH2s = h2s
    .map((n) => ($(n).find("a").length ? normalizeSpace($(n).text()) : null))
    .filter(Boolean);

  if (linkH2s.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "h2-links",
        group,
        severity: "warn",
        pass: false,
        message: "Some H2 headings contain links (flag for investigation).",
        details: { h2Texts: linkH2s },
      })
    );
  }

  const generic = texts.filter((t) => forbid.includes(safeLower(t)));
  if (generic.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "h2-generic-text",
        group,
        severity: "warn",
        pass: false,
        message: "Generic H2 text found (e.g., Learn More/Click Here).",
        details: { h2Texts: generic },
      })
    );
  }

  return findings;
};

export const auditImageDimensions = ($, findings) => {
  const group = "body";
  const imgs = $("img").toArray();

  if (!imgs.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "img-dimensions",
        group,
        severity: "info",
        pass: true,
        message: "No <img> tags found.",
      })
    );
    return findings;
  }

  const missing = [];
  for (const img of imgs) {
    const w = normalizeSpace($(img).attr("width"));
    const h = normalizeSpace($(img).attr("height"));
    if (!w || !h) {
      missing.push({
        src:
          normalizeSpace($(img).attr("src")) ||
          normalizeSpace($(img).attr("data-src")) ||
          null,
        width: w || null,
        height: h || null,
      });
    }
  }

  pushFinding(
    findings,
    makeFinding({
      id: "img-dimensions",
      group,
      severity: missing.length ? "warn" : "info",
      pass: missing.length === 0,
      message: missing.length
        ? `Some images are missing width/height (${missing.length}).`
        : "All images have width/height attributes.",
      details: missing.length ? { missing } : undefined,
    })
  );

  return findings;
};

export const auditImageAltText = ($, findings, config = {}) => {
  const group = "body";
  const requireAlt = config?.images?.requireAlt ?? true;
  if (!requireAlt) return findings;

  const imgs = $("img").toArray();
  const missing = [];

  for (const img of imgs) {
    const alt = $(img).attr("alt");
    const ariaHidden = normalizeSpace($(img).attr("aria-hidden"));
    const role = normalizeSpace($(img).attr("role"));
    const isDecorative = ariaHidden === "true" || role === "presentation";

    if (alt == null || normalizeSpace(alt) === "") {
      if (!isDecorative) {
        missing.push({
          src:
            normalizeSpace($(img).attr("src")) ||
            normalizeSpace($(img).attr("data-src")) ||
            null,
          alt: alt ?? null,
        });
      }
    }
  }

  pushFinding(
    findings,
    makeFinding({
      id: "img-alt",
      group,
      severity: missing.length ? "error" : "info",
      pass: missing.length === 0,
      message: missing.length
        ? `Missing/empty ALT text on ${missing.length} images.`
        : "All images have ALT text (or are explicitly decorative).",
      details: missing.length ? { missing } : undefined,
    })
  );

  return findings;
};

export const auditLazyLoadBelowFold = (
  $,
  findings,
  { lighthouseLhr } = {},
  config = {}
) => {
  const group = "body";
  const enabled = config?.lazyLoad?.enabled ?? true;
  if (!enabled) return findings;

  const offscreen = lighthouseLhr?.audits?.["offscreen-images"];
  const offscreenItems = offscreen?.details?.items || [];
  const offenders = offscreenItems.slice(0, 25).map((it) => ({
    url: it.url || it?.node?.snippet || null,
    wastedMs: it.wastedMs ?? null,
    wastedBytes: it.wastedBytes ?? null,
  }));

  if (offenders.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "lazyload-offscreen",
        group,
        severity: "warn",
        pass: false,
        message:
          "Lighthouse reports offscreen images (consider lazy-loading below-the-fold images).",
        details: { offenders },
      })
    );
  } else {
    pushFinding(
      findings,
      makeFinding({
        id: "lazyload-offscreen",
        group,
        severity: "info",
        pass: true,
        message: "No offscreen images flagged by Lighthouse (or audit unavailable).",
      })
    );
  }

  const firstImg = $("img").first();
  if (firstImg.length) {
    const loading = safeLower(firstImg.attr("loading") || "");
    if (loading === "lazy") {
      pushFinding(
        findings,
        makeFinding({
          id: "lazyload-first-image",
          group,
          severity: "warn",
          pass: false,
          message:
            'First <img> is marked loading="lazy" (may hurt LCP if above the fold).',
          details: {
            src: normalizeSpace(
              firstImg.attr("src") || firstImg.attr("data-src") || ""
            ),
          },
        })
      );
    }
  }

  return findings;
};

export const auditPdpFetchPriority = ($, findings, { pageType = "" } = {}, config = {}) => {
  const group = "body";
  const enabled = config?.pdp?.fetchPriorityHigh ?? true;
  if (!enabled || safeLower(pageType) !== "pdp") return findings;

  const candidates = [
    'img[fetchpriority="high"]',
    'img[data-testid*="hero"]',
    'img[class*="hero"]',
    "main img",
  ];

  let hero = null;
  for (const sel of candidates) {
    const el = $(sel).first();
    if (el.length) {
      hero = el;
      break;
    }
  }

  if (!hero) {
    pushFinding(
      findings,
      makeFinding({
        id: "pdp-fetchpriority",
        group,
        severity: "warn",
        pass: false,
        message: "Could not identify PDP hero image to validate fetchpriority.",
      })
    );
    return findings;
  }

  const fp = safeLower(hero.attr("fetchpriority") || "");
  const ok = fp === "high";

  pushFinding(
    findings,
    makeFinding({
      id: "pdp-fetchpriority",
      group,
      severity: "warn",
      pass: ok,
      message: ok
        ? 'PDP hero image has fetchpriority="high".'
        : 'PDP hero image missing fetchpriority="high".',
      details: {
        src: normalizeSpace(hero.attr("src") || hero.attr("data-src") || ""),
        fetchpriority: fp || null,
      },
    })
  );

  return findings;
};

export const auditDescriptiveLinkText = ($, findings, config = {}) => {
  const group = "body";
  const minTitleLen = config?.links?.requireTitleAttrMinLen ?? 10;
  const forbid = (config?.links?.forbidAnchorText ?? [
    "click here",
    "learn more",
    "more",
  ]).map((x) => x.toLowerCase());
  const severity = config?.links?.severity ?? "warn";

  const links = $("a[href]").toArray();
  if (!links.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "links",
        group,
        severity: "info",
        pass: true,
        message: "No links found.",
      })
    );
    return findings;
  }

  const badTitle = [];
  const badText = [];

  for (const a of links) {
    const text = normalizeSpace($(a).text());
    const title = normalizeSpace($(a).attr("title"));
    if (!title || title.length <= minTitleLen) {
      badTitle.push({
        href: normalizeSpace($(a).attr("href")),
        title: title || null,
        text,
      });
    }
    const t = safeLower(text);
    if (t && forbid.includes(t)) {
      badText.push({ href: normalizeSpace($(a).attr("href")), text });
    }
  }

  pushFinding(
    findings,
    makeFinding({
      id: "link-title-attr",
      group,
      severity,
      pass: badTitle.length === 0,
      message: badTitle.length
        ? `Some links have missing/short title attributes (${badTitle.length}).`
        : "All links have sufficiently long title attributes.",
      details: badTitle.length ? { examples: badTitle.slice(0, 25) } : undefined,
    })
  );

  if (badText.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "link-generic-text",
        group,
        severity,
        pass: false,
        message: "Generic link text found (e.g., Click Here / Learn More / More).",
        details: { examples: badText.slice(0, 25) },
      })
    );
  } else {
    pushFinding(
      findings,
      makeFinding({
        id: "link-generic-text",
        group,
        severity: "info",
        pass: true,
        message: "No generic link text detected in sampled anchors.",
      })
    );
  }

  return findings;
};

export const auditInContentLinksNo404 = async (
  $,
  findings,
  { pageUrl, sampleLimit = 25 } = {},
  config = {}
) => {
  const group = "network";
  const enabled = config?.links?.checkInContent404 ?? true;
  if (!enabled) return findings;

  const container = $("main").length ? $("main") : $("body");
  const links = container
    .find("a[href]")
    .toArray()
    .map((a) => normalizeSpace($(a).attr("href")))
    .filter(Boolean)
    .filter((href) => !href.startsWith("#") && !href.startsWith("mailto:") && !href.startsWith("tel:"))
    .slice(0, sampleLimit);

  if (!links.length) {
    pushFinding(
      findings,
      makeFinding({
        id: "incontent-404",
        group,
        severity: "info",
        pass: true,
        message: "No in-content links found to sample for 404s.",
      })
    );
    return findings;
  }

  const absLinks = links.map((h) => toAbsoluteUrl(h, pageUrl)).filter(Boolean);

  const concurrency = config?.network?.concurrency ?? 6;
  const queue = absLinks.slice();
  const results = [];

  const worker = async () => {
    while (queue.length) {
      const u = queue.shift();
      if (!u) break;
      const res = await headOrGet(u, { timeoutMs: 12000 }).catch(() => ({ status: 0 }));
      results.push({ url: u, status: res.status });
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(concurrency, absLinks.length) }, () => worker())
  );

  const bad = results.filter((r) => r.status === 404);
  pushFinding(
    findings,
    makeFinding({
      id: "incontent-404",
      group,
      severity: bad.length ? "warn" : "info",
      pass: bad.length === 0,
      message: bad.length
        ? `Found ${bad.length} in-content link(s) returning 404 (sampled ${results.length}).`
        : `No 404s found in sampled in-content links (${results.length}).`,
      details: bad.length ? { bad: bad.slice(0, 25) } : undefined,
    })
  );

  return findings;
};

/** ---------------------------
 * NETWORK audits (redirects)
 * ---------------------------
 */

export const auditHttpToHttpsRedirect = async (findings, { url } = {}, config = {}) => {
  const group = "network";
  const enabled = config?.network?.requireHttpsRedirect ?? true;
  if (!enabled) return findings;

  const u = tryParseUrl(url);
  if (!u) {
    pushFinding(findings, makeFinding({
      id: "redirect-http-https",
      group,
      severity: "error",
      pass: false,
      message: "Invalid URL provided (cannot parse).",
      details: { url },
    }));
    return findings;
  }

  const httpUrl = new URL(u.toString());
  httpUrl.protocol = "http:";

  const res = await httpRequest(httpUrl.toString(), { method: "GET" }).catch(() => null);
  if (!res) {
    pushFinding(findings, makeFinding({
      id: "redirect-http-https",
      group,
      severity: "warn",
      pass: false,
      message: "Failed to request HTTP URL to validate redirect.",
      details: { httpUrl: httpUrl.toString() },
    }));
    return findings;
  }

  const status = res.status;
  const loc = res.headers?.location ? String(res.headers.location) : "";
  const okStatus = status === 301 || status === 308;
  const locAbs = loc ? toAbsoluteUrl(loc, httpUrl.toString()) : null;
  const locU = locAbs ? tryParseUrl(locAbs) : null;
  const okHttps = Boolean(locU && locU.protocol === "https:");

  pushFinding(findings, makeFinding({
    id: "redirect-http-https",
    group,
    severity: "warn",
    pass: okStatus && okHttps,
    message: okStatus && okHttps
      ? `HTTP redirects to HTTPS (${status}).`
      : `Expected 301/308 redirect to HTTPS; got ${status} (Location: ${loc || "none"}).`,
    details: { httpUrl: httpUrl.toString(), status, location: locAbs || loc || null },
  }));

  return findings;
};

export const auditNonWwwToWwwRedirect = async (findings, { url } = {}, config = {}) => {
  const group = "network";
  const enabled =
    (config?.network?.preferredHost ?? "www") === "www" &&
    (config?.network?.requireWwwRedirect ?? true);
  if (!enabled) return findings;

  const u = tryParseUrl(url);
  if (!u) {
    pushFinding(findings, makeFinding({
      id: "redirect-nonwww-www",
      group,
      severity: "error",
      pass: false,
      message: "Invalid URL provided (cannot parse).",
      details: { url },
    }));
    return findings;
  }

  const host = u.hostname;
  const isWww = host.startsWith("www.");
  const nonWwwHost = isWww ? host.replace(/^www\./, "") : host;

  const nonWwwUrl = new URL(u.toString());
  nonWwwUrl.hostname = nonWwwHost;

  const res = await httpRequest(nonWwwUrl.toString(), { method: "GET" }).catch(() => null);
  if (!res) {
    pushFinding(findings, makeFinding({
      id: "redirect-nonwww-www",
      group,
      severity: "warn",
      pass: false,
      message: "Failed to request non-www URL to validate redirect.",
      details: { nonWwwUrl: nonWwwUrl.toString() },
    }));
    return findings;
  }

  const status = res.status;
  const loc = res.headers?.location ? String(res.headers.location) : "";
  const okStatus = status === 301 || status === 308;
  const locAbs = loc ? toAbsoluteUrl(loc, nonWwwUrl.toString()) : null;
  const locU = locAbs ? tryParseUrl(locAbs) : null;
  const okWww = Boolean(locU && locU.hostname.startsWith("www.") && locU.protocol === "https:");

  pushFinding(findings, makeFinding({
    id: "redirect-nonwww-www",
    group,
    severity: "warn",
    pass: okStatus && okWww,
    message: okStatus && okWww
      ? `Non-www redirects to www over HTTPS (${status}).`
      : `Expected 301/308 redirect to https://www.*; got ${status} (Location: ${loc || "none"}).`,
    details: { nonWwwUrl: nonWwwUrl.toString(), status, location: locAbs || loc || null },
  }));

  return findings;
};

/** ---------------------------
 * Robots meta audits
 * ---------------------------
 */

export const getRobotsMetaContent = ($) =>
  normalizeSpace($('head meta[name="robots"]').attr("content"));

export const auditParentProductNoNoindex = ($, findings, config = {}) => {
  const group = "head";
  const enabled = config?.robots?.parentProductCheck ?? true;
  if (!enabled) return findings;

  const content = safeLower(getRobotsMetaContent($));
  if (!content) {
    pushFinding(findings, makeFinding({
      id: "robots-parent",
      group,
      severity: "info",
      pass: true,
      message: "No meta robots tag found (treated as pass for indexable pages).",
    }));
    return findings;
  }

  const ok = !content.includes("noindex");
  pushFinding(findings, makeFinding({
    id: "robots-parent",
    group,
    severity: ok ? "info" : "error",
    pass: ok,
    message: ok ? "Meta robots does not include noindex." : "Meta robots includes noindex (should be indexable).",
    details: { content },
  }));

  return findings;
};

export const auditVariantHasNoindex = ($, findings, { isVariant = false } = {}, config = {}) => {
  const group = "head";
  const enabled = config?.robots?.variantNoindexCheck ?? true;
  const strict = config?.robots?.strictVariantNoindexSyntax ?? false;
  if (!enabled || !isVariant) return findings;

  const raw = getRobotsMetaContent($);

  if (strict) {
    const ok = raw === "noindex";
    pushFinding(findings, makeFinding({
      id: "robots-variant",
      group,
      severity: ok ? "info" : "error",
      pass: ok,
      message: ok ? 'Variant has exact robots content "noindex".' : 'Variant missing exact robots content "noindex".',
      details: { raw },
    }));
    return findings;
  }

  const ok = safeLower(raw).includes("noindex");
  pushFinding(findings, makeFinding({
    id: "robots-variant",
    group,
    severity: ok ? "info" : "error",
    pass: ok,
    message: ok ? "Variant has noindex in meta robots." : "Variant missing noindex meta robots.",
    details: { raw },
  }));

  return findings;
};

/** ---------------------------
 * Sitemaps + robots.txt audits
 * ---------------------------
 */

export const auditRobotsTxtLowerEnvDisallowAll = async (
  findings,
  { baseUrl, isProduction = true } = {},
  config = {}
) => {
  const group = "robots";
  const enabled = config?.robotsTxt?.lowerEnvDisallowAll ?? true;
  if (!enabled) return findings;

  if (isProduction) {
    pushFinding(findings, makeFinding({
      id: "robots-lowerenv",
      group,
      severity: "info",
      pass: true,
      message: "Production: lower-env robots.txt disallow-all check skipped.",
    }));
    return findings;
  }

  const robotsUrl = toAbsoluteUrl("/robots.txt", baseUrl);
  const res = await httpRequest(robotsUrl, { method: "GET" }).catch(() => null);
  if (!res) {
    pushFinding(findings, makeFinding({
      id: "robots-lowerenv",
      group,
      severity: "warn",
      pass: false,
      message: "Failed to fetch robots.txt for lower environment check.",
      details: { robotsUrl },
    }));
    return findings;
  }

  const body = res.bodyText || "";
  const hasUserAgentAll = /user-agent:\s*\*/i.test(body);
  const hasDisallowAll = /disallow:\s*\/\s*$/im.test(body);

  pushFinding(findings, makeFinding({
    id: "robots-lowerenv",
    group,
    severity: "error",
    pass: hasUserAgentAll && hasDisallowAll,
    message: hasUserAgentAll && hasDisallowAll
      ? "robots.txt disallows all crawling on lower env."
      : "robots.txt missing required disallow-all rules for lower env.",
    details: { robotsUrl, status: res.status, hasUserAgentAll, hasDisallowAll },
  }));

  return findings;
};

export const auditSitemapIndexAndUrlStatuses = async (
  findings,
  { baseUrl, samplePerSitemap = 50 } = {},
  config = {}
) => {
  const group = "sitemaps";
  const enabled = config?.sitemaps?.enabled ?? false; // default off (heavy)
  if (!enabled) return findings;

  const sitemapIndexUrl = toAbsoluteUrl("/sitemap_index.xml", baseUrl);
  const res = await httpRequest(sitemapIndexUrl, { method: "GET" }).catch(() => null);

  if (!res || !isOkStatus(res.status)) {
    pushFinding(findings, makeFinding({
      id: "sitemap-index",
      group,
      severity: "error",
      pass: false,
      message: `Sitemap index did not return 200/304 (got ${res?.status ?? "no response"}).`,
      details: { sitemapIndexUrl },
    }));
    return findings;
  }

  const xml = res.bodyText || "";
  const sitemapUrls = [...xml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
    .map((m) => m[1])
    .filter(Boolean);

  const uniqueSitemaps = [...new Set(sitemapUrls)].slice(0, config?.sitemaps?.maxSitemaps ?? 25);

  pushFinding(findings, makeFinding({
    id: "sitemap-index",
    group,
    severity: "info",
    pass: true,
    message: `Sitemap index fetched. Found ${uniqueSitemaps.length} sitemap(s) (capped).`,
    details: { sitemapIndexUrl, count: uniqueSitemaps.length },
  }));

  let totalChecked = 0;
  let totalBad = 0;
  const badExamples = [];

  for (const sm of uniqueSitemaps) {
    const smRes = await httpRequest(sm, { method: "GET" }).catch(() => null);
    if (!smRes || !isOkStatus(smRes.status)) {
      totalChecked += 1;
      totalBad += 1;
      if (badExamples.length < 25) badExamples.push({ url: sm, status: smRes?.status ?? 0, type: "sitemap" });
      continue;
    }

    const smXml = smRes.bodyText || "";
    const urls = [...smXml.matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/gi)]
      .map((m) => m[1])
      .filter(Boolean);

    const sample = urls.slice(0, samplePerSitemap);

    for (const u of sample) {
      totalChecked += 1;
      const uRes = await headOrGet(u, { timeoutMs: 12000 }).catch(() => ({ status: 0 }));
      if (!isOkStatus(uRes.status)) {
        totalBad += 1;
        if (badExamples.length < 25) badExamples.push({ url: u, status: uRes.status, type: "url" });
      }
    }
  }

  const badRate = totalChecked ? totalBad / totalChecked : 0;
  const threshold = config?.sitemaps?.badRateThreshold ?? 0.01;

  pushFinding(findings, makeFinding({
    id: "sitemap-url-status",
    group,
    severity: badRate > threshold ? "error" : "info",
    pass: badRate <= threshold,
    message: badRate <= threshold
      ? `Sitemap URL status check OK (bad rate ${(badRate * 100).toFixed(2)}%).`
      : `Sitemap URL status check failed (bad rate ${(badRate * 100).toFixed(2)}% > ${(threshold * 100).toFixed(2)}%).`,
    details: { totalChecked, totalBad, badRate, threshold, examples: badExamples },
  }));

  return findings;
};

/** ---------------------------
 * Main runner
 * ---------------------------
 */

export const runSeoAudits = async ({
  url,
  html,
  lighthouseLhr = null,
  config = {},
  pageType = "",
  isVariant = false,
  isProduction = true,
} = {}) => {
  const findings = [];
  const $ = parseHtml(html);

  // HEAD (HTML)
  auditTitle($, findings, config);
  auditMetaDescription($, findings, config);
  auditCanonical($, findings, { pageUrl: url }, config);
  auditHreflang($, findings, { pageUrl: url, expectLocalized: config?.hreflang?.expectLocalized ?? false }, config);
  auditOpenGraph($, findings, { pageUrl: url });
  auditViewport($, findings);

  // LCP preload (needs Lighthouse)
  const lcpImg = getLcpImageUrlFromLhr(lighthouseLhr);
  auditLcpPreload($, findings, { pageUrl: url, lcpImageUrl: lcpImg }, config);

  // Favicon (network)
  await auditFavicon($, findings, { pageUrl: url });

  // BODY (HTML)
  auditH1($, findings, config);
  auditH2($, findings, config);
  auditImageDimensions($, findings);
  auditImageAltText($, findings, config);
  auditLazyLoadBelowFold($, findings, { lighthouseLhr }, config);
  auditPdpFetchPriority($, findings, { pageType }, config);
  auditDescriptiveLinkText($, findings, config);

  // In-content 404 sampling (network)
  await auditInContentLinksNo404($, findings, { pageUrl: url, sampleLimit: config?.links?.inContentSampleLimit ?? 25 }, config);

  // Redirect checks (network)
  await auditHttpToHttpsRedirect(findings, { url }, config);
  await auditNonWwwToWwwRedirect(findings, { url }, config);

  // Robots meta
  auditParentProductNoNoindex($, findings, config);
  auditVariantHasNoindex($, findings, { isVariant }, config);

  // robots.txt + sitemaps (network)
  const baseUrl = (() => {
    const u = tryParseUrl(url);
    return u ? `${u.protocol}//${u.host}` : null;
  })();

  if (baseUrl) {
    await auditRobotsTxtLowerEnvDisallowAll(findings, { baseUrl, isProduction }, config);
    await auditSitemapIndexAndUrlStatuses(findings, { baseUrl, samplePerSitemap: config?.sitemaps?.samplePerSitemap ?? 50 }, config);
  }

  return {
    url,
    pageType,
    isVariant,
    summary: summarizeFindings(findings),
    findings,
  };
};

export const summarizeFindings = (findings) => {
  const bySeverity = { error: 0, warn: 0, info: 0 };
  let failed = 0;

  for (const f of findings) {
    bySeverity[f.severity] = (bySeverity[f.severity] ?? 0) + 1;
    if (!f.pass && (f.severity === "error" || f.severity === "warn")) failed += 1;
  }

  return {
    total: findings.length,
    failed,
    counts: bySeverity,
  };
};
