
/* ===================================================
   SPORTUNI WELCOME 2026
   ADMIN UI FIXES — COMPLETE VERSION

   1. Moderation queue above session control
   2. Select all questions, safely
   3. Preserve admin page after refresh

   No backend or database changes.
=================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const STORAGE_KEY =
    "sportuni_admin_active_page_v2";

  const VALID_PAGES = new Set([
    "live",
    "questions",
    "poll",
    "responses",
    "settings",
    "team"
  ]);

  /* =============================================
     1. DASHBOARD ORDER
  ============================================= */

  function arrangeDashboard() {
    const live = $("page-live");
    const review = $("reviewPanel");
    const session = $("suSessionCard");

    if (!live || !review || !session) {
      return;
    }

    // Put moderation immediately above
    // the student session management block.
    if (
      review.parentElement === live &&
      session.parentElement === live &&
      review.nextElementSibling !== session
    ) {
      live.insertBefore(review, session);
    }
  }

  /* =============================================
     2. SELECT ALL QUESTIONS
  ============================================= */

  function initializeSelectAll() {
    const toolbar = $("bulkQuestionToolbar");
    const history = $("questionHistory");
    const counter = $("selectedQuestionsCount");
    const deleteButton = $("deleteSelectedQuestions");

    if (
      !toolbar ||
      !history ||
      !counter ||
      !deleteButton
    ) {
      return;
    }

    if ($("suSelectAllQuestions")) {
      return;
    }

    const style = document.createElement("style");

    style.textContent = `
      #suSelectAllQuestions {
        background: #fff;
        color: #093759;
        border: 1px solid #cadbe7;
        padding: 10px 13px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 800;
        min-height: 40px;
      }

      #suSelectAllQuestions:hover:not(:disabled) {
        background: #edf5fa;
      }

      #suSelectAllQuestions:focus-visible {
        outline: 3px solid #FDCB4E;
        outline-offset: 2px;
      }

      #suSelectAllQuestions:disabled {
        opacity: .45;
      }
    `;

    document.head.appendChild(style);

    const button = document.createElement("button");

    button.type = "button";
    button.id = "suSelectAllQuestions";
    button.textContent = "☑ ყველას მონიშვნა";

    counter.after(button);

    function availableCheckboxes() {
      return Array.from(
        history.querySelectorAll(
          "input[data-question-check]:not(:disabled)"
        )
      );
    }

    function selectedCount() {
      return availableCheckboxes()
        .filter(item => item.checked)
        .length;
    }

    function updateButton() {
      const items = availableCheckboxes();

      if (!items.length) {
        button.textContent = "☑ ყველას მონიშვნა";
        button.disabled = true;
        return;
      }

      const checked = items.filter(
        item => item.checked
      ).length;

      const max = Math.min(items.length, 100);

      button.disabled =
        deleteButton.dataset.busy === "true";

      button.textContent =
        checked === items.length
          ? "☐ მონიშვნის გაუქმება"
          : items.length > 100
            ? "☑ 100-მდე კითხვის მონიშვნა"
            : "☑ ყველას მონიშვნა";

      button.title =
        checked + " / " +
        items.length +
        " მონიშნულია. ერთ ჯერზე მაქსიმუმ " +
        max + " კითხვა.";
    }

    button.addEventListener("click", () => {
      const initial = availableCheckboxes();

      if (!initial.length) return;

      const allSelected = initial.every(
        item => item.checked
      );

      const target = !allSelected;

      // admin.js rebuilds questionHistory
      // after checkbox change. Therefore always
      // find the CURRENT checkbox by stable ID.

      const ids = initial
        .map(item => item.dataset.questionCheck);

      const limit = target
        ? ids.slice(0, 100)
        : ids;

      for (const id of limit) {
        const current = availableCheckboxes().find(
          item => item.dataset.questionCheck === id
        );

        if (!current) continue;

        if (current.checked !== target) {
          current.checked = target;

          current.dispatchEvent(
            new Event("change", {
              bubbles: true
            })
          );
        }
      }

      updateButton();
    });

    history.addEventListener(
      "change",
      event => {
        if (
          event.target.matches(
            "input[data-question-check]"
          )
        ) {
          updateButton();
        }
      }
    );

    // Also update after a question is added,
    // deleted or the history is re-rendered.
    let updating = false;

    const observer = new MutationObserver(() => {
      if (updating) return;

      updating = true;

      requestAnimationFrame(() => {
        updating = false;
        updateButton();
      });
    });

    observer.observe(history, {
      childList: true
    });

    $("bulkSelectQuestions")?.addEventListener(
      "click",
      () => requestAnimationFrame(updateButton)
    );

    $("cancelQuestionSelection")?.addEventListener(
      "click",
      () => requestAnimationFrame(updateButton)
    );

    updateButton();
  }

  /* =============================================
     3. SAVE AND RESTORE CURRENT ADMIN PAGE
  ============================================= */

  function initializePageMemory() {
    const navs = Array.from(
      document.querySelectorAll(
        ".nav[data-page]"
      )
    );

    if (!navs.length) return;

    navs.forEach(button => {
      button.addEventListener("click", () => {
        const target = button.dataset.page;

        if (!VALID_PAGES.has(target)) {
          return;
        }

        try {
          sessionStorage.setItem(
            STORAGE_KEY,
            target
          );
        } catch (error) {
          // Navigation still works without storage.
        }
      });
    });

    let saved = "";

    try {
      saved =
        sessionStorage.getItem(STORAGE_KEY) || "";
    } catch (error) {}

    if (!VALID_PAGES.has(saved)) {
      return;
    }

    const selectedNav = navs.find(
      button => button.dataset.page === saved
    );

    if (selectedNav) {
      // Use the existing admin.js navigation.
      // This preserves its render and refresh logic.
      selectedNav.click();
    }
  }

  /* =============================================
     INITIALIZATION
  ============================================= */

  function initialize() {
    arrangeDashboard();
    initializeSelectAll();
    initializePageMemory();
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {once: true}
    );
  } else {
    initialize();
  }
})();
