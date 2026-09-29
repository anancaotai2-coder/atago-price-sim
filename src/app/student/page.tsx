import { getData } from "@/lib/store";
import StudentSimulator from "@/components/StudentSimulator";

export const dynamic = "force-dynamic";

const ANONYMOUS_LABELS = ["A", "B", "C", "D", "E"];

export default async function StudentPage() {
  const data = await getData();

  let counter = 0;
  const schools = data.schools.map((school) =>
    school.hideName
      ? { ...school, name: `近隣${ANONYMOUS_LABELS[counter++] ?? counter}校` }
      : school
  );

  return <StudentSimulator data={{ ...data, schools }} />;
}
