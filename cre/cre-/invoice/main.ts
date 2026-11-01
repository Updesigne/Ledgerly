import { Runner } from "@chainlink/cre-sdk";
import { initWorkflow, type Config } from "./workflow";

/**
 * CRE WASM entry point.
 * NOTE: Javy requires that the entry point file exports ONLY functions without parameters.
 * Therefore, only `main()` is exported here. All handlers and logic reside in workflow.ts.
 */
export async function main() {
  const runner = await Runner.newRunner<Config>();
  await runner.run(initWorkflow);
}
