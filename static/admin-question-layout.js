
/* =====================================================
   SPORTUNI WELCOME 2026
   QUESTIONS PAGE — TWO COLUMN EDITOR LAYOUT

   Visual layout only.
   No API calls.
   No publishing logic changes.
   Existing event listeners and IDs are preserved.
===================================================== */

(() => {
  "use strict";

  function setup() {
    const page =
      document.getElementById("page-questions");

    const questionInput =
      document.getElementById("questionInput");

    const publishButton =
      document.getElementById("publishQuestion");

    const pollCreator =
      document.getElementById("pollCreatorPanel");

    const preparedPanel =
      document.getElementById("preparedQuestionsPanel");

    if (
      !page ||
      !questionInput ||
      !publishButton ||
      !pollCreator ||
      !preparedPanel
    ) {
      return;
    }

    if (document.getElementById("suQuestionEditors")) {
      return;
    }

    const form = questionInput.closest(".formgrid");

    if (!form) return;

    const questionField =
      Array.from(form.children).find(
        child => child.contains(questionInput)
      );

    const questionActions =
      Array.from(form.children).find(
        child => child.contains(publishButton)
      );

    if (!questionField || !questionActions) {
      return;
    }

    // -----------------------------------------
    // STYLES
    // -----------------------------------------

    const style = document.createElement("style");

    style.textContent = `
      #page-questions > .box {
        max-width: none;
      }

      #page-questions .formgrid {
        max-width: none;
        display: grid;
        gap: 22px;
      }

      #suQuestionEditors {
        display: grid;
        grid-template-columns:
          minmax(0, 0.9fr)
          minmax(0, 1.1fr);
        align-items: start;
        gap: 18px;
        width: 100%;
      }

      #suQuestionEditors > * {
        min-width: 0;
      }

      #suTextQuestionCard,
      #suQuestionEditors #pollCreatorPanel {
        height: 100%;
        border: 1px solid #dce6ef;
        border-radius: 18px;
        background: #fff;
        padding: 22px;
        box-shadow:
          0 10px 35px rgba(16,56,88,.045);
      }

      #suTextQuestionCard {
        display: flex;
        flex-direction: column;
        gap: 17px;
      }

      #suTextQuestionCard .su-editor-top {
        display: flex;
        align-items: center;
        justify-content: space-between;
        flex-wrap: wrap;
        gap: 10px;
      }

      #suTextQuestionCard .su-editor-icon,
      #suQuestionEditors .su-poll-icon {
        width: 39px;
        height: 39px;
        display: grid;
        place-items: center;
        border-radius: 12px;
        background: #eaf2f8;
        color: #093759;
        font-size: 20px;
      }

      #suTextQuestionCard h2 {
        margin: 0;
        color: #093759;
        font-size: 17px;
      }

      #suTextQuestionCard .su-editor-subtitle {
        color: #71889a;
        font-size: 11px;
        line-height: 1.8;
        margin: 0;
      }

      #suTextQuestionCard textarea {
        width: 100%;
        min-height: 160px;
        resize: vertical;
        border-radius: 12px;
      }

      #suTextQuestionCard .su-text-actions {
        display: flex;
        align-items: stretch;
        gap: 10px;
        flex-wrap: wrap;
        margin-top: auto;
      }

      #suTextQuestionCard .su-text-actions button {
        flex: 1 1 165px;
      }

      #suQuestionEditors #pollCreatorPanel {
        margin: 0 !important;
      }

      #suQuestionEditors #pollCreatorPanel
        > .sectiontitle:first-child {
        padding-bottom: 13px;
        margin-bottom: 15px;
        border-bottom: 1px solid #e5edf3;
      }

      #suQuestionEditors #pollCreatorPanel
        > .sectiontitle:first-child h2 {
        font-size: 17px;
        line-height: 1.5;
      }

      #suQuestionEditors #pollCreatorPanel
        textarea {
        width: 100%;
        resize: vertical;
        border-radius: 12px;
      }

      #suQuestionEditors
        #pollOptionsEditor {
        display: grid;
        gap: 10px;
      }

      #suQuestionEditors
        .poll-option-row {
        display: grid !important;
        grid-template-columns:
          34px minmax(0, 1fr)
          minmax(128px, 150px) 36px;
        align-items: center;
        gap: 8px !important;
        padding: 10px;
        border: 1px solid #e2eaf1;
        border-radius: 13px;
        background: #f8fbfd;
      }

      #suQuestionEditors
        .poll-option-text {
        min-width: 0 !important;
        width: 100%;
        border-radius: 9px;
      }

      #suQuestionEditors
        .poll-option-color {
        min-width: 0 !important;
        width: 100% !important;
        max-width: 100%;
        min-height: 40px;
        border: 1px solid #d5e2ed;
        border-radius: 10px;
        font-weight: 700;
        color: #093759;
      }

      #suQuestionEditors
        .poll-remove-option {
        width: 36px;
        height: 40px;
        padding: 0;
        display: grid;
        place-items: center;
      }

      #suQuestionEditors
        #pollSavePrepared,
      #suQuestionEditors
        #pollPublishNow {
        flex: 1 1 175px;
      }

      #preparedQuestionsPanel {
        width: 100%;
        min-width: 0;
        margin: 0 !important;
        border-radius: 17px;
      }

      #page-questions
        .formgrid > .divider {
        margin: 4px 0;
      }

      @media (max-width: 1250px) {
        #suQuestionEditors {
          grid-template-columns: 1fr;
        }

        #suTextQuestionCard,
        #suQuestionEditors #pollCreatorPanel {
          height: auto;
        }
      }

      @media (max-width: 650px) {
        #suQuestionEditors {
          gap: 14px;
        }

        #suTextQuestionCard,
        #suQuestionEditors #pollCreatorPanel {
          padding: 15px;
        }

        #suQuestionEditors
          .poll-option-row {
          grid-template-columns:
            32px minmax(0, 1fr) 34px;
        }

        #suQuestionEditors
          .poll-option-color {
          grid-column: 2;
          grid-row: 2;
        }

        #suQuestionEditors
          .poll-remove-option {
          grid-column: 3;
          grid-row: 1 / 3;
        }

        #suTextQuestionCard
          .su-text-actions button {
          flex-basis: 100%;
        }
      }
    `;

    document.head.appendChild(style);

    // -----------------------------------------
    // TWO-COLUMN CONTAINER
    // -----------------------------------------

    const editors = document.createElement("div");
    editors.id = "suQuestionEditors";

    const textCard = document.createElement("section");
    textCard.id = "suTextQuestionCard";

    const textHeading = document.createElement("div");
    textHeading.className = "su-editor-top";

    const headingGroup = document.createElement("div");

    const heading = document.createElement("h2");
    heading.textContent =
      "✎ ჩვეულებრივი კითხვა";

    const subheading = document.createElement("p");
    subheading.className = "su-editor-subtitle";
    subheading.textContent =
      "სტუდენტები პასუხს საკუთარი სიტყვებით დაწერენ.";

    headingGroup.append(
      heading,
      subheading
    );

    const icon = document.createElement("span");
    icon.className = "su-editor-icon";
    icon.textContent = "✎";
    icon.setAttribute("aria-hidden", "true");

    textHeading.append(
      headingGroup,
      icon
    );

    // Move the existing elements; do not clone.
    // Moving retains their event handlers.
    questionActions.classList.add("su-text-actions");

    textCard.append(
      textHeading,
      questionField,
      questionActions
    );

    editors.append(
      textCard,
      pollCreator
    );

    // Place editors above the saved-question list.
    form.insertBefore(
      editors,
      preparedPanel
    );

    // Existing prepared questions and history
    // stay as full-width sections below editors.

    // -----------------------------------------
    // ACCESSIBILITY AND SMALL VISUAL POLISH
    // -----------------------------------------

    const pollInput =
      document.getElementById("pollQuestionInput");

    if (pollInput) {
      pollInput.setAttribute(
        "aria-label",
        "Live Poll-ის შეკითხვა"
      );
    }

    questionInput.setAttribute(
      "aria-label",
      "ჩვეულებრივი ტექსტური შეკითხვა"
    );

    document
      .querySelectorAll(
        "#pollCreatorPanel .poll-option-color"
      )
      .forEach(select => {
        select.setAttribute(
          "title",
          "აირჩიე გულისა და ბურთულების ფერი"
        );
      });

    document.documentElement.dataset
      .suQuestionLayout = "ready";
  }

  if (document.readyState === "loading") {
    document.addEventListener(
      "DOMContentLoaded",
      setup,
      {once: true}
    );
  } else {
    setup();
  }
})();
