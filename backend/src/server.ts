import cors from "cors";
import express from "express";
import helmet from "helmet";
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.string().default("0.0.0.0"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  CORS_ORIGINS: z.string().default("http://localhost:8081,http://localhost:19006"),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error("Invalid backend environment", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

const env = parsed.data;
const allowedOrigins = new Set(
  env.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
);

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({
  credentials: true,
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin)) return callback(null, true);
    return callback(new Error("Origin is not allowed by CORS"));
  },
}));
app.use(express.json({ limit: "32kb", strict: true }));

app.get("/healthz", (_request, response) => {
  response.status(200).json({
    status: "ok",
    service: "vorzane-backend",
    environment: env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.use((_request, response) => {
  response.status(404).json({ error: "Not found" });
});

app.use((error: unknown, _request: express.Request, response: express.Response, _next: express.NextFunction) => {
  const message = error instanceof Error ? error.message : "Unexpected server error";
  if (env.NODE_ENV !== "production") console.error(error);
  response.status(message.includes("CORS") ? 403 : 400).json({
    error: env.NODE_ENV === "production" ? "Request could not be processed" : message,
  });
});

app.listen(env.PORT, env.HOST, () => {
  console.log(`VORZANE backend listening on ${env.HOST}:${env.PORT}`);
});
