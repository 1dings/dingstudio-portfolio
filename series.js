// A series shares one player: switching src also stops the previous film.
document.addEventListener("click", (event) => {
  const button = event.target.closest(".series-choice");
  if (!button) return;
  const picker = button.closest(".series-picker");
  const player = picker?.parentElement.querySelector(".player iframe");
  if (!player || button.getAttribute("aria-pressed") === "true") return;
  const id = button.dataset.youtube;
  if (!/^[A-Za-z0-9_-]{11}$/.test(id || "")) return;
  player.src = `https://www.youtube-nocookie.com/embed/${id}?rel=0&modestbranding=1&color=white`;
  player.title = button.dataset.title;
  picker.querySelectorAll(".series-choice").forEach((item) => {
    item.setAttribute("aria-pressed", String(item === button));
  });
});
