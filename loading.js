document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  var intro = document.querySelector(".preloader-intro");
  var slides = Array.prototype.slice.call(
    document.querySelectorAll(".preloader-list"),
  );
  var percentEl = document.getElementById("percent");
  var viewer = document.getElementById("model-viewer");
  var lineHeight = intro ? intro.getBoundingClientRect().height : 0;
  var slideDuration = 0.55;

  // Clone the first word at the end so the loop can slide into it,
  // then snap back to y:0 with no visible jump (both show the same text).
  if (intro && slides.length > 1) {
    var firstClone = slides[0].cloneNode(true);
    firstClone.setAttribute("aria-hidden", "true");
    intro.appendChild(firstClone);
    slides = Array.prototype.slice.call(
      document.querySelectorAll(".preloader-list"),
    );
  }

  var slideTimeline = gsap.timeline({
    paused: true,
    repeat: -1,
  });

  slides.forEach(function (slide, i) {
    if (i === 0) {
      slideTimeline.to({}, { duration: 0.45 });
      return;
    }

    slideTimeline.to(slides, {
      duration: slideDuration,
      y: i * -1 * lineHeight,
      ease: "power2.inOut",
    });
    slideTimeline.to({}, { duration: 0.45 });
  });

  if (slides.length > 1) {
    slideTimeline.set(slides, { y: 0 });
  }

  slideTimeline.play();

  var startedAt = performance.now();
  var MIN_VISIBLE_MS = 900;
  var HARD_TIMEOUT_MS = 60000;
  var shownPercent = 0;
  var exitScheduled = false;

  var assetDefs = [
    {
      key: "axe",
      url: "./src/Battle Axe.glb",
      weight: 0.12,
      type: "model/gltf-binary",
    },
    {
      key: "shield",
      url: "./src/Shield.glb",
      weight: 0.12,
      type: "model/gltf-binary",
    },
    {
      key: "hdr",
      url: "./src/lago_disola_4k.hdr",
      weight: 0.22,
      type: "image/vnd.radiance",
    },
    {
      key: "logo",
      url: "./src/logo.svg",
      weight: 0.12,
      type: "image/svg+xml",
    },
    {
      key: "axeImg",
      url: "./src/Axe_img.png",
      weight: 0.18,
      type: "image/png",
    },
    {
      key: "dragonImg",
      url: "./src/Dragon_img.png",
      weight: 0.24,
      type: "image/png",
    },
  ];

  var progress = {};
  var blobs = {};
  var loaded = {
    assets: false,
    viewer: false,
    paint: false,
    window: false,
  };

  assetDefs.forEach(function (asset) {
    progress[asset.key] = 0;
  });

  percentEl.textContent = "0";
  lockScroll();
  warmViewer();

  Promise.all([
    loadAllAssets(),
    waitForWindowLoad(),
    customElements.whenDefined("model-viewer"),
  ])
    .then(function () {
      return applyAssets();
    })
    .then(function () {
      return waitForViewerReady(viewer);
    })
    .then(function () {
      return waitForPaint();
    })
    .then(function () {
      loaded.assets = true;
      loaded.viewer = true;
      loaded.paint = true;
      loaded.window = true;
      setPercent(100);
      scheduleExit();
    })
    .catch(function () {
      loaded.assets = true;
      loaded.viewer = true;
      loaded.paint = true;
      loaded.window = true;
      setPercent(100);
      scheduleExit();
    });

  setTimeout(function () {
    if (exitScheduled) return;
    loaded.assets = true;
    loaded.viewer = true;
    loaded.paint = true;
    loaded.window = true;
    setPercent(100);
    scheduleExit();
  }, HARD_TIMEOUT_MS);

  function loadAllAssets() {
    return Promise.all(
      assetDefs.map(function (asset) {
        return fetchAsset(asset).then(function (buffer) {
          blobs[asset.key] = URL.createObjectURL(
            new Blob([buffer], { type: asset.type }),
          );
          progress[asset.key] = 1;
          renderProgress();
        });
      }),
    ).then(function () {
      loaded.assets = true;
    });
  }

  function fetchAsset(asset) {
    return fetch(asset.url).then(function (response) {
      if (!response.ok) throw new Error(asset.key);
      var total = Number(response.headers.get("Content-Length")) || 0;

      if (!response.body || !response.body.getReader) {
        return response.arrayBuffer().then(function (buffer) {
          progress[asset.key] = 1;
          renderProgress();
          return buffer;
        });
      }

      var reader = response.body.getReader();
      var received = 0;
      var chunks = [];

      function read() {
        return reader.read().then(function (result) {
          if (result.done) {
            var full = new Uint8Array(received);
            var offset = 0;
            chunks.forEach(function (chunk) {
              full.set(chunk, offset);
              offset += chunk.byteLength;
            });
            progress[asset.key] = 1;
            renderProgress();
            return full.buffer;
          }

          chunks.push(result.value);
          received += result.value.byteLength;
          if (total) {
            progress[asset.key] = Math.min(0.99, received / total);
            renderProgress();
          }
          return read();
        });
      }

      return read();
    });
  }

  function applyAssets() {
    var imageMap = [
      { selector: "img.logo", key: "logo" },
      { selector: ".text-img:not(.reversed) img", key: "axeImg" },
      { selector: ".text-img.reversed img", key: "dragonImg" },
    ];

    var decodes = imageMap.map(function (item) {
      var img = document.querySelector(item.selector);
      if (!img || !blobs[item.key]) return Promise.resolve();
      img.removeAttribute("data-src");
      img.src = blobs[item.key];
      if (img.decode) return img.decode().catch(function () {});
      if (img.complete) return Promise.resolve();
      return new Promise(function (resolve) {
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
      });
    });

    // model-viewer is unreliable with blob: HDR URLs, so point it at the
    // real paths after fetch has already warmed the HTTP cache.
    if (viewer) {
      viewer.setAttribute("skybox-image", "./src/lago_disola_4k.hdr");
      viewer.setAttribute("environment-image", "./src/lago_disola_4k.hdr");
      viewer.setAttribute("src", "./src/Battle Axe.glb");
    }

    window.preloadedAxeUrl = "./src/Battle Axe.glb";
    window.preloadedShieldUrl = blobs.shield || "./src/Shield.glb";

    return Promise.all(decodes);
  }

  function waitForViewerReady(element) {
    if (!element) {
      loaded.viewer = true;
      return Promise.resolve();
    }

    return new Promise(function (resolve) {
      var settled = false;

      function done() {
        if (settled) return;
        settled = true;
        loaded.viewer = true;
        renderProgress();
        resolve();
      }

      element.addEventListener("progress", function (event) {
        var value = event.detail && event.detail.totalProgress;
        if (typeof value !== "number") return;
        progress.axe = Math.max(progress.axe, 0.85 + value * 0.15);
        renderProgress();
      });

      function afterLoad() {
        var visible = element.modelIsVisible
          ? Promise.resolve()
          : new Promise(function (res) {
              var finished = false;
              var finish = function () {
                if (finished) return;
                finished = true;
                element.removeEventListener("model-visibility", onVisible);
                res();
              };
              var onVisible = function (event) {
                if (!event.detail || event.detail.visible) finish();
              };
              element.addEventListener("model-visibility", onVisible);
              setTimeout(finish, 4000);
            });

        var updated = element.updateComplete
          ? element.updateComplete.catch(function () {})
          : Promise.resolve();

        // Confirm the viewer actually marked itself loaded.
        var confirmed = new Promise(function (res) {
          if (element.loaded) {
            res();
            return;
          }
          var checks = 0;
          var timer = setInterval(function () {
            checks += 1;
            if (element.loaded || checks > 40) {
              clearInterval(timer);
              res();
            }
          }, 100);
        });

        Promise.all([visible, updated, confirmed])
          .then(function () {
            return waitForPaint();
          })
          .then(done);
      }

      if (element.loaded) {
        afterLoad();
        return;
      }

      element.addEventListener("load", afterLoad, { once: true });
      element.addEventListener("error", done, { once: true });
      setTimeout(done, 25000);
    });
  }

  function waitForWindowLoad() {
    return new Promise(function (resolve) {
      if (document.readyState === "complete") {
        loaded.window = true;
        resolve();
        return;
      }
      window.addEventListener(
        "load",
        function () {
          loaded.window = true;
          resolve();
        },
        { once: true },
      );
    });
  }

  function waitForPaint() {
    return new Promise(function (resolve) {
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          loaded.paint = true;
          resolve();
        });
      });
    });
  }

  function warmViewer() {
    if (!viewer) return;
    viewer.classList.add("is-warming");
  }

  function coolViewer() {
    if (!viewer) return;
    viewer.classList.remove("is-warming");
  }

  function renderProgress() {
    if (exitScheduled) return;

    var value = 0;
    assetDefs.forEach(function (asset) {
      value += (progress[asset.key] || 0) * asset.weight;
    });

    if (loaded.viewer) value = Math.max(value, 0.97);
    if (loaded.paint && loaded.window && loaded.viewer && loaded.assets) {
      setPercent(100);
      return;
    }

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
    coolViewer();

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
    window.dispatchEvent(new CustomEvent("loader:done"));
  }
});
