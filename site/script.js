// Detalhes pequenos: ano dinâmico não é necessário, só revelação suave das seções.
(function () {
  var targets = document.querySelectorAll(".section, .hero-shot");
  if (!("IntersectionObserver" in window)) {
    targets.forEach(function (el) { el.classList.add("in"); });
    return;
  }
  targets.forEach(function (el) { el.classList.add("reveal"); });
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (entry.isIntersecting) {
        entry.target.classList.add("in");
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12 });
  targets.forEach(function (el) { observer.observe(el); });
})();
