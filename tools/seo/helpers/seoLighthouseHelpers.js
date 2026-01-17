import fs from "fs";
import path from "path";

/** ---------------------------
 * Lighthouse helpers
 * ---------------------------
 */

const LH_DIR = path.resolve("artifacts/lighthouse");

export const lighthouseLhrForRoute = (route) => {
  try {
    const slugBase = route === "/" ? "home" : route.replaceAll("/", "_").replace(/^_+/, "");
    const lhPath = path.join(LH_DIR, `${slugBase}-desktop.json`)  
    if (!fs.existsSync(lhPath)) {
      console.warn(`⚠️ Missing lighthouse file: ${lhPath} (skipping ${route})`);
      return null;
    }
    
    const lighthouseJson = JSON.parse(fs.readFileSync(lhPath, "utf8"));
    const lhr = lighthouseJson.lhr ?? lighthouseJson;
    return lhr;
  } catch {
    return null;
  }
}

export const getLcpImageUrlFromLhr = (route) => {
  try {

    const lhr = lighthouseLhrForRoute(route);
    if (!lhr) return null;

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