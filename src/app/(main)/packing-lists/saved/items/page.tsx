import { redirect } from "next/navigation";

export default function SavedItemsRedirectPage() {
  redirect("/items");
}
