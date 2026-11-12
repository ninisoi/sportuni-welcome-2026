
/* ===================================================
   SPORTUNI WELCOME 2026
   PROJECTOR SCREEN CONTROLLER

   QR automatically after publishing.
   Text question -> Live Wall.
   Poll question -> Live Poll.

   Only admin controls QR / Live switching.
=================================================== */

(() => {
  "use strict";

  const qr = document.getElementById("qr");
  const wall = document.getElementById("wall");
  const poll = document.getElementById("poll");

  let previousQuestionId = null;
  let previousType = null;
  let initialized = false;
  let checking = false;

  function show(mode, type) {
    const live = mode === "wall";
    const isPoll = type === "poll";

    qr.hidden = live;
    wall.hidden = !live || isPoll;
    poll.hidden = !live || !isPoll;
  }

  async function tick() {
    if (checking) return;

    checking = true;

    try {
      const response = await fetch("/api/public", {
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Projector status error");
      }

      const state = await response.json();

      const nextQuestionId =
        state.question?.id || null;

      const nextQuestionType =
        state.question_type === "poll"
          ? "poll"
          : "text";

      const changed =
        !initialized ||
        previousQuestionId !== nextQuestionId ||
        previousType !== nextQuestionType;

      if (changed) {
        previousQuestionId = nextQuestionId;
        previousType = nextQuestionType;
        initialized = true;

        // Reload views only when a question changes.
        const query = nextQuestionId
          ? "?q=" + encodeURIComponent(nextQuestionId)
          : "";

        const qrUrl = "/qr-view" + query;
        const wallUrl = "/wall-view" + query;
        const pollUrl = "/poll-view" + query;

        if (qr.getAttribute("src") !== qrUrl) {
          qr.src = qrUrl;
        }

        if (wall.getAttribute("src") !== wallUrl) {
          wall.src = wallUrl;
        }

        if (poll.getAttribute("src") !== pollUrl) {
          poll.src = pollUrl;
        }
      }

      // Publishing starts in QR mode.
      // Admin switches manually to Live.
      show(state.screen, nextQuestionType);

    } catch (error) {
      console.warn(
        "SPORTUNI projector update:",
        error
      );

      // Preserve the last working view.
    } finally {
      checking = false;
    }
  }

  // Show QR while waiting for server state.
  show("qr", "text");

  tick();

  setInterval(tick, 1200);
})();
