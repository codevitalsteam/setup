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

export const fetchHtml = async (url) => {
  console.log(`Fetching HTML for SEO audits from ${url}... with user-agent: ${process.env.USER_AGENT || "CodeVitalsBot/1.0"}`);
  const res = await request(url, {
    method: "GET",
    headers: { "user-agent": process.env.USER_AGENT || "CodeVitalsBot/1.0" },
  });
  const html = await res.body.text();
  return { status: res.statusCode, headers: res.headers, html };
};

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));