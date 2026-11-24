import { initDemoHub } from "./demo-hub-runtime.js";
import { createLibraryMockHandler } from "./demo-data-library.js";

initDemoHub({
  hub: "library",
  apiHandler: createLibraryMockHandler(),
});
