
/* =========================================================
   SPORTUNI WELCOME 2026
   QUICK QUESTION TYPE SWITCHER

   Main admin dashboard only.
   Existing text-question editor stays unchanged.
   Poll inherits last published layout and colors.
   Separate Poll editor remains fully customizable.
========================================================= */

(() => {
  "use strict";

  const input = document.getElementById("quickQuestionInput");
  const publish = document.getElementById("quickPublish");

  if (!input || !publish) return;

  const originalPublish = publish.onclick;

  const palette = [
    ["yellow", "💛"],
    ["green", "💚"],
    ["lightblue", "🩵"],
    ["blue", "💙"],
    ["red", "❤️"],
    ["orange", "🧡"],
    ["purple", "💜"],
    ["pink", "🩷"],
    ["brown", "🤎"],
    ["black", "🖤"],
    ["gray", "🩶"],
    ["white", "🤍"]
  ];

  const heartFor = key =>
    palette.find(item => item[0] === key)?.[1] || "💛";

  let mode = "text";
  let busy = false;
  let layoutLoaded = false;

  let options = [
    {text: "", color_key: "yellow"},
    {text: "", color_key: "green"},
    {text: "", color_key: "lightblue"}
  ];

  const css = document.createElement("style");

  css.textContent = `
    #suQuickMode {
      margin-top: 14px;
      display: grid;
      gap: 12px;
    }

    #suQuickMode .su-type-switch {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5px;
      padding: 5px;
      border: 1px solid #dce7ef;
      border-radius: 14px;
      background: #f0f5f9;
    }

    #suQuickMode .su-type-btn {
      min-height: 43px;
      padding: 9px;
      border: 0;
      border-radius: 10px;
      background: transparent;
      color: #547084;
      font-weight: 800;
      font-size: 11px;
      cursor: pointer;
    }

    #suQuickMode .su-type-btn.active {
      background: #fff;
      color: #093759;
      box-shadow: 0 2px 8px #092e4c18;
    }

    #suQuickPollPanel {
      display: grid;
      gap: 11px;
      padding: 15px;
      border: 1px solid #dce7ef;
      border-radius: 15px;
      background: #f8fbfe;
    }

    #suQuickPollPanel[hidden] {
      display: none !important;
    }

    #suQuickPollRows {
      display: grid;
      gap: 9px;
    }

    .su-quick-option {
      display: flex;
      align-items: center;
      gap: 9px;
      min-width: 0;
    }

    .su-quick-heart {
      width: 37px;
      height: 37px;
      display: grid;
      place-items: center;
      border-radius: 10px;
      background: #e9f0f5;
      font-size: 23px;
      flex-shrink: 0;
    }

    .su-quick-option input {
      min-width: 0;
      width: 100%;
      flex: 1;
      padding: 11px;
      border: 1px solid #d4e1eb;
      background: white;
      color: #093759;
      border-radius: 10px;
      font-size: 12px;
      outline: none;
    }

    .su-quick-option input:focus {
      border-color: #093759;
      box-shadow: 0 0 0 3px #09375915;
    }

    .su-quick-delete {
      width: 29px;
      height: 34px;
      border: 0;
      background: transparent;
      color: #a15c65;
      font-size: 18px;
    }

    .su-quick-actions {
      display: flex;
      gap: 10px;
      align-items: center;
      flex-wrap: wrap;
    }

    .su-quick-add {
      border: 1px solid #cbdce8;
      border-radius: 10px;
      background: white;
      color: #093759;
      padding: 10px 12px;
      font-weight: 800;
      font-size: 11px;
    }

    #suQuickPollInfo {
      font-size: 11px;
      line-height: 1.6;
      color: #6c8191;
    }

    #suQuickPollError {
      color: #c74955;
      font-size: 11px;
      font-weight: 700;
    }

    #suQuickPollError:empty {
      display: none;
    }
  `;

  document.head.appendChild(css);

  const panel = document.createElement("div");
  panel.id = "suQuickMode";

  panel.innerHTML = `
    <div class="su-type-switch"
         role="group"
         aria-label="კითხვის ტიპი">

      <button type="button"
              class="su-type-btn active"
              id="suQuickTextBtn">
        ✎ ჩვეულებრივი
      </button>

      <button type="button"
              class="su-type-btn"
              id="suQuickPollBtn">
        💛 Live Poll
      </button>

    </div>

    <div id="suQuickPollPanel" hidden>

      <div style="font-weight:800;color:#093759">
        💛 Poll-ის პასუხები
      </div>

      <div id="suQuickPollRows"></div>

      <div class="su-quick-actions">
        <button type="button"
                class="su-quick-add"
                id="suQuickAdd">
          + პასუხის დამატება
        </button>

        <span id="suQuickPollCount"
              style="color:#718798;font-size:11px">
          3 / 12
        </span>
      </div>

      <div id="suQuickPollInfo">
        ფერები აღებულია ბოლოს გამოქვეყნებული Poll-იდან.
      </div>

      <div id="suQuickPollError"
           role="alert"></div>

    </div>
  `;

  input.after(panel);

  const textButton =
    document.getElementById("suQuickTextBtn");

  const pollButton =
    document.getElementById("suQuickPollBtn");

  const pollPanel =
    document.getElementById("suQuickPollPanel");

  const rows =
    document.getElementById("suQuickPollRows");

  const counter =
    document.getElementById("suQuickPollCount");

  const error =
    document.getElementById("suQuickPollError");

  const info =
    document.getElementById("suQuickPollInfo");

  function renderOptions() {
    rows.replaceChildren();

    options.forEach((option, index) => {
      const row = document.createElement("div");
      row.className = "su-quick-option";

      const heart = document.createElement("span");
      heart.className = "su-quick-heart";
      heart.textContent = heartFor(option.color_key);

      const field = document.createElement("input");
      field.type = "text";
      field.maxLength = 200;
      field.value = option.text;
      field.placeholder = "პასუხი " + (index + 1);
      field.setAttribute(
        "aria-label",
        "Poll-ის პასუხი " + (index + 1)
      );

      field.addEventListener("input", () => {
        option.text = field.value;
        error.textContent = "";
      });

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "su-quick-delete";
      remove.textContent = "×";
      remove.title = "პასუხის წაშლა";

      remove.disabled = options.length <= 2;

      remove.addEventListener("click", () => {
        if (options.length <= 2) return;

        options.splice(index, 1);
        renderOptions();
      });

      row.append(heart, field, remove);
      rows.appendChild(row);
    });

    counter.textContent = options.length + " / 12";
  }

  async function loadLatestLayout() {
    try {
      const response = await fetch(
        "/api/admin/polls/latest-layout",
        {
          cache: "no-store",
          credentials: "same-origin"
        }
      );

      if (!response.ok) {
        throw new Error("ბოლო Poll ვერ ჩაიტვირთა");
      }

      const data = await response.json();

      if (
        Array.isArray(data.options) &&
        data.options.length >= 2 &&
        data.options.length <= 12
      ) {
        options = data.options.map(item => ({
          text: item.text || "",
          color_key: item.color_key
        }));

        info.textContent =
          "შენარჩუნებულია ბოლოს გამოქვეყნებული Poll-ის " +
          "პასუხების განლაგება და ფერები.";

      } else {
        info.textContent =
          "პირველი Poll — გამოყენებულია საწყისი სამი ფერი.";
      }

      layoutLoaded = true;
      renderOptions();

    } catch (exception) {
      error.textContent =
        "ბოლო Poll-ის დიზაინის მიღება ვერ მოხერხდა. " +
        "სცადე გვერდის განახლება.";
    }
  }

  function switchMode(nextMode) {
    mode = nextMode;

    textButton.classList.toggle(
      "active", mode === "text"
    );

    pollButton.classList.toggle(
      "active", mode === "poll"
    );

    pollPanel.hidden = mode !== "poll";

    publish.textContent = mode === "poll"
      ? "Poll-ის გამოქვეყნება ↗"
      : "გამოქვეყნება ↗";

    if (mode === "poll" && !layoutLoaded) {
      loadLatestLayout();
    }
  }

  textButton.addEventListener("click", () => {
    switchMode("text");
  });

  pollButton.addEventListener("click", () => {
    switchMode("poll");
  });

  document.getElementById("suQuickAdd")
    .addEventListener("click", () => {

      if (options.length >= 12) {
        error.textContent =
          "მაქსიმუმ 12 პასუხის დამატებაა შესაძლებელი.";
        return;
      }

      const used = new Set(
        options.map(option => option.color_key)
      );

      const available = palette.find(
        item => !used.has(item[0])
      );

      if (!available) return;

      options.push({
        text: "",
        color_key: available[0]
      });

      error.textContent = "";
      renderOptions();
    });

  // Preserve the existing original text publish handler.
  publish.onclick = async () => {
    if (mode === "text") {
      if (typeof originalPublish === "function") {
        return originalPublish();
      }
      return;
    }

    if (busy) return;

    const text = input.value.trim();

    if (!text || text.length > 200) {
      error.textContent =
        "შეიყვანე კითხვა (1–200 სიმბოლო).";
      return;
    }

    if (!layoutLoaded) {
      error.textContent =
        "Poll-ის დიზაინი ჯერ არ ჩაიტვირთა.";
      return;
    }

    const cleaned = options.map(option => ({
      text: option.text.trim(),
      color_key: option.color_key
    }));

    if (
      cleaned.length < 2 ||
      cleaned.length > 12 ||
      cleaned.some(option =>
        !option.text || option.text.length > 200
      )
    ) {
      error.textContent =
        "შეავსე ყველა პასუხი (2–12 ვარიანტი).";
      return;
    }

    const confirmed = window.confirm(
      "გამოვაქვეყნოთ Live Poll?\n\n" +
      text +
      "\n\nპროექტორი გადავა QR რეჟიმზე."
    );

    if (!confirmed) return;

    busy = true;
    publish.disabled = true;
    error.textContent = "";

    try {
      const response = await fetch(
        "/api/admin/polls/publish-now",
        {
          method: "POST",
          credentials: "same-origin",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            text,
            options: cleaned
          })
        }
      );

      const data = await response.json()
        .catch(() => ({}));

      if (!response.ok || data.ok !== true) {
        throw new Error(
          data.detail ||
          "Poll-ის გამოქვეყნება ვერ შესრულდა."
        );
      }

      input.value = "";

      const inputCounter =
        document.getElementById("quickQuestionCount");

      if (inputCounter) {
        inputCounter.textContent = "0 / 200";
      }

      info.textContent =
        "Poll გამოქვეყნდა. მისი დიზაინი " +
        "შემდეგი სწრაფი Poll-ისთვის შენახულია.";

      window.alert(
        "Poll გამოქვეყნდა! პროექტორი QR რეჟიმშია."
      );

    } catch (exception) {
      error.textContent = exception.message;
    } finally {
      busy = false;
      publish.disabled = false;
    }
  };

  renderOptions();
  switchMode("text");

})();
