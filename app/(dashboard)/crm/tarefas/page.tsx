import { redirect } from "next/navigation";

export default function TarefasRedirectPage() {
  redirect("/crm?tab=tarefas");
}
