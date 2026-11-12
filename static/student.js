
/* ======================================================
   SPORTUNI WELCOME 2026
   STUDENT PAGE — TEXT QUESTIONS + LIVE POLL

   FIXED:
   - Confirmation window never closes by background polling
   - No silent return to answer form
   - Success only after server confirmation
   - Clear sending and error states
   - Safe retry after connection errors
   - One vote per Poll/device
====================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const field = $("answer");
  const counter = $("counter");
  const send = $("sendBtn");
  const error = $("answerError");
  const form = $("answerForm");

  const textArea = $("textInputArea");
  const pollArea = $("pollInputArea");
  const pollOptions = $("pollOptions");
  const pollError = $("pollError");

  const formCard = $("formCard");
  const submittedState = $("submittedState");
  const submittedTitle = $("submittedTitle");
  const submittedMessage = $("submittedMessage");

  const question = $("question");
  const prompt = $("answerPrompt");

  const previewOverlay = $("previewOverlay");
  const previewText = $("previewText");
  const previewEdit = $("previewEdit");
  const previewConfirm = $("previewConfirm");

  const LIMIT = 100;

  let qid = null;
  let type = null;

  let selectedOption = null;
  let selectedText = "";

  let intake = false;
  let answered = false;
  let closed = false;

  let submitting = false;
  let checking = false;

  let previewQuestionId = null;

  // Protect against old status requests updating
  // the page after the student opens confirmation.
  let stateVersion = 0;

  const segmenter =
    typeof Intl.Segmenter === "function"
      ? new Intl.Segmenter("ka", {
          granularity: "grapheme"
        })
      : null;

  function chars(value) {
    if (segmenter) {
      return [...segmenter.segment(value)]
        .map(item => item.segment);
    }

    return Array.from(value);
  }

  function draftKey(id) {
    return "su_draft_" + id;
  }

  function submissionKey(id) {
    return "su_submission_" + id;
  }

  /* ======================================================
     TEXT FIELD
  ====================================================== */

  function textError(message) {
    field.classList.add("field-error");

    field.setAttribute(
      "aria-invalid",
      "true"
    );

    error.textContent = message;
    error.classList.add("show");
  }

  function clearTextError() {
    field.classList.remove("field-error");

    field.removeAttribute("aria-invalid");

    error.textContent = "";
    error.classList.remove("show");
  }

  function updateText() {
    const all = chars(field.value);

    if (all.length > LIMIT) {
      field.value = all.slice(0, LIMIT).join("");
    }

    const amount = chars(field.value).length;

    counter.textContent =
      amount + " / " + LIMIT;

    counter.classList.toggle(
      "warn",
      amount >= 90
    );

    if (field.value.trim()) {
      clearTextError();
    }

    if (
      qid &&
      type === "text" &&
      !answered
    ) {
      localStorage.setItem(
        draftKey(qid),
        field.value
      );
    }

    updateButtons();
  }

  field.addEventListener(
    "input",
    updateText
  );

  document
    .querySelectorAll("[data-emoji]")
    .forEach(button => {

      button.addEventListener("click", () => {
        if (
          type !== "text" ||
          field.disabled ||
          submitting
        ) {
          return;
        }

        const start = field.selectionStart;
        const end = field.selectionEnd;

        const emoji = button.dataset.emoji;

        const result =
          field.value.slice(0, start) +
          emoji +
          field.value.slice(end);

        if (chars(result).length > LIMIT) {
          return;
        }

        field.value = result;

        updateText();
        field.focus();

        const cursor = start + emoji.length;

        field.setSelectionRange(
          cursor,
          cursor
        );
      });
    });

  /* ======================================================
     LIVE POLL OPTIONS
  ====================================================== */

  function renderOptions(options) {
    pollOptions.replaceChildren();

    selectedOption = null;
    selectedText = "";

    for (const option of options) {
      const button =
        document.createElement("button");

      button.type = "button";
      button.className = "poll-option";

      button.setAttribute(
        "role",
        "radio"
      );

      button.setAttribute(
        "aria-checked",
        "false"
      );

      const heart =
        document.createElement("span");

      heart.className = "poll-heart";

      heart.style.backgroundColor =
        option.color || "#FDCB4E";

      heart.textContent =
        option.heart || "💛";

      const label =
        document.createElement("span");

      label.className = "poll-label";
      label.textContent = option.text;

      const indicator =
        document.createElement("span");

      indicator.className = "poll-radio";

      indicator.setAttribute(
        "aria-hidden",
        "true"
      );

      button.append(
        heart,
        label,
        indicator
      );

      button.addEventListener("click", () => {
        if (
          type !== "poll" ||
          !intake ||
          answered ||
          submitting ||
          closed ||
          !previewOverlay.hidden
        ) {
          return;
        }

        selectedOption = option.id;
        selectedText = option.text;

        pollError.textContent = "";

        pollOptions
          .querySelectorAll(".poll-option")
          .forEach(item => {

            const active = item === button;

            item.classList.toggle(
              "selected",
              active
            );

            item.setAttribute(
              "aria-checked",
              String(active)
            );
          });

        updateButtons();
      });

      pollOptions.appendChild(button);
    }

    updateButtons();
  }

  /* ======================================================
     QUESTION TYPE
  ====================================================== */

  function changeType(nextType) {
    type = nextType;

    const isPoll = type === "poll";

    textArea.hidden = isPoll;
    pollArea.hidden = !isPoll;

    prompt.textContent = isPoll
      ? "აირჩიე ერთი პასუხი. გაგზავნამდე შეგიძლია არჩევანი შეცვალო."
      : "დაწერე ის, რასაც ფიქრობ — მოკლედ, გულწრფელად და შენი სიტყვებით.";

    send.textContent = isPoll
      ? "ხმის მიცემა ↗"
      : "გაგზავნა ↗";

    updateButtons();
  }

  /* ======================================================
     DISPLAY STATES
  ====================================================== */

  function showForm() {
    if (closed || answered) {
      return;
    }

    formCard.hidden = false;
    submittedState.hidden = true;
  }

  function showSubmitted() {
    answered = true;

    formCard.hidden = true;
    submittedState.hidden = false;

    submittedTitle.textContent =
      "შენი პასუხი უკვე მიღებულია!";

    submittedMessage.textContent =
      "მადლობა მონაწილეობისთვის! დაელოდე შემდეგ კითხვას.";

    closePreview(true);
    updateButtons();
  }

  function showClosed() {
    closed = true;
    intake = false;

    formCard.hidden = true;
    submittedState.hidden = false;

    submittedTitle.textContent =
      "მადლობა მონაწილეობისთვის!";

    submittedMessage.textContent =
      "SPORTUNI WELCOME 2026 დასრულებულია.";

    closePreview(true);
    updateButtons();
  }

  function updateButtons() {
    const unavailable =
      submitting ||
      answered ||
      closed ||
      !intake ||
      !qid;

    field.disabled =
      unavailable ||
      type !== "text";

    send.disabled =
      unavailable ||
      (
        type === "poll" &&
        !selectedOption
      );

    pollOptions
      .querySelectorAll("button")
      .forEach(button => {
        button.disabled = unavailable;
      });
  }

  /* ======================================================
     CONFIRMATION WINDOW
  ====================================================== */

  // Show submission errors INSIDE the confirmation
  // window instead of silently returning to the form.

  const previewStatus =
    document.createElement("p");

  previewStatus.id = "suPreviewStatus";

  previewStatus.setAttribute(
    "role",
    "alert"
  );

  previewStatus.setAttribute(
    "aria-live",
    "polite"
  );

  previewStatus.style.cssText = [
    "margin:12px 0",
    "font-size:12px",
    "font-weight:700",
    "line-height:1.7",
    "color:#ffd4d7",
    "display:none"
  ].join(";");

  const modalActions =
    previewConfirm.closest(".actions");

  if (modalActions) {
    modalActions.before(previewStatus);
  }

  function setPreviewStatus(message, isError = false) {
    previewStatus.textContent = message;

    previewStatus.style.display =
      message ? "block" : "none";

    previewStatus.style.color =
      isError
        ? "#ffd4d7"
        : "#ffe6a2";
  }

  function setSendingState(sending) {
    submitting = sending;

    previewConfirm.disabled = sending;
    previewEdit.disabled = sending;

    previewConfirm.textContent = sending
      ? "იგზავნება…"
      : "დადასტურება";

    updateButtons();
  }

  function openPreview() {
    if (
      !qid ||
      answered ||
      closed ||
      !intake ||
      submitting
    ) {
      return;
    }

    if (type === "text") {
      const value = field.value.trim();

      if (!value) {
        textError(
          "ველი ცარიელია — ჩაწერე შენი პასუხი."
        );

        field.focus();
        return;
      }

      previewText.textContent = value;

    } else if (type === "poll") {
      if (!selectedOption) {
        pollError.textContent =
          "აირჩიე ერთი პასუხის ვარიანტი.";
        return;
      }

      previewText.textContent =
        selectedText;

    } else {
      return;
    }

    // Cancel application of any status request
    // that started before this preview opened.
    stateVersion++;

    previewQuestionId = qid;

    setPreviewStatus("");

    previewConfirm.disabled = false;
    previewEdit.disabled = false;

    previewOverlay.hidden = false;

    previewConfirm.focus();
  }

  function closePreview(force = false) {
    if (
      submitting &&
      !force
    ) {
      return;
    }

    previewOverlay.hidden = true;
    previewQuestionId = null;

    setPreviewStatus("");
  }

  previewEdit.addEventListener(
    "click",
    () => closePreview()
  );

  previewOverlay.addEventListener(
    "click",
    event => {

      if (
        event.target === previewOverlay &&
        !submitting
      ) {
        closePreview();
      }
    }
  );

  document.addEventListener(
    "keydown",
    event => {

      if (
        event.key === "Escape" &&
        !previewOverlay.hidden &&
        !submitting
      ) {
        closePreview();
      }
    }
  );

  /* ======================================================
     SERVER REQUESTS
  ====================================================== */

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options
    });

    let data = {};

    try {
      data = await response.json();
    } catch (e) {
      throw new Error(
        "სერვერის პასუხი ვერ დამუშავდა. გადაამოწმე კავშირი."
      );
    }

    if (!response.ok) {
      const exception = new Error(
        data.detail ||
        "სერვერთან კავშირი ვერ დამყარდა."
      );

      exception.reason =
        data.reason || "";

      throw exception;
    }

    return data;
  }

  /* ======================================================
     AUTOMATIC STATUS CHECK

     Important:
     Never interrupt an open confirmation window.
     Never update the form during submission.
  ====================================================== */

  async function tick() {
    if (
      checking ||
      submitting ||
      !previewOverlay.hidden ||
      closed
    ) {
      return;
    }

    checking = true;

    const version = stateVersion;

    try {
      const state = await requestJson(
        "/api/student/poll"
      );

      // Student opened confirmation while request
      // was in progress: discard old response.
      if (
        version !== stateVersion ||
        !previewOverlay.hidden ||
        submitting
      ) {
        return;
      }

      if (state.session_closed) {
        showClosed();
        return;
      }

      if (!state.question?.id) {
        qid = null;
        answered = false;
        intake = false;

        question.textContent =
          "კითხვა ჯერ არ გამოქვეყნებულა";

        formCard.hidden = false;
        submittedState.hidden = true;

        updateButtons();
        return;
      }

      const nextId =
        state.question.id;

      const nextType =
        state.question_type === "poll"
          ? "poll"
          : "text";

      const changed =
        qid !== nextId ||
        type !== nextType;

      if (changed) {
        qid = nextId;
        answered = false;

        selectedOption = null;
        selectedText = "";

        question.textContent =
          state.question.text;

        changeType(nextType);

        // Reset the old success screen when
        // a genuinely new question is published.
        formCard.hidden = false;
        submittedState.hidden = true;

        if (nextType === "poll") {
          field.value = "";
          clearTextError();

          renderOptions(
            state.options || []
          );

          pollError.textContent = "";

        } else {
          pollOptions.replaceChildren();
          pollError.textContent = "";

          field.value =
            localStorage.getItem(
              draftKey(qid)
            ) || "";

          updateText();
        }
      }

      intake = Boolean(
        state.intake
      );

      if (type === "poll") {
        answered = Boolean(
          state.answered
        );

        if (answered) {
          showSubmitted();
          return;
        }

        if (!intake) {
          pollError.textContent =
            "პასუხების მიღება ამ ეტაპზე შეჩერებულია.";
        } else if (!selectedOption) {
          pollError.textContent = "";
        }

      } else {
        const textState =
          await requestJson(
            "/api/student/status"
          );

        if (
          version !== stateVersion ||
          !previewOverlay.hidden ||
          submitting
        ) {
          return;
        }

        if (
          textState.question?.id !== qid
        ) {
          return;
        }

        answered = Boolean(
          textState.answered
        );

        if (answered) {
          showSubmitted();
          return;
        }

        if (!intake) {
          textError(
            "პასუხების მიღება ამ ეტაპზე შეჩერებულია."
          );
        } else if (field.value.trim()) {
          clearTextError();
        }
      }

    } catch (exception) {
      if (
        version !== stateVersion ||
        !previewOverlay.hidden ||
        submitting
      ) {
        return;
      }

      if (type === "poll") {
        pollError.textContent =
          "კავშირი ვერ დამყარდა. სცადე ხელახლა.";
      } else if (type === "text") {
        textError(
          "სერვერთან კავშირი ვერ დამყარდა. სცადე ხელახლა."
        );
      }

    } finally {
      checking = false;
      updateButtons();
    }
  }

  /* ======================================================
     SEND ANSWER

     Confirmation is never silently dismissed.
  ====================================================== */

  form.addEventListener(
    "submit",
    event => {
      event.preventDefault();
      openPreview();
    }
  );

  previewConfirm.addEventListener(
    "click",
    async () => {

      if (
        submitting ||
        previewOverlay.hidden ||
        !previewQuestionId
      ) {
        return;
      }

      // Do not dismiss the confirmation if the
      // status polling request is running.
      // Server checks the active question itself.

      if (
        !qid ||
        previewQuestionId !== qid ||
        !intake ||
        answered ||
        closed
      ) {
        setPreviewStatus(
          "კითხვა შეიცვალა ან პასუხების მიღება შეჩერებულია. განაახლე გვერდი.",
          true
        );

        return;
      }

      const sendingQid = qid;
      const sendingType = type;

      const sendingOption =
        selectedOption;

      const sendingText =
        field.value.trim();

      if (
        sendingType === "poll" &&
        !sendingOption
      ) {
        setPreviewStatus(
          "პასუხი არ არის არჩეული.",
          true
        );
        return;
      }

      if (
        sendingType === "text" &&
        !sendingText
      ) {
        setPreviewStatus(
          "პასუხის ველი ცარიელია.",
          true
        );
        return;
      }

      setSendingState(true);

      setPreviewStatus(
        "შენი პასუხი იგზავნება…"
      );

      let success = false;

      try {
        if (sendingType === "poll") {
          const result = await requestJson(
            "/api/student/poll/vote",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                qid: sendingQid,
                option_id: sendingOption
              })
            }
          );

          if (result.ok === true) {
            success = true;
          } else {
            throw new Error(
              "ხმის მიღება ვერ დადასტურდა."
            );
          }

        } else {
          const key =
            submissionKey(sendingQid);

          let submissionId =
            localStorage.getItem(key);

          if (!submissionId) {
            submissionId =
              crypto.randomUUID();

            localStorage.setItem(
              key,
              submissionId
            );
          }

          const result = await requestJson(
            "/api/student/submit",
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/json"
              },
              body: JSON.stringify({
                qid: sendingQid,
                text: sendingText,
                submission_id: submissionId
              })
            }
          );

          if (result.ok === true) {
            success = true;

            localStorage.removeItem(
              draftKey(sendingQid)
            );
          } else {
            throw new Error(
              "პასუხის მიღება ვერ დადასტურდა."
            );
          }
        }

      } catch (exception) {
        // A network error can happen AFTER the server
        // stored the answer. Check before showing failure.
        try {
          if (sendingType === "poll") {
            const verification =
              await requestJson(
                "/api/student/poll"
              );

            if (
              verification.question?.id === sendingQid &&
              verification.answered === true
            ) {
              success = true;
            }

          } else {
            const verification =
              await requestJson(
                "/api/student/status"
              );

            if (
              verification.question?.id === sendingQid &&
              verification.answered === true
            ) {
              success = true;

              localStorage.removeItem(
                draftKey(sendingQid)
              );
            }
          }
        } catch (verificationError) {
          // Keep the confirmation open:
          // status is unknown, not confirmed.
        }

        if (!success) {
          setPreviewStatus(
            "გაგზავნა ვერ დადასტურდა. შენი არჩევანი შენარჩუნებულია. გადაამოწმე კავშირი და კვლავ დააჭირე „დადასტურება“-ს.",
            true
          );
        }
      } finally {
        setSendingState(false);
      }

      if (success) {
        showSubmitted();

        // Refresh safely for any newly published
        // question without interrupting success.
        tick();
      }
    }
  );

  /* ======================================================
     START
  ====================================================== */

  field.disabled = true;
  send.disabled = true;

  tick();

  setInterval(
    tick,
    6500
  );

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) {
        tick();
      }
    }
  );

})();
