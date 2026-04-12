import { z } from "zod";

const EnvSchema = z.object({
  PORT: z.coerce.number().default(3001),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  CORS_ORIGINS: z.string().default("http://localhost:3000,http://localhost:8081"),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),

  AT_API_KEY: z.string().min(1),
  AT_USERNAME: z.string().min(1),
  AT_SENDER_ID: z.string().default("DashMeal"),

  CAMPAY_APP_USERNAME: z.string().min(1),
  CAMPAY_APP_PASSWORD: z.string().min(1),
  CAMPAY_BASE_URL: z.string().url(),
  CAMPAY_CALLBACK_URL: z.string().url(),

  GOOGLE_MAPS_API_KEY: z.string().min(1),
  EXPO_ACCESS_TOKEN: z.string().optional(),

  STORAGE_BUCKET_PRODUCTS: z.string().default("product-images"),
  STORAGE_BUCKET_DOCUMENTS: z.string().default("brand-documents"),
  STORAGE_BUCKET_INVOICES: z.string().default("invoices"),
});

function loadEnv() {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    console.error("❌ Variables d'environnement manquantes ou invalides:");
    result.error.issues.forEach((issue) => {
      console.error(`  - ${issue.path.join(".")}: ${issue.message}`);
    });
    process.exit(1);
  }
  return result.data;
}

export const env = loadEnv();
