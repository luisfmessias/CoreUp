import { CoreUpApp } from "@/components/CoreUpApp";
import exercises from "@/data/exercises.json";
import type { Exercise } from "@/types/fitness";

export default function Home() {
  return <CoreUpApp exercises={exercises as Exercise[]} />;
}
