import { z } from "zod";
import { brazilianStates, normalizeCref } from "@/lib/professional";

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

const accountTypeSchema = z.enum(["USER", "PROFESSIONAL"]);

export const professionalProfileSchema = z.object({
  crefNumber: z
    .string()
    .trim()
    .transform((value, context) => {
      const normalized = normalizeCref(value);

      if (!normalized) {
        context.addIssue({ code: "custom", message: "Informe o numero do CREF, por exemplo 012345-G." });
        return z.NEVER;
      }

      return normalized;
    }),
  crefState: z.enum(brazilianStates, { error: "Selecione a UF do registro CREF." }),
  specialty: z.string().trim().min(3, "Informe sua especialidade ou area de atuacao.").max(80),
  education: z.string().trim().min(3, "Informe sua formacao academica.").max(120)
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2),
    email: emailSchema,
    password: passwordSchema,
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    acceptPrivacy: z.literal(true, { error: "Aceite a Politica de Privacidade para criar a conta." }),
    accountType: accountTypeSchema.default("USER"),
    professional: professionalProfileSchema.optional()
  })
  .superRefine((value, context) => {
    if (value.accountType !== "PROFESSIONAL") {
      return;
    }

    if (!value.professional) {
      context.addIssue({ code: "custom", path: ["professional"], message: "Preencha os dados do registro profissional." });
    }

    if (value.name.split(/\s+/).length < 2) {
      context.addIssue({ code: "custom", path: ["name"], message: "Informe seu nome completo." });
    }
  });

export const deleteAccountSchema = z.object({
  password: z.string().min(1, "Informe sua senha.")
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Informe sua senha.")
});

const reviewItemsSchema = z.array(z.string().trim().min(2).max(300)).max(10);

export const workoutReviewSchema = z.object({
  rating: z.number().int().min(1, "Escolha uma nota de 1 a 5.").max(5, "Escolha uma nota de 1 a 5."),
  comment: z.string().trim().min(10, "Escreva um comentario com pelo menos 10 caracteres.").max(1000),
  strengths: reviewItemsSchema.default([]),
  limitations: reviewItemsSchema.default([]),
  recommendations: reviewItemsSchema.default([])
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

export const preferencesSchema = z.object({
  goal: z.enum(["hipertrofia", "forca", "emagrecimento", "saude"]),
  level: z.enum(["iniciante", "intermediario", "avancado"]),
  planPreset: z.enum(["ppl", "superiores-inferiores", "peito", "costas", "pernas", "livre"]),
  daysPerWeek: z.number().int().min(2).max(5),
  minutesPerSession: z.number().int().min(35).max(70),
  availableEquipment: z.array(z.string().max(40)).max(20),
  favoriteExerciseIds: z.array(z.number().int().positive()).max(200)
});

export const planSchema = z.object({
  preferences: preferencesSchema,
  days: z
    .array(
      workoutSchema.extend({
        intensity: z.enum(["Leve", "Moderado", "Forte"]),
        durationMin: z.number().int().positive().optional(),
        exercises: z.array(workoutExerciseSchema).max(20)
      })
    )
    .max(7)
});
