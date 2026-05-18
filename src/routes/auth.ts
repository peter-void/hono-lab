import { Hono } from "hono";
import { Variables } from "../types";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import { prisma } from "../lib/prisma";
import { HTTPException } from "hono/http-exception";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { zValidator } from "../lib/validator";
import { createRateLimitMiddleware } from "../middleware/rate-limit.middleware";
import { authRateLimit } from "../lib/rate-limit";
import { randomBytes } from "crypto";
import { sendVerificationEmail } from "../lib/email";

const auth = new Hono<{ Variables: Variables }>();

auth.use(createRateLimitMiddleware(authRateLimit));

auth.post("/register", zValidator("json", registerSchema), async (c) => {
  const { name, email, password } = c.req.valid("json");

  const existingUser = await prisma.user.findUnique({
    where: { email },
  });

  if (existingUser) {
    throw new HTTPException(409, { message: "Email already registered" });
  }

  const salt = await bcrypt.genSalt(10);
  const hashedPassword = await bcrypt.hash(password, salt);

  const verificationToken = randomBytes(32).toString("hex");

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword, verificationToken },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

  await sendVerificationEmail(email, verificationToken);

  return c.json(
    {
      success: true,
      message: "Registration successful",
      data: user,
    },
    201,
  );
});

auth.post("/login", zValidator("json", loginSchema), async (c) => {
  const { email, password } = c.req.valid("json");

  const user = await prisma.user.findUnique({
    where: { email },
  });

  if (!user) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  const isPasswordValid = await bcrypt.compare(password, user.password);

  if (!isPasswordValid) {
    throw new HTTPException(401, { message: "Invalid email or password" });
  }

  if (!user.isVerified) {
    throw new HTTPException(403, {
      message: "Please verify your email before logging in",
    });
  }

  const token = await jwt.sign(
    { userId: user.id, email: user.email },
    process.env.JWT_SECRET!,
    { expiresIn: "7d" },
  );

  return c.json({
    success: true,
    message: "login successful",
    data: {
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
      },
    },
  });
});

auth.get("/verify/:token", async (c) => {
  const token = c.req.param("token");

  const user = await prisma.user.findFirst({
    where: { verificationToken: token },
  });

  if (!user) {
    throw new HTTPException(404, {
      message: "Invalid or expired verification token",
    });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      isVerified: true,
      verificationToken: null,
    },
  });

  return c.json({
    success: true,
    message: "Email verified successfully. You can now login.",
  });
});

export default auth;
