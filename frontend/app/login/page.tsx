import { redirect, RedirectType } from "next/navigation";

export default function OldLoginRedirect() {
  redirect("/auth/student/login");
}

export function GET() {
  redirect("/auth/student/login", RedirectType.replace);
}
