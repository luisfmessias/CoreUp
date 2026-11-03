import { z } from "zod";
import { brazilianStates, normalizeCref } from "@/lib/professional";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;

const emailSchema = z
  .string()
  .trim()
  .regex(emailRegex, "Informe um e-mail válido.")
  .transform((email) => email.toLowerCase());

const passwordSchema = z
  .string()
  .regex(passwordRegex, "A senha precisa ter 8 caracteres, letra maiúscula, letra minúscula, número e símbolo.");

// O cadastro nunca cria ADMIN: essa conta só nasce pelo script admin:create.
const accountTypeSchema = z.enum(["USER", "PROFESSIONAL"]);

export const professionalProfileSchema = z.object({
  crefNumber: z
    .string()
    .trim()
    .transform((value, context) => {
      const normalized = normalizeCref(value);

      if (!normalized) {
        context.addIssue({ code: "custom", message: "Informe o CREF com número e categoria, por exemplo 012345-G." });
        return z.NEVER;
      }

      return normalized;
    }),
  crefState: z.enum(brazilianStates, { error: "Selecione a UF do registro CREF." }),
  specialty: z.string().trim().min(3, "Informe sua especialidade ou área de atuação.").max(80),
  education: z.string().trim().min(3, "Informe sua formação acadêmica.").max(120)
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2),
    email: emailSchema,
    password: passwordSchema,
    heightCm: z.number().positive().optional(),
    weightKg: z.number().positive().optional(),
    acceptPrivacy: z.literal(true, { error: "Aceite a Política de Privacidade para criar a conta." }),
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

const fullNameSchema = z
  .string()
  .trim()
  .min(2)
  .max(120)
  .refine((value) => value.split(/\s+/).length >= 2, "Informe seu nome completo.");

export const professionalRequestSchema = professionalProfileSchema.extend({ fullName: fullNameSchema });

export const approveRequestSchema = z.object({
  crefChecked: z.literal(true, { error: "Confirme que o CREF foi analisado e considerado válido." })
});

export const rejectRequestSchema = z.object({
  reason: z.string().trim().max(500).optional()
});

export const markNotificationsSchema = z.object({
  ids: z.array(z.string().min(1)).max(100).optional()
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
  comment: z.string().trim().min(10, "Escreva um comentário com pelo menos 10 caracteres.").max(1000),
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
  title: z.string().trim().max(120).optional(),
  performedAt: z.string().datetime().optional(),
  durationMin: z.number().int().positive().optional(),
  notes: z.string().max(1000).optional(),
  sets: z.array(logSetSchema).max(300).default([])
});

export const profileUpdateSchema = z
  .object({
    name: z.string().trim().min(2, "Informe seu nome.").max(120).optional(),
    heightCm: z.number().min(100, "Informe a altura em centímetros.").max(250).nullable().optional()
  })
  .refine((value) => value.name !== undefined || value.heightCm !== undefined, "Nada para atualizar.");

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
  planPreset: z.enum([
    "ppl",
    "superiores-inferiores",
    "peito",
    "costas",
    "pernas",
    "full-body",
    "abc",
    "abcd",
    "abcde",
    "gluteos",
    "bracos",
    "funcional",
    "livre"
  ]),
  daysPerWeek: z.number().int().min(1).max(7),
  minutesPerSession: z.number().int().min(15).max(180),
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
