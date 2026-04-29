import { redirect } from "next/navigation";

/** Old path; tutor UI is on the feed (Tutor button on each video). */
export default function TutorPage() {
  redirect("/");
}
