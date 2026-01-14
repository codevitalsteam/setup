# syntax=docker/dockerfile:1
FROM node:22-bookworm

ARG SF_DEB_URL="https://download.screamingfrog.co.uk/products/seo-spider/screamingfrogseospider_20.0_all.deb"

RUN apt-get update && apt-get install -y --no-install-recommends \
  wget ca-certificates gnupg \
  default-jre \
  xvfb \
  xauth \
  fonts-dejavu fonts-liberation \
  chromium \
  libasound2 \
  libatk-bridge2.0-0 libatk1.0-0 \
  libcairo2 libcups2 \
  libdbus-1-3 libdrm2 libgbm1 \
  libglib2.0-0 libgtk-3-0 \
  libnss3 libpango-1.0-0 \
  libx11-6 libx11-xcb1 libxcb1 \
  libxcomposite1 libxdamage1 libxext6 libxfixes3 \
  libxrandr2 libxrender1 libxshmfence1 libxss1 libxi6 libxtst6 \
  xdg-utils \
  && rm -rf /var/lib/apt/lists/*

# Install Screaming Frog
RUN wget -O /tmp/sf.deb "${SF_DEB_URL}" \
  && apt-get update && apt-get install -y /tmp/sf.deb \
  && rm -f /tmp/sf.deb \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm ci --omit=dev

COPY . .

RUN screamingfrogseospider --version || true

ENV CHROME_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production
ENV HOST=http://dev.test.lumense.com
#Optionally set your Screaming Frog licence key here
ENV SF_LICENCE_KEY=

# Key change: always run inside xvfb
ENTRYPOINT ["xvfb-run", "-a"]

# Run an orchestrator script (you create it)
CMD ["node", "tools/lighthouse/run.mjs"]
