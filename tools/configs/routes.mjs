import { importAsync } from "../utils/importAsync.mjs";

const defaultRoutes = {
    lighthouse: ["/"],
    seoAudit: ["/"]
};

const consumerRoutes = await importAsync(
  process.env.ROUTES_FILE
);
export const routes = consumerRoutes || defaultRoutes;