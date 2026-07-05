import { Dumbbell, Flame, HeartPulse, Moon, Timer, TrendingUp } from "lucide-react";
import type { WorkoutDay } from "@/types/fitness";

export const weeklyPlan: WorkoutDay[] = [
  {
    id: "segunda",
    label: "Seg",
    focus: "Peito e triceps",
    duration: "58 min",
    intensity: "Forte",
    exercises: [
      { exerciseId: 1, sets: 4, reps: "8-10", rest: "90s" },
      { exerciseId: 4, sets: 3, reps: "10-12", rest: "75s" },
      { exerciseId: 12, sets: 3, reps: "12-15", rest: "60s" },
      { exerciseId: 76, sets: 4, reps: "10-12", rest: "60s" }
    ]
  },
  {
    id: "terca",
    label: "Ter",
    focus: "Costas e biceps",
    duration: "54 min",
    intensity: "Moderado",
    exercises: [
      { exerciseId: 21, sets: 4, reps: "6-8", rest: "100s" },
      { exerciseId: 27, sets: 4, reps: "10-12", rest: "75s" },
      { exerciseId: 32, sets: 3, reps: "12-14", rest: "60s" },
      { exerciseId: 61, sets: 3, reps: "10-12", rest: "60s" }
    ]
  },
  {
    id: "quarta",
    label: "Qua",
    focus: "Pernas",
    duration: "62 min",
    intensity: "Forte",
    exercises: [
      { exerciseId: 101, sets: 4, reps: "6-8", rest: "120s" },
      { exerciseId: 104, sets: 4, reps: "10-12", rest: "90s" },
      { exerciseId: 121, sets: 3, reps: "12-15", rest: "75s" },
      { exerciseId: 145, sets: 4, reps: "12-15", rest: "60s" }
    ]
  },
  {
    id: "quinta",
    label: "Qui",
    focus: "Ombros e abdomen",
    duration: "45 min",
    intensity: "Moderado",
    exercises: [
      { exerciseId: 42, sets: 4, reps: "8-10", rest: "90s" },
      { exerciseId: 44, sets: 4, reps: "12-15", rest: "60s" },
      { exerciseId: 48, sets: 3, reps: "12-15", rest: "60s" },
      { exerciseId: 160, sets: 3, reps: "45s", rest: "45s" }
    ]
  },
  {
    id: "sexta",
    label: "Sex",
    focus: "Full body",
    duration: "52 min",
    intensity: "Forte",
    exercises: [
      { exerciseId: 191, sets: 4, reps: "8", rest: "90s" },
      { exerciseId: 127, sets: 4, reps: "15", rest: "60s" },
      { exerciseId: 198, sets: 3, reps: "8-10", rest: "75s" },
      { exerciseId: 184, sets: 4, reps: "30s", rest: "45s" }
    ]
  }
];

export const bodyStats = [
  { label: "Treinos", value: "18", helper: "neste mes", icon: Dumbbell },
  { label: "Carga", value: "+12%", helper: "media", icon: TrendingUp },
  { label: "Cardio", value: "142", helper: "min", icon: HeartPulse },
  { label: "Sono", value: "7h20", helper: "media", icon: Moon }
];

export const habits = [
  { label: "Aquecimento", value: 86, icon: Flame },
  { label: "Descanso entre series", value: 72, icon: Timer },
  { label: "Consistencia", value: 91, icon: TrendingUp }
];
