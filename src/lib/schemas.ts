import { z } from "zod";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

const emailSchema = z
  .string()
  .trim()
  .regex(emailRegex, "Informe um e-mail valido.")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .regex(passwordRegex, "A senha precisa ter 8 caracteres, letra maiuscula, letra minuscula, numero e simbolo.");

export const registerSchema = z.object({
  name: z.string().min(2),
  email: emailSchema,
  password: passwordSchema,
  heightCm: z.number().positive().optional(),
  weightKg: z.number().positive().optional()
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.")
});

export const workoutExerciseSchema = z.object({
  exerciseId: z.number().int().positive(),
  order: z.number().int().nonnegative().optional(),
  sets: z.number().int().positive().optional(),
  reps: z.string().max(40).optional(),
  restSeconds: z.number().int().positive().optional(),
  loadKg: z.number().nonnegative().optional(),
  notes: z.string().max(500).optional()
});

export const workoutSchema = z.object({
  title: z.string().min(2),
  weekday: z
    .enum(["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"])
    .optional(),
  notes: z.string().max(1000).optional(),
  exercises: z.array(workoutExerciseSchema).default([])
});

export const workoutUpdateSchema = workoutSchema.partial().extend({
  exercises: z.array(workoutExerciseSchema).optional()
});

export const logSetSchema = z.object({
  exerciseId: z.number().int().positive(),
  setNumber: z.number().int().positive(),
  reps: z.number().int().nonnegative().optional(),
  loadKg: z.number().nonnegative().optional(),
  done: z.boolean().optional()
});

export const workoutLogSchema = z.object({
  workoutId: z.string().optional(),
  performedAt: z.string().datetime().optional(),
  durationMin: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
  sets: z.array(logSetSchema).default([])
});

export const bodyMetricSchema = z.object({
  weightKg: z.number().positive().optional(),
  heightCm: z.number().positive().optional(),
  bodyFat: z.number().min(0).max(100).optional(),
  measuredAt: z.string().datetime().optional(),
  notes: z.string().max(1000).optional()
});
