import type { NavigateFunction } from "react-router-dom";
import supabase from "./supabase";

export async function signOutAndRedirect(navigate: NavigateFunction) {
  await supabase.auth.signOut();
  navigate("/", { replace: true });
}
