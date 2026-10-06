// Contador de stars ao vivo, com falha silenciosa (esconde o número).
(function () {
  var el = document.getElementById("starsCount");
  if (!el) return;
  fetch("https://api.github.com/repos/lucasfdigital/PageClip")
    .then(function (res) { return res.ok ? res.json() : null; })
    .then(function (data) {
      if (data && typeof data.stargazers_count === "number") {
        el.textContent = data.stargazers_count;
        el.hidden = false;
      }
    })
    .catch(function () { /* mantém escondido */ });
})();

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
