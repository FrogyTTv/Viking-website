$(function () {
  "use strict";

  var animationOptions = {
    slides: document.querySelectorAll(".preloader-list"),
    list: document.querySelector(".preloader-intro"),
    duration: 0.55,
    lineHeight: $(".preloader-intro").height(),
  };

  var slideTimeline = gsap.timeline({
    paused: true,
    repeat: -1,
  });

  animationOptions.slides.forEach(function (slide, i) {
    var label = "slide" + i;
    slideTimeline.add(label);

    if (i > 0) {
      slideTimeline.to(
        animationOptions.slides,
        {
          duration: animationOptions.duration,
          y: i * -1 * animationOptions.lineHeight,
          ease: "power2.inOut",
        },
        label,
      );
    }

    slideTimeline.to({}, { duration: 0.45 });
  });

  slideTimeline.play();

  var startedAt = performance.now();
  var MIN_VISIBLE_MS = 1000;
  var shownPercent = 0;
  var exitScheduled = false;
  var progress = { axe: 0, shield: 0 };
  var loaded = { axe: false, shield: false };
  var percentEl = $("#percent");

  percentEl.text(0);
  lockScroll();
  preloadShield();

  customElements.whenDefined("model-viewer").then(function () {
    watchModel(document.getElementById("model-viewer"), "axe");
  });

  setTimeout(function () {
    if (exitScheduled) return;
    loaded.axe = true;
    loaded.shield = true;
    progress.axe = 1;
    progress.shield = 1;
    renderProgress();
  }, 90000);

  function watchModel(element, key) {
    if (!element) {
      progress[key] = 1;
      loaded[key] = true;
      renderProgress();
      return;
    }

    element.addEventListener("progress", function (event) {
      var value = event.detail && event.detail.totalProgress;
      if (typeof value !== "number") return;
      progress[key] = Math.max(progress[key], value);
      renderProgress();
    });

    element.addEventListener("load", function () {
      markLoaded(key);
    });
    element.addEventListener("error", function () {
      markLoaded(key);
    });

    if (element.loaded) markLoaded(key);
  }

  function preloadShield() {
    fetch("./src/Shield.glb")
      .then(function (response) {
        if (!response.ok) throw new Error("shield");
        var total = Number(response.headers.get("Content-Length")) || 0;
        if (!response.body || !response.body.getReader) {
          return response.arrayBuffer().then(function (buffer) {
            storeShield(buffer);
          });
        }
        var reader = response.body.getReader();
        var received = 0;
        var chunks = [];
        function read() {
          return reader.read().then(function (result) {
            if (result.done) {
              storeShield(chunks);
              return;
            }
            chunks.push(result.value);
            received += result.value.byteLength;
            if (total) {
              progress.shield = Math.min(1, received / total);
              renderProgress();
            }
            return read();
          });
        }
        return read();
      })
      .catch(function () {
        markLoaded("shield");
      });
  }

  function storeShield(data) {
    window.preloadedShieldUrl = URL.createObjectURL(
      new Blob(data instanceof ArrayBuffer ? [data] : data, {
        type: "model/gltf-binary",
      }),
    );
    markLoaded("shield");
  }

  function markLoaded(key) {
    progress[key] = 1;
    loaded[key] = true;
    renderProgress();
  }

  function renderProgress() {
    if (loaded.axe && loaded.shield) {
      setPercent(100);
      scheduleExit();
      return;
    }

    var value = progress.axe * 85 + progress.shield * 15;
    setPercent(Math.min(99, value));
  }

  function setPercent(value) {
    var next = Math.max(shownPercent, Math.round(value));
    if (next === shownPercent) return;
    shownPercent = next;
    percentEl.text(shownPercent);
  }

  function scheduleExit() {
    if (exitScheduled) return;
    exitScheduled = true;
    var remaining = Math.max(0, MIN_VISIBLE_MS - (performance.now() - startedAt));
    setTimeout(playExit, remaining);
  }

  function playExit() {
    slideTimeline.pause();

    gsap.to($(".percentage-intro, .percentage"), {
      duration: 0.3,
      opacity: 0,
      y: -10,
      ease: "power2.inOut",
    });
    gsap.to($(".preloader-intro"), {
      duration: 0.7,
      opacity: 0,
      y: -400,
      delay: 0.2,
      ease: "power2.inOut",
    });
    gsap.to($(".preloader-wrap"), {
      duration: 0.7,
      yPercent: -101,
      delay: 0.7,
      ease: "power2.inOut",
    });
    gsap.set($(".loading-animation"), {
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
