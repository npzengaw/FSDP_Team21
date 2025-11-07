import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://zdagzlfzliommqtuxxuz.supabase.co";
const supabaseKey =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpkYWd6bGZ6bGlvbW1xdHV4eHV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjE3NDQ5MzUsImV4cCI6MjA3NzMyMDkzNX0.F0-iGydp2N3wU2buc6Qooh-FBYAPRFtcQD7igkHyzzI";
export const supabase = createClient(supabaseUrl, supabaseKey);
