import { redirect, RedirectType } from "next/navigation";

export default function OldRegisterRedirect() {
  redirect("/auth/student/register");
}

export function GET() {
  redirect("/auth/student/register", RedirectType.replace);
}
