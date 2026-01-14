import fs from "node:fs";
import path from "node:path";

/**
 * Save SEO results to artifacts/seo
 * @param {Object} params
 * @param {string} params.route - Page route or URL slug
 * @param {Object} params.results - SEO audit result object
 */
export const saveSeoResults = ({ route, results }) => {
  const OUT_DIR = path.resolve("artifacts/seo");
  fs.mkdirSync(OUT_DIR, { recursive: true });


  console.log(`Saving SEO results for ${route}...`);

  const uriPath = new URL(route); // validate URL

  console.log(`Parsed URL path: ${uriPath.pathname}`);

  const safeName = uriPath.pathname == "/" ? "home" : uriPath.pathname
    .replace(/[^\w\d]+/g, "_")
    .replace(/^_|_$/g, "");

  const filePath = path.join(OUT_DIR, `${safeName}.json`);

  fs.writeFileSync(
    filePath,
    JSON.stringify(
      {
        route,
        timestamp: new Date().toISOString(),
        results,
      },
      null,
      2
    )
  );

  return filePath;
};
