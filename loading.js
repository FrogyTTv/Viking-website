document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var slides = document.querySelectorAll(".preloader-list");
  var intro = document.querySelector(".preloader-intro");
  var percentEl = document.getElementById("percent");
  var lineHeight = intro ? intro.getBoundingClientRect().height : 0;
  var slideDuration = 0.55;

  var slideTimeline = gsap.timeline({
    paused: true,
    repeat: -1,
  });

  slides.forEach(function (slide, i) {
    var label = "slide" + i;
    slideTimeline.add(label);

    if (i > 0) {
      slideTimeline.to(
        slides,
        {
          duration: slideDuration,
          y: i * -1 * lineHeight,
          ease: "power2.inOut",
        },
        label,
      );
    }

    slideTimeline.to({}, { duration: 0.45 });
  });

  slideTimeline.play();

  var startedAt = performance.now();
  var MIN_VISIBLE_MS = 900;
  var HARD_TIMEOUT_MS = 45000;
  var shownPercent = 0;
  var exitScheduled = false;
  var weights = {
    viewer: 0.55,
    shield: 0.15,
    images: 0.25,
    fonts: 0.05,
  };
  var progress = {
    viewer: 0,
    shield: 0,
    images: 0,
    fonts: 0,
  };
  var loaded = {
    viewer: false,
    shield: false,
    images: false,
    fonts: false,
  };

  percentEl.textContent = "0";
  lockScroll();

  preloadShield();
  preloadImages();
  preloadFonts();

  customElements.whenDefined("model-viewer").then(function () {
    watchViewer(document.getElementById("model-viewer"));
  });

  setTimeout(function () {
    if (exitScheduled) return;
    Object.keys(loaded).forEach(function (key) {
      loaded[key] = true;
      progress[key] = 1;
    });
    renderProgress();
  }, HARD_TIMEOUT_MS);

  function watchViewer(element) {
    if (!element) {
      markLoaded("viewer");
      return;
    }

    element.addEventListener("progress", function (event) {
      var value = event.detail && event.detail.totalProgress;
      if (typeof value !== "number") return;
      progress.viewer = Math.max(progress.viewer, value);
      renderProgress();
    });

    element.addEventListener("load", function () {
      markLoaded("viewer");
    });
    element.addEventListener("error", function () {
      markLoaded("viewer");
    });

    if (element.loaded) markLoaded("viewer");
  }

  function preloadShield() {
    trackFetch("./src/Shield.glb", "shield", function (chunks) {
      window.preloadedShieldUrl = URL.createObjectURL(
        new Blob(chunks, { type: "model/gltf-binary" }),
      );
      markLoaded("shield");
    });
  }

  function preloadImages() {
    var images = Array.prototype.slice.call(
      document.querySelectorAll("img[data-preload], img.logo, .text-img img"),
    );

    if (!images.length) {
      markLoaded("images");
      return;
    }

    var settled = 0;
    var total = images.length;

    images.forEach(function (img) {
      var finish = function () {
        settled += 1;
        progress.images = settled / total;
        renderProgress();
        if (settled >= total) markLoaded("images");
      };

      if (img.complete && img.naturalWidth > 0) {
        if (img.decode) {
          img.decode().then(finish).catch(finish);
        } else {
          finish();
        }
        return;
      }

      img.addEventListener("load", function () {
        if (img.decode) {
          img.decode().then(finish).catch(finish);
        } else {
          finish();
        }
      });
      img.addEventListener("error", finish);
    });
  }

  function preloadFonts() {
    if (!document.fonts || !document.fonts.ready) {
      markLoaded("fonts");
      return;
    }

    document.fonts.ready
      .then(function () {
        markLoaded("fonts");
      })
      .catch(function () {
        markLoaded("fonts");
      });
  }

  function trackFetch(url, key, onDone) {
    fetch(url)
      .then(function (response) {
        if (!response.ok) throw new Error(key);
        var total = Number(response.headers.get("Content-Length")) || 0;

        if (!response.body || !response.body.getReader) {
          return response.arrayBuffer().then(function (buffer) {
            progress[key] = 1;
            renderProgress();
            onDone([buffer]);
          });
        }

        var reader = response.body.getReader();
        var received = 0;
        var chunks = [];

        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              progress[key] = 1;
              renderProgress();
              onDone(chunks);
              return;
            }

            chunks.push(result.value);
            received += result.value.byteLength;
            if (total) {
              progress[key] = Math.min(1, received / total);
              renderProgress();
            }
            return read();
          });
        }

        return read();
      })
      .catch(function () {
        markLoaded(key);
      });
  }

  function markLoaded(key) {
    progress[key] = 1;
    loaded[key] = true;
    renderProgress();
  }

  function renderProgress() {
    var done =
      loaded.viewer && loaded.shield && loaded.images && loaded.fonts;

    if (done) {
      setPercent(100);
      scheduleExit();
      return;
    }

    var value =
      progress.viewer * weights.viewer +
      progress.shield * weights.shield +
      progress.images * weights.images +
      progress.fonts * weights.fonts;

    setPercent(Math.min(99, value * 100));
  }

  function setPercent(value) {
    var next = Math.max(shownPercent, Math.round(value));
    if (next === shownPercent) return;
    shownPercent = next;
    percentEl.textContent = String(shownPercent);
  }

  function scheduleExit() {
    if (exitScheduled) return;
    exitScheduled = true;
    var remaining = Math.max(
      0,
      MIN_VISIBLE_MS - (performance.now() - startedAt),
    );
    setTimeout(playExit, remaining);
  }

  function playExit() {
    slideTimeline.pause();

    gsap.to(".percentage-intro, .percentage", {
      duration: 0.3,
      opacity: 0,
      y: -10,
      ease: "power2.inOut",
    });
    gsap.to(".preloader-intro", {
      duration: 0.7,
      opacity: 0,
      y: -400,
      delay: 0.2,
      ease: "power2.inOut",
    });
    gsap.to(".preloader-wrap", {
      duration: 0.7,
      yPercent: -101,
      delay: 0.7,
      ease: "power2.inOut",
    });
    gsap.set(".loading-animation", {
      visibility: "hidden",
      delay: 1.7,
      opacity: 0,
      pointerEvents: "none",
    });
    setTimeout(unlockScroll, 1700);
  }

  function preventScroll(event) {
    event.preventDefault();
  }

  function preventScrollKeys(event) {
    var key = event.key;
    if (
      key === "ArrowUp" ||
      key === "ArrowDown" ||
      key === "ArrowLeft" ||
      key === "ArrowRight" ||
      key === "PageUp" ||
      key === "PageDown" ||
      key === "Home" ||
      key === "End" ||
      key === " " ||
      key === "Spacebar"
    ) {
      event.preventDefault();
    }
  }

  function lockScroll() {
    document.documentElement.classList.add("is-loading");
    if ("scrollRestoration" in history) history.scrollRestoration = "manual";
    window.scrollTo(0, 0);
    document.addEventListener("wheel", preventScroll, { passive: false });
    document.addEventListener("touchmove", preventScroll, { passive: false });
    document.addEventListener("keydown", preventScrollKeys, { passive: false });
  }

  function unlockScroll() {
    if (!document.documentElement.classList.contains("is-loading")) return;
    document.documentElement.classList.remove("is-loading");
    document.removeEventListener("wheel", preventScroll);
    document.removeEventListener("touchmove", preventScroll);
    document.removeEventListener("keydown", preventScrollKeys);
    if ("scrollRestoration" in history) history.scrollRestoration = "auto";
  }
});
