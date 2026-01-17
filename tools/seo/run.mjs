import "dotenv/config";

import { config } from "../utils/configLoader.mjs";
import { routes } from "../utils/routesLoader.mjs";
import { saveSeoResults } from "./helpers/seoArtifactsHelper.js";
import { fetchHtml, sleep } from "./helpers/seoHelpers.js";
import { 
  getLcpImageUrlFromLhr
} from "./helpers/seoLighthouseHelpers.js";
import {
  auditTitle,
  auditMetaDescription,
  auditCanonical,
  auditHreflang,
  auditOpenGraph,
  auditViewport,
  auditLcpPreload,
  auditFavicon,
  auditH1,
  auditH2,
  auditImageDimensions,
  auditImageAltText,
  auditPdpFetchPriority,
  auditDescriptiveLinkText,
  auditInContentLinksNo404,
  auditHttpToHttpsRedirect,
  auditNonWwwToWwwRedirect,
  auditParentProductNoNoindex,
  auditVariantHasNoindex,
  auditRobotsTxtLowerEnvDisallowAll,
  auditSitemapIndexAndUrlStatuses,
  auditLazyLoadBelowFold
} from "./helpers/seoAuditHelpers.js";
import { parseHtml, tryParseUrl } from "./helpers/seoHelpers.js";

const host = process.env.HOST || "http://localhost:3000"; 

export const runSeoAudits = async ({
  url,
  html,
  route,
  config = {},
  pageType = "",
  isVariant = false,
  isProduction = true,
  sitemapFilename = null,
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
  const lcpImg = getLcpImageUrlFromLhr(route);
  auditLcpPreload($, findings, { pageUrl: url, lcpImageUrl: lcpImg }, config);

  // Favicon (network)
  await auditFavicon($, findings, { pageUrl: url });

  // BODY (HTML)
  auditH1($, findings, config);
  auditH2($, findings, config);
  auditImageDimensions($, findings);
  auditImageAltText($, findings, config);
  // Requires Lighthouse to identify images below the fold
  auditLazyLoadBelowFold($, findings, route, config);
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
    await auditSitemapIndexAndUrlStatuses(findings, { baseUrl, sitemapFilename, samplePerSitemap: config?.sitemaps?.samplePerSitemap ?? 50 }, config);
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

// SEO Audit should have it's own routes
const seoRoutes = (
  process.env.SEO_ROUTES ? process.env.SEO_ROUTES.split(",") : routes.seoAudit
)
  .map((s) => s.trim())
  .filter(Boolean);


// Perform SEO audits
console.log("🚦 Starting SEO audits...");
console.log(`Using config: ${JSON.stringify(config.seoAudit)}`);
console.log(`Using routes: ${JSON.stringify(seoRoutes)}`);

const delayMs = Number(process.env.CRAWL_DELAY_MS ?? "0");

for (const route of seoRoutes) {
  const url = `${host}${route.startsWith("/") ? route : `/${route}`}`;

  console.log(`\nFetching HTML for SEO audits from ${url}...`);
  const { status, headers, html } = await fetchHtml(url);
  console.log(`Fetched HTML: status=${status}, content-type=${headers["content-type"]}`);

  const result = await runSeoAudits({
    url,
    html,
    route,
    config: config.seoAudit,
    // pageType: "PDP",
    // isVariant: false,
    isProduction: process.env.ENVIRONMENT === "prod",
    sitemapFilename: process.env.SITEMAP,
  });

  saveSeoResults({
    route: url,
    results: result,
  });

  console.dir(result, { depth: null, colors: true });

  if (delayMs > 0) await sleep(delayMs);
}

console.log("\n✅ Custom SEO checks complete");
