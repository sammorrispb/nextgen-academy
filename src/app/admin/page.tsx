import { redirect } from "next/navigation";

// Bare /admin has no surface of its own — the NGA admin lives at /admin/sessions
// (the Sessions Editor, behind the (authed) layout's cookie gate). Typing /admin
// is a natural reflex, so send it there instead of 404ing. Unauthed users still
// land on /admin/login via the (authed) layout redirect.
export default function AdminIndexPage() {
  redirect("/admin/sessions");
}
