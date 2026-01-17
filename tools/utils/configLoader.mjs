import { importAsync } from "./importAsync.mjs";

const consumerConfig = await importAsync(
  process.env.CONFIG_FILE
);

export const config = consumerConfig.config;
