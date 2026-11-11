
/* ======================================================
   SPORTUNI WELCOME 2026
   STEP 14 — STUDENT TEXT + POLL
====================================================== */

(() => {
  "use strict";

  const $ = id => document.getElementById(id);

  const field = $("answer");
  const counter = $("counter");
  const send = $("sendBtn");
  const error = $("answerError");
  const form = $("answerForm");

  const pollArea = $("pollInputArea");
  const pollOptions = $("pollOptions");
  const pollError = $("pollError");

  const formCard = $("formCard");
  const submittedState = $("submittedState");
  const prompt = document.querySelector(".card .prompt");
  const textMeta = document.querySelector(".form-meta");
  const emojiRow = document.querySelector(".emoji-row");
  const textNote = document.querySelector(".card .note");

  let qid = null;
  let type = null;
  let selectedOption = null;
  let submitting = false;
  let intake = false;
  let pollAnswered = false;
  let checking = false;

  const LIMIT = 100;

  const segmenter = Intl.Segmenter
    ? new Intl.Segmenter("ka", {
        granularity: "grapheme"
      })
    : null;

  const chars = value =>
    segmenter
      ? [...segmenter.segment(value)].map(x => x.segment)
      : [...value];

  const draftKey = id => "su_draft_" + id;

  /* ------------------------------
     TEXT INPUT
  ------------------------------ */

  function textError(message) {
    field.classList.add("field-error");
    field.setAttribute("aria-invalid", "true");
    error.textContent = message;
    error.classList.add("show");
  }

  function clearTextError() {
    field.classList.remove("field-error");
    field.removeAttribute("aria-invalid");
    error.classList.remove("show");
  }

  function updateText() {
    const all = chars(field.value);

    if (all.length > LIMIT) {
      field.value = all.slice(0, LIMIT).join("");
    }

    const amount = chars(field.value).length;

    counter.textContent = amount + " / 100";
    counter.classList.toggle("warn", amount >= 90);

    if (field.value.trim()) {
      clearTextError();
    }

    if (qid && type === "text") {
      localStorage.setItem(draftKey(qid), field.value);
    }
  }

  field.addEventListener("input", updateText);

  document.querySelectorAll("[data-emoji]").forEach(btn => {
    btn.addEventListener("click", () => {
      if (field.disabled || type !== "text") return;

      const start = field.selectionStart;
      const end = field.selectionEnd;
      const emoji = btn.dataset.emoji;

      const result =
        field.value.slice(0, start) +
        emoji +
        field.value.slice(end);

      if (chars(result).length > LIMIT) return;

      field.value = result;
      updateText();
      field.focus();

      const cursor = start + emoji.length;
      field.setSelectionRange(cursor, cursor);
    });
  });

  /* ------------------------------
     POLL OPTIONS
  ------------------------------ */

  function renderPollOptions(options) {
    pollOptions.replaceChildren();
    selectedOption = null;

    options.forEach(option => {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "poll-option";
      button.setAttribute("role", "radio");
      button.setAttribute("aria-checked", "false");

      const heart = document.createElement("span");
      heart.className = "poll-heart";
      heart.style.background =
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
        if (!intake || submitting || pollAnswered) return;

        selectedOption = option.id;
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

        updateSendButton();
      });

      pollOptions.appendChild(button);
    });
  }

  /* ------------------------------
     QUESTION TYPE
  ------------------------------ */

  function showQuestionType(nextType) {
    const isPoll = nextType === "poll";

    pollArea.hidden = !isPoll;

    field.hidden = isPoll;
    error.hidden = isPoll;

    if (textMeta) textMeta.hidden = isPoll;
    if (emojiRow) emojiRow.hidden = isPoll;
    if (textNote) textNote.hidden = isPoll;

    if (prompt) {
      prompt.textContent = isPoll
        ? "აირჩიე ერთი პასუხი და დაადასტურე შენი არჩევანი."
        : "დაწერე ის, რასაც ფიქრობ — მოკლედ, გულწრფელად და შენი სიტყვებით.";
    }

    send.textContent = isPoll
      ? "ხმის მიცემა  ↗"
      : "გაგზავნა  ↗";
  }

  function showSubmitted() {
    formCard.hidden = true;
    submittedState.hidden = false;

    submittedState.querySelector("h3").textContent =
      "შენი პასუხი უკვე მიღებულია!";

    submittedState.querySelector("p").textContent =
      "მადლობა მონაწილეობისთვის! დაელოდე შემდეგ კითხვას.";
  }

  function showForm() {
    formCard.hidden = false;
    submittedState.hidden = true;
  }

  function updateSendButton() {
    send.disabled =
      submitting ||
      !intake ||
      (type === "poll" && !selectedOption) ||
      pollAnswered;

    field.disabled =
      submitting ||
      !intake ||
      type !== "text";

    pollOptions.querySelectorAll("button")
      .forEach(button => {
        button.disabled =
          submitting || !intake || pollAnswered;
      });
  }

  /* ------------------------------
     SERVER
  ------------------------------ */

  async function requestJson(url, options = {}) {
    const response = await fetch(url, {
      cache: "no-store",
      ...options
    });

    const data = await response.json();

    if (!response.ok) {
      const e = new Error(
        data.detail || "სერვერთან კავშირი ვერ დამყარდა."
      );
      e.reason = data.reason || "";
      throw e;
    }

    return data;
  }

  /* ------------------------------
     QUESTION POLLING
  ------------------------------ */

  async function tick() {
    if (checking || submitting) return;
    checking = true;

    try {
      const state = await requestJson("/api/student/poll");

      if (state.session_closed) {
        // The final thank-you page will be added
        // with the event-close feature.
        formCard.hidden = true;
        submittedState.hidden = false;

        submittedState.querySelector("h3").textContent =
          "მადლობა მონაწილეობისთვის!";

        submittedState.querySelector("p").textContent =
          "SPORTUNI WELCOME 2026 დასრულებულია.";

        qid = null;
        type = null;
        return;
      }

      if (!state.question?.id) {
        qid = null;
        type = null;
        $("question").textContent =
          "კითხვა ჯერ არ გამოქვეყნებულა";

        send.disabled = true;
        field.disabled = true;
        return;
      }

      const nextId = state.question.id;
      const nextType =
        state.question_type === "poll" ? "poll" : "text";

      const changed =
        qid !== nextId || type !== nextType;

      if (changed) {
        qid = nextId;
        type = nextType;
        pollAnswered = false;
        selectedOption = null;

        $("question").textContent = state.question.text;

        showQuestionType(type);
        showForm();

        if (type === "poll") {
          field.value = "";
          clearTextError();

          renderPollOptions(state.options || []);

        } else {
          field.value =
            localStorage.getItem(draftKey(qid)) || "";

          updateText();
          pollError.textContent = "";
        }
      }

      intake = Boolean(state.intake);

      if (type === "poll") {
        pollAnswered = Boolean(state.answered);

        if (pollAnswered) {
          showSubmitted();
          return;
        }

        if (!intake) {
          pollError.textContent =
            "ამ ეტაპზე პასუხების მიღება შეჩერებულია.";
        } else if (!selectedOption) {
          pollError.textContent = "";
        }

      } else {
        // Keep the original text-answer confirmation flow.
        const textState = await requestJson(
          "/api/student/status"
        );

        if (textState.question?.id !== qid) return;

        if (textState.answered) {
          location.replace("/confirmation");
          return;
        }

        if (!intake) {
          textError(
            "ამ ეტაპზე პასუხების მიღება შეჩერებულია."
          );
        } else if (field.value.trim()) {
          clearTextError();
        }
      }

      updateSendButton();

    } catch (e) {
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
    }
  }

  /* ------------------------------
     SUBMISSION
  ------------------------------ */

  form.addEventListener("submit", async event => {
    event.preventDefault();

    if (submitting || !qid || !intake) return;

    const sendingQid = qid;

    if (type === "poll") {
      if (!selectedOption) {
        pollError.textContent =
          "აირჩიე ერთი პასუხის ვარიანტი.";
        return;
      }

      submitting = true;
      updateSendButton();

      try {
        const result = await requestJson(
          "/api/student/poll/vote",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json"
            },
            body: JSON.stringify({
              qid: sendingQid,
              option_id: selectedOption
            })
          }
        );

        if (result.ok) {
          pollAnswered = true;
          showSubmitted();
        }
      } catch (e) {
        pollError.textContent =
          e.message || "ხმის მიცემა ვერ შესრულდა.";

        if (
          e.reason === "question_changed" ||
          e.reason === "session_closed"
        ) {
          await tick();
        }
      } finally {
        submitting = false;
        updateSendButton();
      }

      return;
    }

    /* ORIGINAL TEXT QUESTION */

    const text = field.value.trim();

    if (!text) {
      textError(
        "ველი ცარიელია — ჩაწერე შენი პასუხი."
      );
      field.focus();
      return;
    }

    submitting = true;
    updateSendButton();

    try {
      const key = "su_submission_" + sendingQid;

      let submissionId = localStorage.getItem(key);

      if (!submissionId) {
        submissionId = crypto.randomUUID();
        localStorage.setItem(key, submissionId);
      }

      await requestJson("/api/student/submit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          qid: sendingQid,
          text,
          submission_id: submissionId
        })
      });

      localStorage.removeItem(draftKey(sendingQid));
      location.href = "/confirmation";

    } catch (e) {
      textError(
        e.message ||
        "პასუხი ვერ გაიგზავნა. სცადე ხელახლა."
      );
    } finally {
      submitting = false;
      updateSendButton();
    }
  });

  /* ------------------------------
     START
  ------------------------------ */

  send.disabled = true;
  field.disabled = true;

  tick();
  setInterval(tick, 6500);

})();
