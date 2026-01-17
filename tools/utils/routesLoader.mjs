import { importAsync } from "./importAsync.mjs";

const consumerRoutes = await importAsync(
  process.env.ROUTES_FILE
);
export const routes = consumerRoutes.routes;