# Setup & installation

  > /api -> API folder \
    /web -> Web folder for UI and reporting

### API installation
Run in command line
> cd ./api \
  npm install

### Web Installation
Run in command line
> cd ./web \
  npm install

### Start development mode
> npm run dev

## Docket container setup
You can optionally run your local servers in docker container for portability.\
This feature to follow

## Docker build
> docker build -f Docker/Dockerfile -t code-vitals .

### Run Container
> docker run --rm \
  -e HOST="https://example.com" \
  -v "$PWD/artifacts:/app/artifacts" \
  seo-runner

## Create your first Project (bootstrap)

You need a projectId + apiToken so the GitHub Action can authenticate.

> curl -X POST http://localhost:3000/v1/projects \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo-project",
    "name": "Demo React App",
    "apiToken": "dev-secret-token"
  }'


### Expected response:

> { "ok": true, "projectId": "demo-project" }


Keep that token — this is what you’ll later store as a GitHub Secret.

## Test ingesting a Lighthouse run (manual)

Before wiring the GitHub Action, simulate a run:

> curl -X POST http://localhost:3000/v1/runs \
  -H "Authorization: Bearer dev-secret-token" \
  -H "Content-Type: application/json" \
  -d '{
    "projectId": "demo-project",
    "source": {
      "provider": "github",
      "repo": "org/repo",
      "ref": "refs/heads/main",
      "sha": "abc123"
    },
    "config": {
      "budgets": { "maxSeoDrop": 0.02 }
    },
    "results": [
      {
        "route": "/",
        "url": "http://localhost:5000/",
        "scores": {
          "seo": 0.92,
          "performance": 0.75,
          "accessibility": 0.98,
          "bestPractices": 1
        },
        "timing": { "lcpMs": 2100, "cls": 0.02 }
      }
    ]
  }'

# Run test

## Command Line
> node --env-file=.env tools/run.mjs

