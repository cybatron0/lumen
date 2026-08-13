"use server";

import { synthesizeInput, type Brief } from "@/lib/synthesize";

export async function runSynthesis(input: string): Promise<Brief | { error: string }> {
  if (!input || input.trim().length < 3) {
    return { error: "Please provide some input (notes, links, or thoughts)." };
  }
  try {
    const brief = await synthesizeInput(input.trim());
    return brief;
  } catch (err: any) {
    console.error("Synthesis error:", err);
    return { error: err?.message || "Synthesis failed. Please try again." };
  }
}
