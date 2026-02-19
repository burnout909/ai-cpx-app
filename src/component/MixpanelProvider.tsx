"use client";

import { useEffect } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { initMixpanel, identify, reset } from "@/lib/mixpanel";

export default function MixpanelProvider({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    initMixpanel();

    const supabase = createSupabaseBrowserClient();

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        identify(session.user.id, { email: session.user.email });
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        identify(session.user.id, { email: session.user.email });
      } else {
        reset();
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return <>{children}</>;
}
