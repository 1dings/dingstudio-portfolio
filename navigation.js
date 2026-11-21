// Native details supports Enter/Space and normal Tab navigation without a custom menu role.
document.addEventListener("click", (event) => {
  document.querySelectorAll(".brand-menu[open]").forEach((menu) => {
    if (!menu.contains(event.target) || event.target.closest("a")) menu.open = false;
  });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape") return;
  document.querySelectorAll(".brand-menu[open]").forEach((menu) => {
    menu.open = false;
    menu.querySelector("summary").focus();
  });
});

// Keep open menus inside the viewport even when mobile nav pills wrap rows.
function fitNavigationMenu(menu) {
  const options = menu.querySelector(".brand-options");
  if (!options || !menu.open) return;
  options.style.transform = "";
  const box = options.getBoundingClientRect();
  const shift = Math.min(0, window.innerWidth - 12 - box.right);
  options.style.transform = `translateX(${Math.max(12 - box.left, shift)}px)`;
}
document.querySelectorAll(".brand-menu").forEach((menu) => {
  menu.addEventListener("toggle", () => fitNavigationMenu(menu));
});
window.addEventListener("resize", () => document.querySelectorAll(".brand-menu[open]").forEach(fitNavigationMenu));
