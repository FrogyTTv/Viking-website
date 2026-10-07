document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  if (!window.gsap || !window.SplitText || !window.ScrollTrigger) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  gsap.registerPlugin(SplitText, ScrollTrigger);

  var texts = gsap.utils
    .toArray("main h3.title, main .typografy p")
    .filter(function (el) {
      return el.textContent.trim();
    });

  if (!texts.length) return;

  //   gsap.set("header .title", { opacity: 1 });
  gsap.set(texts, { opacity: 1 });
  texts.forEach(function (text) {
    text.classList.add("split");
  });

  var lineTween = {
    yPercent: 120,
    stagger: 0.1,
    duration: 0.8,
    ease: "power2.out",
  };

  function initSplits() {
    texts.forEach(function (text) {
      SplitText.create(text, {
        type: "words,lines",
        mask: "lines",
        linesClass: "line",
        autoSplit: true,
        onSplit: function (self) {
          return gsap.from(self.lines, {
            yPercent: lineTween.yPercent,
            stagger: lineTween.stagger,
            duration: lineTween.duration,
            ease: lineTween.ease,
            scrollTrigger: {
              trigger: text,
              toggleActions: "play none none reverse",
              start: "top 80%",
            },
          });
        },
      });
    });

    ScrollTrigger.refresh();
  }
  gsap.set("header .title", { opacity: 0, y: 100 });

  function start() {
    document.fonts.ready.then(initSplits);
    gsap.to("header .title", {
      y: 0,
      duration: 1,
      opacity: 1,
    });
  }

  // Avoid splitting/measuring while the loader still locks the page.
  if (document.documentElement.classList.contains("is-loading")) {
    window.addEventListener("loader:done", start, { once: true });
  } else {
    start();
  }
});
