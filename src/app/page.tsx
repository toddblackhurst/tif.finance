import { redirect } from "next/navigation";

// Redirect bare / to the default locale
export default function RootPage() {
  redirect("/en");
}
