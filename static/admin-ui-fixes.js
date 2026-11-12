
/* =====================================================
   SPORTUNI WELCOME 2026
   ADMIN UI IMPROVEMENTS

   1. Move moderation queue above session control
   2. Select all deletable questions
   3. Restore active admin page after refresh

   Uses existing admin functionality.
   Does not change server APIs.
===================================================== */

(() => {
  "use strict";

  const STORAGE_KEY =
    "sportuni_admin_active_page_v1";

  const PAGE_IDS = new Set([
    "live",
    "questions",
    "poll",
    "responses",
    "settings",
    "team"
  ]);

  /* ==========================================
     1. MODERATION QUEUE POSITION
  ========================================== */

  function arrangeDashboard() {
    const livePage =
      document.getElementById("page-live");

    const review =
      document.getElementById("reviewPanel");

    const session =
      document.getElementById("suSessionCard");

    if (!livePage || !review || !session) {
      return;
    }

    // The moderation queue must be immediately
    // ABOVE the student-session control.
    // Move the original node, do not clone it.
    session.before(review);
  }

  /* ==========================================
     2. SELECT ALL QUESTIONS
  ========================================== */

  function setupSelectAll() {
    const toolbar =
      document.getElementById(
        "bulkQuestionToolbar"
      );

    const history =
      document.getElementById(
        "questionHistory"
      );

    const count =
      document.getElementById(
        "selectedQuestionsCount"
      );

    const deleteButton =
      document.getElementById(
        "deleteSelectedQuestions"
      );

    if (
      !toolbar ||
      !history ||
      !count ||
      !deleteButton
    ) {
      return;
    }

    if (
      document.getElementById(
        "suSelectAllQuestions"
      )
    ) {
      return;
    }

    const button =
      document.createElement("button");

    button.type = "button";
    button.id = "suSelectAllQuestions";
    button.className = "mini";
    button.textContent = "☑ ყველას მონიშვნა";

    button.style.cssText = [
      "background:#ffffff",
      "color:#093759",
      "border:1px solid #cbdce8",
      "border-radius:9px",
      "padding:10px 13px",
      "font-weight:900",
      "min-height:39px"
    ].join(";");

    // Position next to the existing selection count.
    count.after(button);

    function checkboxes() {
      return Array.from(
        history.querySelectorAll(
          'input[data-question-check]:not(:disabled)'
        )
      );
    }

    function updateLabel() {
      const available = checkboxes();

      if (!available.length) {
        button.textContent =
          "☑ ყველას მონიშვნა";

        button.disabled = true;
        return;
      }

      const allChecked =
        available.every(
          checkbox => checkbox.checked
        );

      const selected =
        available.filter(
          checkbox => checkbox.checked
        ).length;

      button.disabled = false;

      if (allChecked) {
        button.textContent =
          "☐ მონიშვნის გაუქმება";

      } else if (available.length > 100) {
        button.textContent =
          "☑ პირველი 100-ის მონიშვნა";

      } else {
        button.textContent =
          "☑ ყველას მონიშვნა";
      }

      button.title =
        selected + " / " +
        available.length +
        " მონიშნულია";
    }

    button.addEventListener(
      "click",
      () => {
        const available = checkboxes();

        if (!available.length) return;

        // The existing delete endpoint accepts
        // a maximum of 100 questions per action.
        // Never bypass this server-side limit.
        const allChecked =
          available.every(
            checkbox => checkbox.checked
          );

        const target = !allChecked;

        available.forEach(
          (checkbox, index) => {
            const checked =
              target && index < 100;

            if (checkbox.checked === checked) {
              return;
            }

            checkbox.checked = checked;

            // Notify existing admin.js.
            checkbox.dispatchEvent(
              new Event("change", {
                bubbles: true
              })
            );
          }
        );

        updateLabel();
      }
    );

    history.addEventListener(
      "change",
      event => {
        if (
          event.target.matches(
            "[data-question-check]"
          )
        ) {
          updateLabel();
        }
      }
    );

    // The history is rebuilt when the server
    // refreshes or a question gets deleted.
    const observer =
      new MutationObserver(updateLabel);

    observer.observe(history, {
      childList: true,
      subtree: true
    });

    updateLabel();
  }

  /* ==========================================
     3. REMEMBER ADMIN PAGE
  ========================================== */

  function setupPageMemory() {
    const navigation =
      document.querySelectorAll(
        ".nav[data-page]"
      );

    if (!navigation.length) return;

    navigation.forEach(button => {
      button.addEventListener(
        "click",
        () => {
          const name =
            button.dataset.page;

          if (!PAGE_IDS.has(name)) {
            return;
          }

          try {
            sessionStorage.setItem(
              STORAGE_KEY,
              name
            );
          } catch (error) {
            // Browsing still works if storage
            // is disabled by the browser.
          }
        },
        {capture: true}
      );
    });

    let savedPage = "";

    try {
      savedPage =
        sessionStorage.getItem(
          STORAGE_KEY
        ) || "";
    } catch (error) {}

    if (!PAGE_IDS.has(savedPage)) {
      return;
    }

    const target =
      document.querySelector(
        '.nav[data-page="' +
        savedPage +
        '"]'
      );

    if (!target) return;

    // Use the existing admin.js navigation.
    // This preserves titles, data refresh
    // and all other page-specific behavior.
    target.click();
  }

  /* ==========================================
     INITIALIZE
  ========================================== */

  function initialize() {
    arrangeDashboard();
    setupSelectAll();
    setupPageMemory();
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      initialize,
      {once: true}
    );

  } else {
    initialize();
  }
})();
