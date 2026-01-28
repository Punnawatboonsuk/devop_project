import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",

  datasources: {
    db: {
      provider: "postgresql",
      url: process.env.DATABASE_URL!,
    },
  },
});
  