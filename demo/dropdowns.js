// Accessible, animated glass listboxes for demo settings.
// Keep the underlying native select as the source of truth for form values.
(() => {
  "use strict";
  for (const id of ["demoHitokotoLanguage", "demoAcademicProgram"]) {
    const select = document.getElementById(id);
    if (!select) continue;
    const wrapper = document.createElement("div");
    wrapper.className = "demo-select-wrap";
    const trigger = document.createElement("button");
    trigger.type = "button";
    trigger.className = "demo-select-trigger";
    trigger.setAttribute("aria-haspopup", "listbox");
    trigger.setAttribute("aria-expanded", "false");
    const menu = document.createElement("div");
    menu.className = "demo-select-menu";
    menu.id = id + "-options";
    menu.setAttribute("role", "listbox");
    menu.dataset.state = "closed";
    menu.inert = true;
    trigger.setAttribute("aria-controls", menu.id);
    const value = document.createElement("span");
    const chevron = document.createElement("span");
    chevron.className = "demo-select-chevron";
    chevron.textContent = "⌄";
    trigger.append(value, chevron);
    const choices = [];
    for (const option of select.options) {
      const item = document.createElement("button");
      item.type = "button";
      item.className = "demo-select-option";
      item.setAttribute("role", "option");
      item.dataset.value = option.value;
      item.textContent = option.textContent;
      item.setAttribute("aria-selected", String(select.value === option.value));
      item.tabIndex = -1;
      menu.append(item); choices.push(item);
      item.addEventListener("click", () => {
        select.value = option.value;
        select.dispatchEvent(new Event("change", { bubbles: true }));
        render();
        toggle(false, true);
      });
    }
    function render() {
      const match = [...select.options].find(x => x.value === select.value);
      value.textContent = match?.textContent || select.value;
      choices.forEach(item => item.setAttribute("aria-selected", String(item.dataset.value === select.value)));
      trigger.disabled = select.disabled;
      if (trigger.disabled) toggle(false);
    }
    function toggle(open, focusTrigger = false) {
      const showing = Boolean(open && !select.disabled);
      menu.dataset.state = showing ? "open" : "closed";
      menu.inert = !showing;
      menu.setAttribute("aria-hidden", String(!showing));
      trigger.setAttribute("aria-expanded", String(showing));
      if (showing) {
        choices.find(item => item.dataset.value === select.value)?.focus({ preventScroll: true });
      } else if (focusTrigger) trigger.focus({ preventScroll: true });
    }
    function move(key) {
      const active = document.activeElement;
      let index = choices.indexOf(active);
      if (index === -1) index = choices.findIndex(item => item.dataset.value === select.value);
      if (key === "Home") index = 0;
      if (key === "End") index = choices.length - 1;
      if (key === "ArrowDown") index = (index + 1) % choices.length;
      if (key === "ArrowUp") index = (index - 1 + choices.length) % choices.length;
      toggle(true);
      choices[index]?.focus({ preventScroll: true });
    }
    trigger.addEventListener("click", () => toggle(trigger.getAttribute("aria-expanded") !== "true"));
    wrapper.addEventListener("keydown", event => {
      if (event.key === "Escape") {
        if (trigger.getAttribute("aria-expanded") === "true") {
          event.preventDefault(); event.stopPropagation(); toggle(false, true);
        }
      } else if (["ArrowDown","ArrowUp","Home","End"].includes(event.key)) {
        event.preventDefault(); move(event.key);
      } else if (event.key === "Tab") {
        toggle(false);
      }
    });
    document.addEventListener("pointerdown", event => {
      if (!wrapper.contains(event.target)) toggle(false);
    });
    select.addEventListener("change", render);
    const observer = new MutationObserver(render);
    observer.observe(select, {attributes:true,attributeFilter:["disabled"]});
    select.after(wrapper);
    wrapper.append(trigger, menu);
    select.hidden = true;
    select.classList.add("demo-select-native");
    render();
  }
})();