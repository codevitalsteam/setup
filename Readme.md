# CodeVitals Post-Deploy Audit

A GitHub Action for running **post-deployment performance and SEO audits** against a live site using Lighthouse and custom SEO checks.

**CodeVitals helps teams catch performance regressions and SEO issues immediately after deployment — before they impact users, rankings, or revenue.**

This action is designed to be **consumer-configurable**, allowing teams to define their own thresholds, rules, and routes directly in their repository.

---

## Features

* Lighthouse audits (Mobile & Desktop)
* Core Web Vitals thresholds (LCP, FCP, CLS, INP, TBT)
* SEO audits (titles, meta descriptions, canonicals, robots, links, images, etc.)
* Configurable routes per audit type
* Post-deployment friendly (runs against live URLs)
* GitHub Actions–native

---

## Requirements

* A deployed, publicly accessible site
* GitHub Actions enabled in your repository
* Node.js is handled automatically by the action

---

## Quick Start

Add the following job **after your deploy job**:

```yaml
post_deploy_audit:
  needs: deploy
  runs-on: ubuntu-latest
  permissions:
    contents: read
  steps:
    - uses: actions/checkout@v4

    - name: Run CodeVitals post-deploy audit
      uses: codevitalsteam/setup@v1.0
      with:
        host: https://example.com
        user_agent: LUComposableAPI/1.0
        config_path: .codevitals/config.js
        routes_path: .codevitals/routes.js
```

> `actions/checkout@v4` is required when using repository-based config or routes files.

---

## Inputs

### Required

| Input  | Description                                        |
| ------ | -------------------------------------------------- |
| `host` | Base URL to audit (e.g. `https://www.example.com`) |

### Optional

| Input         | Default             | Description                                  |
| ------------- | ------------------- | -------------------------------------------- |
| `user_agent`  | `CodeVitalsBot/1.0` | User agent used for all requests             |
| `devices`     | `mobile,desktop`    | Comma-separated devices. Overrides config.js |
| `lh_routes`   | `/`                 | Comma-separated Lighthouse routes            |
| `seo_routes`  | `/`                 | Comma-separated SEO routes                   |
| `config_path` | —                   | Path to consumer `config.js`                 |
| `routes_path` | —                   | Path to consumer `routes.js`                 |

---

## Repository Setup

Create the following structure in your repository:

```
.codevitals/
  config.js
  routes.js
```

---

## Configuration

### `.codevitals/config.js`

Defines Lighthouse thresholds, devices, and SEO audit rules.

```js
export const config = {
  lighthouse: {
    devices: ["desktop"],
    thresholds: {
      seo: 90,
      performance: 70,
      accessibility: 0,
      bestPractices: 0,
      cls: 0.1,
      fcpMs: 1800,
      lcpMs: 2500,
      inpMs: 200,
      tbtMs: 300,
    },
  },
  seoAudit: {
    title: {
      min: 15,
      warnOver: 60,
      warnOnSpecialChars: false,
    },
    description: {
      min: 30,
      warnOver: 160,
    },
    canonical: {
      requireHttps: true,
      requireAbsolute: true,
      warnOnQueryParams: true,
    },
    hreflang: {
      expectLocalized: true,
      requireXDefault: true,
    },
    images: { requireAlt: true },
    links: {
      forbidAnchorText: ["click here", "learn more", "more"],
      severity: "warn",
    },
    network: {
      requireHttpsRedirect: true,
      preferredHost: "www",
    },
  },
};
```

---

### `.codevitals/routes.js`

Defines which routes are audited per audit type.

```js
export const routes = {
  lighthouse: ["/"],
  seoAudit: ["/"],
};
```

---

## Route Precedence

Routes can be defined in **two ways**:

1. YAML inputs (`lh_routes`, `seo_routes`)
2. `.codevitals/routes.js`

**YAML inputs take precedence** over `routes.js`.

### Example: Override Lighthouse routes only

```yaml
with:
  host: https://example.com
  lh_routes: "/,/p/foo,/c/lighting"
  config_path: .codevitals/config.js
  routes_path: .codevitals/routes.js
```

---

## Device Precedence

1. `devices` input (YAML)
2. `config.lighthouse.devices`
3. Default: `mobile,desktop`

---

## Recommended Usage Pattern

* Keep **thresholds and SEO rules** in `config.js`
* Keep **stable routes** in `routes.js`
* Override routes or devices in YAML for environment-specific needs

---

## Warnings & Performance Considerations

* **Sitemap validation is disabled by default**. Sitemap crawling can be expensive on large sites and may significantly increase runtime and resource usage. Enable it only when needed.
* Auditing a large number of routes can increase execution time and may hit GitHub Actions limits. Start small and expand gradually.
* Lighthouse desktop audits are more resource-intensive than mobile. Prefer mobile-first unless desktop metrics are required.
* Ensure bot protection (WAF, CDN rules) allows the configured `user_agent`.

---

## Notes

* Ensure your site is accessible from GitHub Actions
* Allow the configured user agent if bot protection is enabled
* Best used as a **post-deployment quality gate**

---

## License

MIT
