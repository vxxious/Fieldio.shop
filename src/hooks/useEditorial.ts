import { useQuery } from "@tanstack/react-query";
import { z } from "zod";
import { supabase } from "../lib/supabase";

const sectionSchema = z.object({
  heading: z.string().max(180).optional(),
  body: z.string().max(1200).optional(),
  image: z.string().refine((value) => value.startsWith("/images/") || /^https:\/\/[^/]+\.supabase\.co\//.test(value)).optional(),
  imageAlt: z.string().max(300).optional()
});
type EditorialSection = z.infer<typeof sectionSchema>;
export function useEditorial(page: string) {
  return useQuery({ queryKey: ["catalog", "editorial", page], queryFn: async () => {
    const sections: Record<string, EditorialSection> = {};
    if (!supabase) return sections;
    const { data, error } = await supabase.from("editorial_content").select("section_key,content").eq("page_key", page).eq("is_published", true);
    if (error) throw error;
    for (const row of data) {
      const result = sectionSchema.safeParse(row.content);
      if (result.success) sections[row.section_key] = result.data;
    }
    return sections;
  } });
}
