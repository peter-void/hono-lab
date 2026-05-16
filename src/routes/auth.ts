import { Hono } from "hono";
import { Variables } from "../types";
import { loginSchema, registerSchema } from "../validators/auth.validator";
import { prisma } from "../lib/prisma";
import { HTTPException } from "hono/http-exception";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { zValidator } from "../lib/validator";

const auth = new Hono<{ Variables: Variables }>();

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

  const user = await prisma.user.create({
    data: { name, email, password: hashedPassword },
    select: {
      id: true,
      name: true,
      email: true,
      createdAt: true,
    },
  });

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

export default auth;
