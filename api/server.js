import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
import { createApp } from "./src/app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// repo root is two levels up from api/src
dotenv.config({ path: path.resolve(__dirname, "../.env") });
const app = createApp();
app.listen(process.env.API_PORT, () => console.log("API listening on port", process.env.API_PORT));
