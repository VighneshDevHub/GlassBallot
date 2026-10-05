import { redirect, RedirectType } from "next/navigation";

export default function SimulatorLegacyRedirect() {
  redirect("/admin/simulator", RedirectType.replace);
}
