import { redirect } from "next/navigation";

export default function CompletedJobsRedirect() {
  redirect("/admin/customers");
}
