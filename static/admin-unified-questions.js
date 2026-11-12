
/* =====================================================
   SPORTUNI WELCOME 2026
   UNIFIED QUESTIONS MANAGEMENT

   - Consistent editor action buttons
   - Text save to Supabase, not localStorage
   - No separate text-question creation form
   - Unified quick launch: Text + Poll
   - Keeps existing publishing and Poll editors
===================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const textInput = $("questionInput");
  const textPublish = $("publishQuestion");
  const textDraft = $("saveDraft");

  const textPreparedPanel =
    $("preparedQuestionsPanel");

  const preparedInput =
    $("preparedQuestionInput");

  const preparedSave =
    $("savePreparedQuestion");

  const pollPublish =
    $("pollPublishNow");

  const pollSave =
    $("pollSavePrepared");

  const pollReset =
    $("pollResetForm");

  const pollPanel =
    $("pollCreatorPanel");

  const quickPanel =
    $("preparedQuickPanel");

  if (
    !textInput ||
    !textPublish ||
    !textDraft ||
    !textPreparedPanel ||
    !preparedInput ||
    !preparedSave ||
    !pollPublish ||
    !pollSave ||
    !pollReset ||
    !pollPanel ||
    !quickPanel
  ) {
    console.warn(
      "Unified questions: required elements missing"
    );
    return;
  }

  const style = document.createElement("style");

  style.textContent = `
    /* Hide old draft-only action. */
    #saveDraft {
      display: none !important;
    }

    /* Hide duplicate text question creation form.
       Keep elements alive for existing admin.js. */
    #preparedQuestionsPanel
      label[for="preparedQuestionInput"],
    #preparedQuestionInput {
      display: none !important;
    }

    #suOldPreparedSaveRow {
      display: none !important;
    }

    #suTextQuestionCard .su-text-actions {
      display: flex !important;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 8px !important;
      align-items: stretch;
    }

    #suTextQuestionCard
      .su-text-actions button {
      flex: 1 1 165px;
      min-height: 44px;
    }

    #suTextSave {
      box-shadow: none !important;
    }

    #suTextSave:disabled {
      opacity: .5;
    }

    #suQuestionEditors
      #suPollEditorActions {
      display: flex !important;
      flex-wrap: wrap;
      gap: 9px;
      align-items: stretch;
    }

    #suPollEditorActions
      #pollPublishNow,
    #suPollEditorActions
      #pollSavePrepared {
      flex: 1 1 170px;
      min-height: 44px;
    }

    #suPollEditorActions
      #pollResetForm {
      flex: 0 1 auto;
      min-height: 44px;
    }

    #suPollEditorActions
      #pollSavePrepared {
      box-shadow: none !important;
    }

    #preparedQuickList {
      display: none !important;
    }

    #preparedQuickCount {
      display: none !important;
    }

    #suUnifiedQuestionList {
      display: grid;
      gap: 11px;
      margin-top: 17px;
    }

    .su-unified-entry {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 15px;
      padding: 16px;
      background: #f9fbfd;
      border: 1px solid #e0e9f0;
      border-radius: 14px;
    }

    .su-unified-content {
      flex: 1 1 250px;
      min-width: 0;
    }

    .su-unified-kind {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      border-radius: 30px;
      padding: 5px 10px;
      font-size: 10px;
      font-weight: 900;
      margin-bottom: 9px;
      background: #e9f3fa;
      color: #164d71;
    }

    .su-unified-kind.poll {
      background: #fff3d2;
      color: #80601e;
    }

    .su-unified-title {
      font-size: 13px;
      line-height: 1.7;
      color: #123d58;
      font-weight: 800;
      overflow-wrap: anywhere;
      margin: 0 0 6px;
    }

    .su-unified-meta {
      font-size: 10px;
      color: #78909f;
      line-height: 1.6;
    }

    .su-unified-launch {
      flex: 0 0 auto;
      min-width: 125px;
    }

    #suUnifiedMessage {
      margin-top: 10px;
      font-size: 12px;
      font-weight: 700;
      color: #617c90;
    }

    #suUnifiedMessage.error {
      color: #c74955;
    }

    #suUnifiedCount {
      display: inline-flex;
      align-items: center;
      border-radius: 30px;
      background: #e9f7ef;
      color: #197c55;
      padding: 8px 11px;
      font-size: 11px;
      font-weight: 900;
    }

    @media(max-width:650px) {
      #suUnifiedQuestionList
        .su-unified-entry {
        align-items: stretch;
      }

      .su-unified-launch {
        width: 100%;
      }

      #suPollEditorActions
        #pollResetForm {
        flex: 1 1 100%;
      }
    }
  `;

  document.head.appendChild(style);

  /* ==========================================
     1. TEXT QUESTION EDITOR
  ========================================== */

  textPublish.textContent =
    "გამოქვეყნება ↗";

  const textSave =
    document.createElement("button");

  textSave.type = "button";
  textSave.id = "suTextSave";
  textSave.className = "quiet";
  textSave.textContent = "შენახვა";

  // Existing layout moved the text actions
  // into #suTextQuestionCard.
  const textActions =
    textPublish.parentElement;

  textActions.appendChild(textSave);

  // Hide legacy local-only draft button.
  // Its existing code remains installed.
  textDraft.hidden = true;

  // Hide the duplicate creation input while
  // retaining the saved-question management list.
  const oldSaveRow =
    preparedSave.parentElement;

  oldSaveRow.id = "suOldPreparedSaveRow";

  const preparedNotice =
    textPreparedPanel.querySelector(".notice");

  if (preparedNotice) {
    preparedNotice.textContent =
      "აქ მართავ წინასწარ შენახულ ტექსტურ კითხვებს. " +
      "ახალი კითხვის შენახვა ხდება ზემოთ, " +
      "ჩვეულებრივი კითხვის რედაქტორში.";
  }

  async function jsonApi(url, method = "GET", data) {
    const response = await fetch(url, {
      method,
      cache: "no-store",
      credentials: "same-origin",
      headers: data
        ? {"Content-Type": "application/json"}
        : {},
      body: data
        ? JSON.stringify(data)
        : undefined
    });

    const result = await response.json()
      .catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.detail ||
        "ოპერაცია ვერ შესრულდა."
      );
    }

    return result;
  }

  textSave.addEventListener("click", async () => {
    const value = textInput.value.trim();

    if (!value || value.length > 200) {
      window.alert(
        "კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს."
      );
      return;
    }

    textSave.disabled = true;
    textSave.textContent = "ინახება…";

    try {
      const result = await jsonApi(
        "/api/admin/prepared-questions",
        "POST",
        {text: value}
      );

      if (result.ok !== true) {
        throw new Error(
          "შენახვა ვერ დადასტურდა."
        );
      }

      textInput.value = "";

      $("questionCount").textContent =
        "0 სიმბოლო";

      localStorage.removeItem(
        "su_admin_draft"
      );

      window.alert(
        "კითხვა შენახულია. " +
        "ის არ გამოქვეყნებულა და მზადაა გასაშვებად."
      );

      // The existing admin.js refreshes the
      // saved text management list periodically.
      await loadUnified();

    } catch (error) {
      window.alert(error.message);

    } finally {
      textSave.disabled = false;
      textSave.textContent = "შენახვა";
    }
  });

  /* ==========================================
     2. POLL EDITOR BUTTONS
  ========================================== */

  const pollActions =
    pollPublish.parentElement;

  pollActions.id = "suPollEditorActions";

  // Move existing buttons, never clone.
  // Event listeners remain attached.
  pollActions.append(
    pollPublish,
    pollSave,
    pollReset
  );

  pollPublish.className = "primary";
  pollPublish.textContent =
    "გამოქვეყნება ↗";

  pollSave.className = "quiet";

  function labelPollSave() {
    const oldLabel = pollSave.textContent.trim();

    if (
      oldLabel.includes("ცვლილებების") ||
      oldLabel.includes("რედაქტირ")
    ) {
      pollSave.textContent =
        "ცვლილებების შენახვა";
    } else {
      pollSave.textContent = "შენახვა";
    }
  }

  labelPollSave();

  // Existing admin.js changes this label when
  // editing or clearing a saved Poll.
  const pollLabelObserver =
    new MutationObserver(labelPollSave);

  pollLabelObserver.observe(pollSave, {
    childList: true,
    characterData: true,
    subtree: true
  });

  pollReset.className = "quiet";
  pollReset.textContent = "გასუფთავება";

  /* ==========================================
     3. UNIFIED QUICK LAUNCH ON HOME
  ========================================== */

  const originalQuick =
    $("preparedQuickList");

  originalQuick.hidden = true;

  const quickCount =
    $("preparedQuickCount");

  const count = document.createElement("span");

  count.id = "suUnifiedCount";
  count.textContent = "იტვირთება…";

  quickCount.parentElement.appendChild(count);

  const list = document.createElement("div");

  list.id = "suUnifiedQuestionList";

  const message =
    document.createElement("div");

  message.id = "suUnifiedMessage";
  message.setAttribute(
    "role",
    "status"
  );

  quickPanel.append(
    list,
    message
  );

  let unifiedItems = [];
  let loading = false;
  let publishing = false;

  function showMessage(text, error = false) {
    message.textContent = text;
    message.classList.toggle("error", error);
  }

  function element(tag, className, content) {
    const node = document.createElement(tag);

    if (className) {
      node.className = className;
    }

    if (content !== undefined) {
      node.textContent = content;
    }

    return node;
  }

  function renderUnified() {
    list.replaceChildren();

    count.textContent =
      unifiedItems.length + " კითხვა";

    if (!unifiedItems.length) {
      list.appendChild(
        element(
          "div",
          "empty",
          "ჯერ არ არის წინასწარ შენახული კითხვა."
        )
      );
      return;
    }

    unifiedItems.forEach(item => {
      const entry = element(
        "div",
        "su-unified-entry"
      );

      const content = element(
        "div",
        "su-unified-content"
      );

      const kind = element(
        "span",
        "su-unified-kind" +
          (item.kind === "poll" ? " poll" : ""),
        item.kind === "poll"
          ? "💛 Live Poll"
          : "✎ ტექსტური"
      );

      const title = element(
        "p",
        "su-unified-title",
        item.question_text
      );

      const optionCount =
        Array.isArray(item.options)
          ? item.options.length
          : 0;

      const subtitle = element(
        "div",
        "su-unified-meta",
        (
          item.kind === "poll"
            ? optionCount + " პასუხის ვარიანტი · "
            : ""
        ) +
        (
          item.last_published_at
            ? "უკვე გამოყენებულია · შესაძლებელია ხელახლა გაშვება"
            : "მზადაა გამოსაქვეყნებლად"
        )
      );

      content.append(
        kind,
        title,
        subtitle
      );

      const button = element(
        "button",
        "primary su-unified-launch",
        "გაშვება ↗"
      );

      button.type = "button";
      button.disabled = publishing;

      button.addEventListener(
        "click",
        () => publishPrepared(item)
      );

      entry.append(
        content,
        button
      );

      list.appendChild(entry);
    });
  }

  async function loadUnified() {
    if (loading || publishing) {
      return;
    }

    loading = true;

    try {
      const [texts, polls] = await Promise.all([
        jsonApi("/api/admin/prepared-questions"),
        jsonApi("/api/admin/polls")
      ]);

      const pollItems = Array.isArray(polls.polls)
        ? polls.polls
        : [];

      const pollIds = new Set(
        pollItems.map(item => item.id)
      );

      const textItems = Array.isArray(texts.questions)
        ? texts.questions
        : [];

      // Exclude Poll IDs as an additional safeguard
      // if an older backend returns mixed records.
      const cleanTexts = textItems.filter(item =>
        item.question_type !== "poll" &&
        !pollIds.has(item.id)
      );

      unifiedItems = [
        ...cleanTexts.map(item => ({
          ...item,
          kind: "text"
        })),
        ...pollItems.map(item => ({
          ...item,
          kind: "poll"
        }))
      ];

      renderUnified();
      showMessage("");

    } catch (error) {
      showMessage(
        "შენახული კითხვების ჩატვირთვა ვერ მოხერხდა: " +
        error.message,
        true
      );

    } finally {
      loading = false;
    }
  }

  async function publishPrepared(item) {
    if (publishing) {
      return;
    }

    const isPoll = item.kind === "poll";

    const confirmed = window.confirm(
      (isPoll
        ? "გამოვაქვეყნოთ Live Poll?"
        : "გამოვაქვეყნოთ ჩვეულებრივი კითხვა?"
      ) +
      "\n\n" +
      item.question_text +
      "\n\n" +
      "პროექტორი გადავა QR რეჟიმზე. " +
      "ძველი პასუხები შენარჩუნდება."
    );

    if (!confirmed) {
      return;
    }

    publishing = true;
    renderUnified();

    showMessage("მიმდინარეობს გამოქვეყნება…");

    try {
      const endpoint = isPoll
        ? "/api/admin/polls/" +
          encodeURIComponent(item.id) +
          "/publish"
        : "/api/admin/prepared-questions/" +
          encodeURIComponent(item.id) +
          "/publish";

      const result = await jsonApi(
        endpoint,
        "POST",
        {}
      );

      if (result.ok !== true) {
        throw new Error(
          "გამოქვეყნება ვერ დადასტურდა."
        );
      }

      showMessage(
        (isPoll ? "Live Poll" : "კითხვა") +
        " გამოქვეყნებულია · QR რეჟიმი ჩართულია."
      );

      await new Promise(resolve =>
        setTimeout(resolve, 500)
      );

    } catch (error) {
      showMessage(error.message, true);

    } finally {
      publishing = false;
      renderUnified();

      // Update usage timestamps and the list.
      loadUnified();
    }
  }

  /* ==========================================
     4. SYNCHRONIZATION
  ========================================== */

  loadUnified();

  setInterval(
    loadUnified,
    8000
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        loadUnified();
      }
    }
  );
})();
