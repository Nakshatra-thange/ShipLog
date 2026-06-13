import "dotenv/config";
import express from "express";
import cors from "cors";
import { prisma } from "./lib/prisma.ts";
import { hashPassword, verifyPassword, signToken, verifyToken } from "../lib/auth.js";
import type { JWTPayload } from "./lib/auth.ts";
import { v4 as uuidv4 } from "uuid";

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: process.env.VITE_APP_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());

// ──────────────────────────────────────────────────
// Middleware: verify auth token from Authorization header
// ──────────────────────────────────────────────────
async function requireAuth(
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) {
  const token = req.headers.authorization?.replace("Bearer ", "");
  if (!token) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }
  const payload = await verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }
  (req as express.Request & { user: JWTPayload }).user = payload;
  next();
}

// ──────────────────────────────────────────────────
// AUTH ROUTES
// ──────────────────────────────────────────────────

// POST /api/auth/signup
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { email, password, name } = req.body as {
      email: string;
      password: string;
      name: string;
    };

    if (!email || !password || !name) {
      res.status(400).json({ error: "Email, password, and name are required" });
      return;
    }
    if (password.length < 8) {
      res.status(400).json({ error: "Password must be at least 8 characters" });
      return;
    }

    const existing = await prisma.customer.findUnique({ where: { email } });
    if (existing) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const passwordHash = await hashPassword(password);
    const customer = await prisma.customer.create({
      data: { email, name, passwordHash },
    });

    const token = await signToken({
      customerId: customer.id,
      email: customer.email,
      plan: customer.plan,
    });

    res.status(201).json({
      token,
      customer: { id: customer.id, email: customer.email, name: customer.name, plan: customer.plan },
    });
  } catch (err) {
    console.error("Signup error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/auth/login
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body as { email: string; password: string };

    if (!email || !password) {
      res.status(400).json({ error: "Email and password are required" });
      return;
    }

    const customer = await prisma.customer.findUnique({ where: { email } });
    if (!customer || !customer.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const valid = await verifyPassword(password, customer.passwordHash);
    if (!valid) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const token = await signToken({
      customerId: customer.id,
      email: customer.email,
      plan: customer.plan,
    });

    res.json({
      token,
      customer: { id: customer.id, email: customer.email, name: customer.name, plan: customer.plan },
    });
  } catch (err) {
    console.error("Login error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/auth/me
app.get("/api/auth/me", requireAuth, async (req, res) => {
  try {
    const user = (req as express.Request & { user: JWTPayload }).user;
    const customer = await prisma.customer.findUnique({
      where: { id: user.customerId },
      select: { id: true, email: true, name: true, plan: true, avatarUrl: true, createdAt: true },
    });
    if (!customer) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json({ customer });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ──────────────────────────────────────────────────
// PROJECT ROUTES
// ──────────────────────────────────────────────────

// GET /api/projects — list all projects for the logged-in customer
app.get("/api/projects", requireAuth, async (req, res) => {
  try {
    const user = (req as express.Request & { user: JWTPayload }).user;
    const projects = await prisma.project.findMany({
      where: { customerId: user.customerId },
      orderBy: { createdAt: "desc" },
    });
    res.json({ projects });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// POST /api/projects — create a new project
app.post("/api/projects", requireAuth, async (req, res) => {
  try {
    const user = (req as express.Request & { user: JWTPayload }).user;
    const { name, domain } = req.body as { name: string; domain?: string };

    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }

    const project = await prisma.project.create({
      data: {
        customerId: user.customerId,
        name,
        domain: domain || null,
        token: uuidv4(),
      },
    });

    res.status(201).json({ project });
  } catch (err) {
    console.error("Create project error:", err);
    res.status(500).json({ error: "Something went wrong" });
  }
});

// GET /api/projects/:id — get a single project (must own it)
app.get("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as express.Request & { user: JWTPayload }).user;
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, customerId: user.customerId },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json({ project });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// DELETE /api/projects/:id
app.delete("/api/projects/:id", requireAuth, async (req, res) => {
  try {
    const user = (req as express.Request & { user: JWTPayload }).user;
    const project = await prisma.project.findFirst({
      where: { id: req.params.id, customerId: user.customerId },
    });
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    await prisma.project.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Something went wrong" });
  }
});

// ──────────────────────────────────────────────────
// Health check
// ──────────────────────────────────────────────────
app.get("/api/health", (_req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`ShipLog API running at http://localhost:${PORT}`);
});