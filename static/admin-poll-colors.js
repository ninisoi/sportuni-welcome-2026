
/* ====================================================
   SPORTUNI WELCOME 2026
   POLL COLOR PICKER

   Visual enhancement only.
   Original select values and change events stay intact.
==================================================== */

(() => {
  "use strict";

  const editor = document.getElementById(
    "pollOptionsEditor"
  );

  if (!editor) return;

  const style = document.createElement("style");

  style.textContent = `
    #pollOptionsEditor .su-color-picker {
      position: relative;
      min-width: 0;
      width: 100%;
    }

    #pollOptionsEditor .su-color-native {
      position: absolute !important;
      width: 1px !important;
      height: 1px !important;
      min-width: 0 !important;
      padding: 0 !important;
      margin: 0 !important;
      border: 0 !important;
      opacity: 0 !important;
      pointer-events: none !important;
    }

    #pollOptionsEditor .su-color-trigger {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 7px;
      width: 100%;
      min-width: 0;
      min-height: 43px;
      padding: 8px 11px;
      border: 1px solid #d9e5ed;
      border-radius: 11px;
      background: white;
      color: #093759;
      font-family: inherit;
      font-size: 11px;
      font-weight: 800;
      cursor: pointer;
      box-shadow: 0 2px 8px #09375907;
    }

    #pollOptionsEditor .su-color-trigger:hover {
      background: #f8fbff;
      border-color: #9ebacd;
    }

    #pollOptionsEditor .su-color-trigger:focus-visible {
      outline: 3px solid #FDCB4E;
      outline-offset: 2px;
    }

    #pollOptionsEditor .su-color-trigger .heart {
      font-size: 20px;
      line-height: 1;
      flex-shrink: 0;
    }

    #pollOptionsEditor .su-color-trigger .name {
      flex: 1;
      text-align: left;
      overflow: hidden;
      white-space: nowrap;
      text-overflow: ellipsis;
    }

    #pollOptionsEditor .su-color-trigger .arrow {
      font-size: 12px;
      color: #6e8497;
    }

    #pollOptionsEditor .su-color-menu {
      position: absolute;
      top: calc(100% + 6px);
      right: 0;
      z-index: 1000;
      width: 245px;
      max-width: min(245px, 80vw);
      max-height: 280px;
      overflow-y: auto;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 9px;
      border: 1px solid #dce7f0;
      border-radius: 15px;
      background: #fff;
      box-shadow: 0 14px 36px #09375927;
    }

    #pollOptionsEditor .su-color-menu[hidden] {
      display: none !important;
    }

    #pollOptionsEditor .su-color-choice {
      border: 1px solid #e5edf3;
      border-radius: 10px;
      background: #f8fbfd;
      color: #24445c;
      padding: 10px 5px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 5px;
      cursor: pointer;
      font-size: 10px;
      font-weight: 800;
      min-width: 0;
    }

    #pollOptionsEditor .su-color-choice .heart {
      font-size: 25px;
    }

    #pollOptionsEditor .su-color-choice:hover {
      background: #eef5fa;
      border-color: #bacfdf;
    }

    #pollOptionsEditor .su-color-choice.selected {
      border: 2px solid #093759;
      background: #eef6fc;
      color: #093759;
    }

    #pollOptionsEditor .su-color-choice:focus-visible {
      outline: 3px solid #FDCB4E;
      outline-offset: 1px;
    }

    #pollOptionsEditor .poll-option-row {
      overflow: visible !important;
    }

    #pollOptionsEditor .poll-option-row:has(
      .su-color-menu:not([hidden])
    ) {
      position: relative;
      z-index: 30;
    }

    @media(max-width:650px) {
      #pollOptionsEditor .su-color-picker {
        grid-column: 2;
        grid-row: 2;
      }

      #pollOptionsEditor .su-color-menu {
        right: auto;
        left: 0;
      }
    }
  `;

  document.head.appendChild(style);

  let activeMenu = null;
  let scheduled = false;

  function closeMenus() {
    editor
      .querySelectorAll(".su-color-menu")
      .forEach(menu => {
        menu.hidden = true;
      });

    editor
      .querySelectorAll(".su-color-trigger")
      .forEach(button => {
        button.setAttribute(
          "aria-expanded",
          "false"
        );
      });

    activeMenu = null;
  }

  function optionData(select) {
    return [...select.options].map(option => {
      const label = option.textContent.trim();
      const space = label.indexOf(" ");

      return {
        value: option.value,
        heart:
          space >= 0
            ? label.slice(0, space)
            : label,
        name:
          space >= 0
            ? label.slice(space + 1)
            : label,
        label
      };
    });
  }

  function updatePicker(picker) {
    const select = picker.querySelector(
      "select.poll-option-color"
    );

    const trigger = picker.querySelector(
      ".su-color-trigger"
    );

    const menu = picker.querySelector(
      ".su-color-menu"
    );

    if (!select || !trigger || !menu) return;

    const colors = optionData(select);

    const signature = JSON.stringify(colors);

    if (picker.dataset.signature !== signature) {
      picker.dataset.signature = signature;

      menu.replaceChildren();

      colors.forEach(color => {
        const choice = document.createElement(
          "button"
        );

        choice.type = "button";
        choice.className = "su-color-choice";
        choice.dataset.color = color.value;

        const heart = document.createElement(
          "span"
        );

        heart.className = "heart";
        heart.textContent = color.heart;

        const name = document.createElement(
          "span"
        );

        name.textContent = color.name;

        choice.append(heart, name);

        choice.addEventListener("click", () => {
          select.value = color.value;

          // Notify existing admin.js that the
          // original select value has changed.
          select.dispatchEvent(
            new Event("change", {
              bubbles: true
            })
          );

          updatePicker(picker);
          closeMenus();
          trigger.focus();
        });

        menu.appendChild(choice);
      });
    }

    const current = colors.find(
      color => color.value === select.value
    );

    if (current) {
      trigger.replaceChildren();

      const heart = document.createElement(
        "span"
      );

      heart.className = "heart";
      heart.textContent = current.heart;

      const name = document.createElement(
        "span"
      );

      name.className = "name";
      name.textContent = current.name;

      const arrow = document.createElement(
        "span"
      );

      arrow.className = "arrow";
      arrow.textContent = "⌄";

      trigger.append(heart, name, arrow);

      trigger.setAttribute(
        "aria-label",
        "ფერი: " + current.name
      );
    }

    menu.querySelectorAll(
      ".su-color-choice"
    ).forEach(choice => {
      const selected =
        choice.dataset.color === select.value;

      choice.classList.toggle(
        "selected",
        selected
      );

      choice.setAttribute(
        "aria-pressed",
        String(selected)
      );
    });
  }

  function enhance(select) {
    if (select.closest(".su-color-picker")) {
      updatePicker(
        select.closest(".su-color-picker")
      );
      return;
    }

    const picker = document.createElement(
      "div"
    );

    picker.className = "su-color-picker";

    select.before(picker);
    picker.appendChild(select);

    select.classList.add("su-color-native");

    const trigger = document.createElement(
      "button"
    );

    trigger.type = "button";
    trigger.className = "su-color-trigger";
    trigger.setAttribute(
      "aria-haspopup",
      "true"
    );
    trigger.setAttribute(
      "aria-expanded",
      "false"
    );

    const menu = document.createElement(
      "div"
    );

    menu.className = "su-color-menu";
    menu.hidden = true;

    picker.append(trigger, menu);

    trigger.addEventListener("click", () => {
      const wasOpen = !menu.hidden;

      closeMenus();

      if (!wasOpen) {
        menu.hidden = false;
        trigger.setAttribute(
          "aria-expanded",
          "true"
        );
        activeMenu = menu;
      }
    });

    select.addEventListener("change", () => {
      updatePicker(picker);
    });

    updatePicker(picker);
  }

  function synchronize() {
    editor
      .querySelectorAll(
        "select.poll-option-color"
      )
      .forEach(enhance);
  }

  // The Poll editor dynamically creates rows and
  // rebuilds color options when editing saved polls.
  const observer = new MutationObserver(() => {
    if (scheduled) return;

    scheduled = true;

    requestAnimationFrame(() => {
      scheduled = false;
      synchronize();
    });
  });

  observer.observe(editor, {
    childList: true,
    subtree: true
  });

  document.addEventListener("click", event => {
    if (
      activeMenu &&
      !event.target.closest(
        ".su-color-picker"
      )
    ) {
      closeMenus();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape" && activeMenu) {
      closeMenus();
    }
  });

  synchronize();
})();
