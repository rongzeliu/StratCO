import { redirect } from "next/navigation";

// proxy.ts normally handles "/" before this renders; this is a fallback.
export default function Home() {
  redirect("/challenges");
}
