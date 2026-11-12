
/* ======================================================
   SPORTUNI WELCOME 2026
   STUDENT PAGE — TEXT QUESTIONS + LIVE POLL
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

  const LIMIT = 100;

  const segmenter = typeof Intl.Segmenter === "function"
    ? new Intl.Segmenter("ka", {
        granularity: "grapheme"
      })
    : null;

  function chars(value) {
    if (segmenter) {
      return [
        ...segmenter.segment(value)
      ].map(item => item.segment);
    }

    return Array.from(value);
  }

  function draftKey(id) {
    return "su_draft_" + id;
  }

  function submissionKey(id) {
    return "su_submission_" + id;
  }

  function textError(message) {
    field.classList.add("field-error");
    field.setAttribute("aria-invalid", "true");
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
    counter.textContent = amount + " / " + LIMIT;
    counter.classList.toggle("warn", amount >= 90);

    if (field.value.trim()) {
      clearTextError();
    }

    if (qid && type === "text") {
      localStorage.setItem(draftKey(qid), field.value);
    }

    updateButtons();
  }

  field.addEventListener("input", updateText);

  document.querySelectorAll("[data-emoji]")
    .forEach(button => {
      button.addEventListener("click", () => {
        if (type !== "text" || field.disabled) {
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
        field.setSelectionRange(cursor, cursor);
      });
    });

  function renderOptions(options) {
    pollOptions.replaceChildren();

    selectedOption = null;
    selectedText = "";

    for (const option of options) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "poll-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");

      const heart = document.createElement("span");
      heart.className = "poll-heart";
      heart.style.backgroundColor =
        option.color || "#FDCB4E";
      heart.textContent = option.heart || "💛";

      const label = document.createElement("span");
      label.className = "poll-label";
      label.textContent = option.text;

      const indicator = document.createElement("span");
      indicator.className = "poll-radio";
      indicator.setAttribute("aria-hidden", "true");

      button.append(heart, label, indicator);

      button.addEventListener("click", () => {
        if (
          type !== "poll" ||
          !intake ||
          answered ||
          submitting ||
          closed
        ) {
          return;
        }

        selectedOption = option.id;
        selectedText = option.text;

        pollError.textContent = "";

        pollOptions.querySelectorAll(".poll-option")
          .forEach(item => {
            const active = item === button;
            item.classList.toggle("selected", active);
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

  function showForm() {
    if (closed) return;

    formCard.hidden = false;
    submittedState.hidden = true;
  }

  function showSubmitted() {
    formCard.hidden = true;
    submittedState.hidden = false;

    submittedTitle.textContent =
      "შენი პასუხი უკვე მიღებულია!";

    submittedMessage.textContent =
      "მადლობა მონაწილეობისთვის! დაელოდე შემდეგ კითხვას.";

    closePreview();
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

    closePreview();
    updateButtons();
  }

  function updateButtons() {
    const disabled =
      submitting ||
      checking ||
      answered ||
      closed ||
      !intake ||
      !qid;

    field.disabled = disabled || type !== "text";

    send.disabled =
      disabled ||
      (type === "poll" && !selectedOption);

    pollOptions.querySelectorAll("button")
      .forEach(button => {
        button.disabled = disabled;
      });
  }

  function openPreview() {
    if (!qid || answered || closed || !intake) {
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

      previewText.textContent = selectedText;

    } else {
      return;
    }

    previewQuestionId = qid;
    previewOverlay.hidden = false;
    previewConfirm.disabled = false;
    previewEdit.focus();
  }

  function closePreview() {
    previewOverlay.hidden = true;
    previewQuestionId = null;
  }

  previewEdit.addEventListener("click", closePreview);

  previewOverlay.addEventListener("click", event => {
    if (event.target === previewOverlay) {
      closePreview();
    }
  });

  document.addEventListener("keydown", event => {
    if (
      event.key === "Escape" &&
      !previewOverlay.hidden &&
      !submitting
    ) {
      closePreview();
    }
  });

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      credentials: "same-origin",
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      const exception = new Error(
        data.detail || "სერვერთან კავშირი ვერ დამყარდა."
      );

      exception.reason = data.reason || "";
      throw exception;
    }

    return data;
  }

  async function tick() {
    if (checking || submitting) return;

    checking = true;

    try {
      const state = await requestJson(
        "/api/student/poll"
      );

      if (state.session_closed) {
        showClosed();
        return;
      }

      // Do not reopen a finished session on this device.
      if (closed) return;

      if (!state.question?.id) {
        qid = null;
        answered = false;
        question.textContent =
          "კითხვა ჯერ არ გამოქვეყნებულა";

        intake = false;
        showForm();
        return;
      }

      const nextId = state.question.id;
      const nextType =
        state.question_type === "poll"
          ? "poll"
          : "text";

      const changed =
        qid !== nextId ||
        type !== nextType;

      if (changed) {
        closePreview();

        qid = nextId;
        answered = false;
        selectedOption = null;
        selectedText = "";

        question.textContent =
          state.question.text;

        changeType(nextType);
        showForm();

        if (nextType === "poll") {
          field.value = "";
          clearTextError();

          renderOptions(state.options || []);

          pollError.textContent = "";
        } else {
          pollOptions.replaceChildren();
          pollError.textContent = "";

          field.value =
            localStorage.getItem(draftKey(qid)) || "";

          updateText();
        }
      }

      intake = Boolean(state.intake);

      if (type === "poll") {
        answered = Boolean(state.answered);

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
        const textState = await requestJson(
          "/api/student/status"
        );

        if (textState.question?.id !== qid) {
          return;
        }

        answered = Boolean(textState.answered);

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

  form.addEventListener("submit", event => {
    event.preventDefault();
    openPreview();
  });

  previewConfirm.addEventListener("click", async () => {
    if (
      submitting ||
      checking ||
      !qid ||
      previewQuestionId !== qid ||
      !intake ||
      answered ||
      closed
    ) {
      closePreview();
      return;
    }

    const sendingQid = qid;
    const sendingType = type;
    const sendingOption = selectedOption;
    const sendingText = field.value.trim();

    submitting = true;
    previewConfirm.disabled = true;
    updateButtons();

    try {
      if (sendingType === "poll") {
        const result = await requestJson(
          "/api/student/poll/vote",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              qid: sendingQid,
              option_id: sendingOption
            })
          }
        );

        if (result.ok) {
          answered = true;
          showSubmitted();
        }

      } else {
        const key = submissionKey(sendingQid);

        let submissionId =
          localStorage.getItem(key);

        if (!submissionId) {
          submissionId = crypto.randomUUID();
          localStorage.setItem(key, submissionId);
        }

        await requestJson(
          "/api/student/submit",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              qid: sendingQid,
              text: sendingText,
              submission_id: submissionId
            })
          }
        );

        localStorage.removeItem(
          draftKey(sendingQid)
        );

        answered = true;
        showSubmitted();
      }

    } catch (exception) {
      closePreview();

      if (sendingType === "poll") {
        pollError.textContent =
          exception.message ||
          "ხმის მიცემა ვერ შესრულდა.";
      } else {
        textError(
          exception.message ||
          "პასუხის გაგზავნა ვერ შესრულდა."
        );
      }

      if (
        exception.reason === "session_closed" ||
        exception.reason === "question_changed"
      ) {
        // Refresh after the current request finishes.
        submitting = false;
        await tick();
        return;
      }

    } finally {
      submitting = false;
      updateButtons();
    }
  });

  // Check immediately and periodically.
  field.disabled = true;
  send.disabled = true;

  tick();
  setInterval(tick, 6500);

  // Refresh when returning to this browser tab.
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) tick();
    }
  );

})();
