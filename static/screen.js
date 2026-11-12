
/* =========================================================
   SPORTUNI WELCOME 2026
   PROJECTOR CONTROLLER — STABLE SCREEN SWITCHING

   - No automatic QR flash on page refresh
   - Never displays the wrong question type
   - Waits for the requested iframe to load
   - Only admin controls QR / Live
   - Existing Live Wall remains unchanged
========================================================= */

(() => {
  "use strict";

  const frames = {
    qr: document.getElementById("qr"),
    wall: document.getElementById("wall"),
    poll: document.getElementById("poll")
  };

  let activeQuestionId = null;
  let activeType = null;
  let desiredScreen = null;
  let loadedScreens = new Map();
  let busy = false;
  let started = false;

  // Hide all views until the backend tells us
  // which screen should be displayed.
  Object.values(frames).forEach(frame => {
    frame.hidden = true;
  });

  function targetName(screenMode, questionType) {
    if (screenMode !== "wall") return "qr";

    return questionType === "poll"
      ? "poll"
      : "wall";
  }

  function screenUrl(name, qid) {
    const paths = {
      qr: "/qr-view",
      wall: "/wall-view",
      poll: "/poll-view"
    };

    return paths[name] +
      (qid ? "?q=" + encodeURIComponent(qid) : "");
  }

  function showOnly(name) {
    Object.entries(frames).forEach(([key, frame]) => {
      frame.hidden = key !== name;
    });
  }

  function hideAll() {
    Object.values(frames).forEach(frame => {
      frame.hidden = true;
    });
  }

  function isCurrentTarget(name) {
    return desiredScreen === name;
  }

  Object.entries(frames).forEach(([name, frame]) => {
    frame.addEventListener("load", () => {
      const currentUrl = frame.getAttribute("src");

      loadedScreens.set(name, currentUrl);

      // An old request must never make a stale screen
      // visible after the question has changed.
      if (!isCurrentTarget(name)) return;

      const expected = screenUrl(
        name,
        activeQuestionId
      );

      if (currentUrl === expected) {
        showOnly(name);
      }
    });
  });

  function selectScreen(name, qid) {
    desiredScreen = name;

    const frame = frames[name];
    const expectedUrl = screenUrl(name, qid);

    if (!frame) return;

    const previousUrl = frame.getAttribute("src");

    if (previousUrl !== expectedUrl) {
      loadedScreens.delete(name);
      hideAll();
      frame.setAttribute("src", expectedUrl);
      return;
    }

    // The iframe already loaded the correct question.
    if (loadedScreens.get(name) === expectedUrl) {
      showOnly(name);
      return;
    }

    // Don't show a previous view while loading.
    hideAll();

    // Handle an already-completed initial iframe.
    try {
      const documentState =
        frame.contentDocument?.readyState;

      if (documentState === "complete") {
        loadedScreens.set(name, expectedUrl);
        showOnly(name);
      }
    } catch (error) {
      // Keep the screen hidden until load event.
    }
  }

  async function tick() {
    if (busy) return;
    busy = true;

    try {
      const response = await fetch("/api/public", {
        method: "GET",
        cache: "no-store",
        credentials: "same-origin"
      });

      if (!response.ok) {
        throw new Error("Projector API unavailable");
      }

      const data = await response.json();

      const nextId = data.question?.id || null;
      const nextType =
        data.question_type === "poll"
          ? "poll"
          : "text";

      const nextScreen = targetName(
        data.screen,
        nextType
      );

      const questionChanged =
        activeQuestionId !== nextId ||
        activeType !== nextType;

      const screenChanged =
        desiredScreen !== nextScreen;

      activeQuestionId = nextId;
      activeType = nextType;

      if (
        !started ||
        questionChanged ||
        screenChanged
      ) {
        started = true;
        selectScreen(nextScreen, nextId);
      }

      // Deliberately do not reload the iframe on
      // every poll. This preserves animations.

    } catch (error) {
      console.warn(
        "SPORTUNI projector:",
        error
      );

      // Keep any correctly loaded screen visible.
    } finally {
      busy = false;
    }
  }

  tick();
  setInterval(tick, 1000);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) tick();
    }
  );
})();
