import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { ZodError } from "zod";
import { api } from "./routes/api.js";
import { HttpError } from "./utils/errors.js";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: (process.env.FRONTEND_ORIGIN ?? "http://localhost:3000")
      .split(",")
      .map((x) => x.trim()),
    credentials: false,
  }),
);
app.use(express.json({ limit: "1mb" }));

// Hackathon Pitch Request Logger Middleware
app.use((req, res, next) => {
  const start = Date.now();
  const method = req.method;
  const path = req.path;

  // Pretty log incoming call
  const timestamp = new Date().toLocaleTimeString();
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(method);
  const tagColor = isMutation ? "\x1b[45m\x1b[37m" : "\x1b[44m\x1b[37m";

  console.log(`\n\x1b[1m${tagColor} [API CALL] \x1b[0m \x1b[36m${method}\x1b[0m \x1b[33m${path}\x1b[0m \x1b[90m(${timestamp})\x1b[0m`);
  
  if (req.params && Object.keys(req.params).length > 0) {
    console.log(` \x1b[90mParams:\x1b[0m`, req.params);
  }
  if (req.query && Object.keys(req.query).length > 0) {
    console.log(` \x1b[90mQuery:\x1b[0m`, req.query);
  }
  if (isMutation && req.body && Object.keys(req.body).length > 0) {
    // Clone body and redact or keep clean
    console.log(` \x1b[90mBody:\x1b[0m`, JSON.stringify(req.body, null, 2));
  }

  res.on("finish", () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const statusColor =
      status >= 400
        ? "\x1b[31m"
        : status >= 300
        ? "\x1b[33m"
        : "\x1b[32m";
    console.log(
      ` \x1b[90m↳ Result:\x1b[0m ${statusColor}${status}\x1b[0m \x1b[90m(${duration}ms)\x1b[0m\n`
    );
  });

  next();
});

app.get("/", (_req, res) =>
  res.json({
    name: "Receivables Marketplace API",
    version: "0.1.0",
    docs: "See README.md for endpoints.",
  }),
);
app.use("/api", api);
app.use((_req, res) => res.status(404).json({ error: "Not found" }));
app.use(
  (
    error: unknown,
    req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    
    console.log(`\x1b[41m\x1b[37m [API ERROR] \x1b[0m \x1b[31m${req.method} ${req.path} -> ${message}\x1b[0m`);

    if (error instanceof ZodError) {
      console.log(` \x1b[33mValidation Details:\x1b[0m`, error.issues);
      return res
        .status(400)
        .json({
          error: "Invalid request",
          details: error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
    }
    if (error instanceof HttpError)
      return res.status(error.statusCode).json({ error: error.message });
    return res
      .status(500)
      .json({
        error:
          process.env.NODE_ENV === "production"
            ? "Internal server error"
            : message,
      });
  },
);
