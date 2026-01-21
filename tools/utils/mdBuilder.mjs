import fs from "node:fs";

function fmt(v, unit = "") {
  if (v == null) return "—";
  if (unit === "ms") return `${Math.round(v)}ms`;
  return `${v}${unit}`;
}

function header(summary, runUrl){
    const lines = [];
    lines.push(`# CodeVitals Report`);
    lines.push(``);
    lines.push(`**Host:** ${summary.run.host || "—"}`);
    lines.push(`**SHA:** ${summary.run.sha || "—"}`);
    if (runUrl) lines.push(`**Run:** ${runUrl}`);
    lines.push(``);
    return lines;
}

function lighthouse(summary){
    const mdLines = [];
    // Lighthouse summary
    mdLines.push(`## Lighthouse (summary)`);
    mdLines.push(`- Reports: ${summary.lighthouse.count}`);
    mdLines.push(`- Worst Performance: ${summary.lighthouse.worst.performance ?? "—"}`);
    mdLines.push(`- Worst LCP: ${summary.lighthouse.worst.lcpMs != null ? fmt(summary.lighthouse.worst.lcpMs, "ms") : "—"}`);
    mdLines.push(``);
    const top = summary.lighthouse.reports
    .slice()
    .sort((a, b) => (a.scores.performance ?? 999) - (b.scores.performance ?? 999))
    .slice(0, 5);

    if (!top.length) {
    mdLines.push(`No Lighthouse JSON reports found under \`${ARTIFACTS_DIR}/lighthouse\`.`);
    } else {
    mdLines.push(`| Report | Performance | LCP | INP | CLS |`)
    mdLines.push(`|------|-------------|-----|-----|-----|`);
    for (const r of top) {
        mdLines.push(
        `| ${r.relPath} | ${r.scores.performance ?? "—"} | ${fmt(r.metrics.lcpMs, "ms")} | ${fmt(r.metrics.inpMs, "ms")} | ${fmt(r.metrics.cls)} |`
        );
    }
    }
    return mdLines;
}

function seo(summary){
    const mdLines = [];
    // SEO summary
    mdLines.push(`## SEO Audit (summary)`);
    mdLines.push(`- Reports: ${summary.seo.count}`);
    mdLines.push(``);
    if(!summary.seo.count){
        mdLines.push(`No SEO JSON reports found under \`${ARTIFACTS_DIR}/seo\`.`);
        return mdLines;
    }

    mdLines.push(`### Failed SEO Rules`);
    mdLines.push(`| Page | Rule | Severity | Group | Message |`);
    mdLines.push(`|-----|------|----------|-------|---------|`);
    for (const report of summary.seo.reports) {
      for (const failedTest of report.data.findings.failed) {
        mdLines.push(
          `| \`${report.data.url.replace(summary.run.host, "")}\` | ${failedTest.id} | ${failedTest.severity} | ${failedTest.group} | ${failedTest.message.replaceAll("|", "\\|")} |`
        );
      }
    }

    return mdLines;
}

function footer(){
    return [];
}


export const mdBuilder = (summary, OUT_JSON, OUT_MD) => {

  fs.writeFileSync(OUT_JSON, JSON.stringify(summary, null, 2), "utf8");
  const runUrl =
    summary.run.repo && summary.run.runId
      ? `${summary.run.serverUrl}/${summary.run.repo}/actions/runs/${summary.run.runId}`
      : null;
  const lines = [];
  lines.push(...header(summary, runUrl));
  lines.push(...lighthouse(summary));
  lines.push(...seo(summary));
  lines.push(...footer());

  fs.writeFileSync(OUT_MD, lines.join("\n"), "utf8");
  console.log(`Wrote ${OUT_JSON}`);
  console.log(`Wrote ${OUT_MD}`);
}
