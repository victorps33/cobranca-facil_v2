import { serve } from "inngest/next";
import { inngest, allFunctions } from "@/inngest";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: allFunctions,
});
