import { redirect, RedirectType } from "next/navigation";

export default function TrusteesLegacyRedirect() {
  redirect("/admin/trustees", RedirectType.replace);
}
