import React from "react";
import { createRoot } from "react-dom/client";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import "./styles.css";

// Progressive enhancement: if the bundle is missing, the native fallback
// button remains in the DOM and the existing click handler still works.
function ManageLinksButton() {
  return (
    <Button
      id="manageCustomLinks"
      variant="glass"
      size="default"
      className="text-xs"
    >
      <Plus className="h-4 w-4" aria-hidden="true" />
      <span>新增 / 管理捷徑</span>
    </Button>
  );
}

const root = document.getElementById("customLinksButtonReactRoot");
if (root) {
  createRoot(root).render(<ManageLinksButton />);
}
