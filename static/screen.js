
/* ===================================================
   SPORTUNI WELCOME 2026
   PROJECTOR SCREEN CONTROLLER

   - QR automatically after publishing
   - Text question -> Live Wall
   - Poll question -> Live Poll
   - Admin controls when to switch to Live
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

        // Reload screens only when the active
        // question changes.
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

      // A published question starts in QR mode.
      // Only the admin switches to Live.
      // Question type selects the correct live view.
      show(state.screen, nextQuestionType);

    } catch (error) {
      console.warn(
        "SPORTUNI projector update:",
        error
      );

      // Keep the last displayed screen.
    } finally {
      checking = false;
    }
  }

  // Default to QR until server status arrives.
  show("qr", "text");

  tick();

  setInterval(tick, 1200);
})();
