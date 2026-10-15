import { supabase } from "@/integrations/supabase/client";
import { setLang } from "./index";
import type { Lang } from "./core";

/** The user picked a language: remember it on this device and on the account. */
export function chooseLang(lang: Lang) {
  setLang(lang);
  void supabase.auth
    .getSession()
    .then(({ data }) => (data.session ? supabase.auth.updateUser({ data: { lang } }) : null))
    .catch(() => {});
}
