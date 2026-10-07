document.addEventListener("DOMContentLoaded", function () {
  "use strict";

  if (typeof gsap === "undefined") return;
  if (window.matchMedia("(pointer: coarse)").matches) return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  var strength = 0.15;
  var labelStrength = 0.24;

  document.querySelectorAll("a").forEach(function (anchor) {
    if (anchor.closest(".loading-animation")) return;
    if (anchor.closest(".mag-zone")) return;

    var zone = document.createElement("span");
    zone.className = "mag-zone";
    anchor.parentNode.insertBefore(zone, anchor);
    zone.appendChild(anchor);
    anchor.classList.add("mag-link");

    var label = document.createElement("span");
    label.className = "mag-label";
    while (anchor.firstChild) {
      label.appendChild(anchor.firstChild);
    }
    anchor.appendChild(label);

    zone.addEventListener("mousemove", function (event) {
      var rect = zone.getBoundingClientRect();
      var mapX = gsap.utils.mapRange(
        rect.left,
        rect.right,
        -rect.width / 2,
        rect.width / 2,
        event.clientX,
      );
      var mapY = gsap.utils.mapRange(
        rect.top,
        rect.bottom,
        -rect.height / 2,
        rect.height / 2,
        event.clientY,
      );

      gsap.to(anchor, {
        x: mapX * strength,
        y: mapY * strength,
        duration: 0.4,
        ease: "power2.out",
        overwrite: true,
      });

      gsap.to(label, {
        x: mapX * labelStrength,
        y: mapY * labelStrength,
        duration: 0.4,
        ease: "power2.out",
        overwrite: true,
      });
    });

    zone.addEventListener("mouseleave", function () {
      gsap.to(anchor, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.4)",
        overwrite: true,
      });

      gsap.to(label, {
        x: 0,
        y: 0,
        duration: 0.7,
        ease: "elastic.out(1, 0.4)",
        overwrite: true,
      });
    });
  });
});
