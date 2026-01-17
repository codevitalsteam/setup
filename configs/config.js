export const config = {
  lighthouse : {
    devices: ['desktop'],
    thresholds:{
      seo: 90,
      performance: 70,
      accessibility: 0,
      bestPractices: 0,
      cls: 0.1,
      fcpMs: 1800,
      lcpMs: 2500,
      inpMs: 200,
      tbtMs: 300
    }
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

    lcpPreload: {
      enabled: true,
    },

    headings: {
      h1WarnOver: 100,
    },

    images: {
      requireAlt: true,
    },

    lazyLoad: {
      enabled: true,
    },

    pdp: {
      fetchPriorityHigh: true,
    },

    links: {
      requireTitleAttrMinLen: 10,
      forbidAnchorText: ["click here", "learn more", "more"],
      checkInContent404: true,
      inContentSampleLimit: 25,
      severity: "warn",
    },

    network: {
      requireHttpsRedirect: true,
      preferredHost: "www",
      requireWwwRedirect: true,
      concurrency: 6,
    },

    robots: {
      parentProductCheck: true,
      variantNoindexCheck: true,
      strictVariantNoindexSyntax: false,
    },

    robotsTxt: {
      lowerEnvDisallowAll: true,
    },

    sitemaps: {
      enabled: false, // heavier; enable when ready
      samplePerSitemap: 50,
      maxSitemaps: 25,
      badRateThreshold: 0.01,
    },
  }
}