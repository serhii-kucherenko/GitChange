import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "sqlite",
  schema: "./src/schema/drizzle/schema.ts",
  out: "./migrations",
  dbCredentials: {
    url: ".gitchange/index.sqlite",
  },
});
