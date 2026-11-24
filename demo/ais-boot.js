import { initDemoHub } from "./demo-hub-runtime.js";
import { createAisMockHandler } from "./demo-data-ais.js";

initDemoHub({
  hub: "ais",
  apiHandler: createAisMockHandler(),
});
