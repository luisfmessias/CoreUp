import { CoreUpApp } from "@/components/CoreUpApp";
import { exerciseList } from "@/lib/exercises";

export default function Home() {
  return <CoreUpApp exercises={exerciseList} />;
}
