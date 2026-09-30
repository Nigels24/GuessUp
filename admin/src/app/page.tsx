import { redirect } from "next/navigation";

/** The panel starts at the dashboard; the (panel) layout sends signed-out users to /login. */
export default function Home() {
  redirect("/dashboard");
}
