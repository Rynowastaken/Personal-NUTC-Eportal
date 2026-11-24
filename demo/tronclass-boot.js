import fontUrl from "../public/fonts/albert-sans.woff2?url";
import { initDemoHub } from "./demo-hub-runtime.js";
import { createTronclassMockHandler } from "./demo-data-tronclass.js";

initDemoHub({
  hub: "tronclass",
  fontUrl,
  apiHandler: createTronclassMockHandler(),
});
