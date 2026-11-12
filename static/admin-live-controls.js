
/* ====================================================
   SPORTUNI WELCOME 2026
   EVENT CONTROL CENTER — QUICK DURATION SETTINGS

   Adds:
   - Answer visibility duration on the live dashboard
   - Current saved duration display
   - Safe server-side save
   - Automatic sync with Settings
   - Removes unused demo tray visually

   Existing admin controls remain unchanged.
==================================================== */

(() => {
  "use strict";

  function initialize() {
    const page = document.getElementById("page-live");
    const review = document.getElementById("reviewPanel");

    if (!page || !review) return;

    if (document.getElementById("suLiveDuration")) {
      return;
    }

    const style = document.createElement("style");

    style.textContent = `
      #suLiveDuration {
        margin: 0 0 18px;
        padding: 20px 23px;
        background: #fff;
        border: 1px solid #e1e8f0;
        border-radius: 18px;
        box-shadow: 0 10px 35px rgba(16,56,88,.035);
      }

      #suLiveDuration .su-live-duration-head {
        display: flex;
        justify-content: space-between;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
        margin-bottom: 12px;
      }

      #suLiveDuration h2 {
        margin: 0;
        font-size: 16px;
        color: #143b55;
      }

      #suLiveDuration .su-live-duration-badge {
        background: #e9f7ef;
        color: #197c55;
        font-size: 11px;
        font-weight: 900;
        padding: 8px 12px;
        border-radius: 20px;
      }

      #suLiveDuration p {
        margin: 0 0 15px;
        font-size: 12px;
        line-height: 1.8;
        color: #75899c;
      }

      #suLiveDuration .su-live-duration-actions {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: 10px;
      }

      #suLiveDuration input {
        width: 105px;
        max-width: 100%;
        min-height: 44px;
        padding: 10px 12px;
        border: 1px solid #d9e5ed;
        border-radius: 11px;
        background: #fff;
        color: #093759;
        font-size: 15px;
        font-weight: 800;
      }

      #suLiveDuration button {
        min-height: 44px;
      }

      #suLiveDurationMessage {
        min-height: 18px;
        margin-top: 10px;
        color: #197c55;
        font-size: 11px;
        font-weight: 800;
      }

      #suLiveDurationMessage.error {
        color: #c74955;
      }

      #page-live .demo-tray {
        display: none !important;
      }

      @media(max-width:650px) {
        #suLiveDuration {
          padding: 16px;
        }

        #suLiveDuration input {
          flex: 1;
        }

        #suLiveDuration button {
          flex: 2;
        }
      }
    `;

    document.head.appendChild(style);

    const card = document.createElement("article");
    card.id = "suLiveDuration";

    card.innerHTML = `
      <div class="su-live-duration-head">
        <h2>⏱️ პასუხების გამოჩენის დრო</h2>
        <span
          class="su-live-duration-badge"
          id="suLiveDurationBadge">
          იტვირთება…
        </span>
      </div>

      <p>
        განსაზღვრე, რამდენი წამით გამოჩნდეს
        თითოეული ტექსტური პასუხი პროექტორზე.
        მნიშვნელობა შენარჩუნდება ახალ კითხვებზეც.
      </p>

      <div class="su-live-duration-actions">
        <label for="suLiveDurationInput">
          ხანგრძლივობა:
        </label>

        <input
          type="number"
          id="suLiveDurationInput"
          min="3"
          max="60"
          step="1"
          value="8"
          aria-label="ხანგრძლივობა წამებში">

        <span>წამი</span>

        <button
          type="button"
          class="primary"
          id="suLiveDurationSave">
          დროის შენახვა
        </button>
      </div>

      <div
        id="suLiveDurationMessage"
        role="status"
        aria-live="polite">
      </div>
    `;

    review.before(card);

    const input =
      document.getElementById("suLiveDurationInput");

    const button =
      document.getElementById("suLiveDurationSave");

    const badge =
      document.getElementById("suLiveDurationBadge");

    const message =
      document.getElementById("suLiveDurationMessage");

    let busy = false;
    let dirty = false;

    input.addEventListener("input", () => {
      dirty = true;
      message.textContent = "";
    });

    function notify(text, isError = false) {
      message.textContent = text;
      message.classList.toggle("error", isError);
    }

    async function request(url, method = "GET", body) {
      const response = await fetch(url, {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: body
          ? {"Content-Type": "application/json"}
          : {},
        body: body
          ? JSON.stringify(body)
          : undefined
      });

      if (response.status === 401) {
        throw new Error(
          "ადმინისტრატორის სესია დასრულებულია."
        );
      }

      if (response.status === 403) {
        throw new Error(
          "ამ მოქმედებისთვის უფლებები არ გაქვს."
        );
      }

      const data = await response.json()
        .catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail ||
          "მოთხოვნა ვერ შესრულდა."
        );
      }

      return data;
    }

    function applyDuration(seconds) {
      if (
        !Number.isInteger(seconds) ||
        seconds < 3 ||
        seconds > 60
      ) {
        return;
      }

      badge.textContent =
        "შენახულია: " + seconds + " წმ";

      if (!dirty && !busy) {
        input.value = String(seconds);
      }
    }

    async function refreshDuration() {
      if (busy) return;

      try {
        const state = await request("/api/dashboard");

        const seconds = Number(
          state.answer_duration_seconds
        );

        applyDuration(seconds);

      } catch (error) {
        if (badge.textContent === "იტვირთება…") {
          badge.textContent =
            "მონაცემები მიუწვდომელია";
        }
      }
    }

    button.addEventListener("click", async () => {
      if (busy) return;

      const seconds = Number(
        input.value.trim()
      );

      if (
        !Number.isInteger(seconds) ||
        seconds < 3 ||
        seconds > 60
      ) {
        notify(
          "აირჩიე მთელი რიცხვი 3-დან 60-მდე.",
          true
        );
        return;
      }

      busy = true;
      button.disabled = true;
      button.textContent = "ინახება…";

      notify("მიმდინარეობს შენახვა…");

      try {
        await request(
          "/api/admin/change",
          "POST",
          {
            key: "answer_duration_seconds",
            value: seconds
          }
        );

        // Verify the saved value against server state.
        const state = await request(
          "/api/dashboard"
        );

        const saved = Number(
          state.answer_duration_seconds
        );

        if (saved !== seconds) {
          throw new Error(
            "დროის ცვლილება ვერ დადასტურდა."
          );
        }

        dirty = false;

        badge.textContent =
          "შენახულია: " + saved + " წმ";

        input.value = String(saved);

        notify(
          "პასუხების ხანგრძლივობა შენახულია."
        );

      } catch (error) {
        notify(error.message, true);

      } finally {
        busy = false;
        button.disabled = false;
        button.textContent = "დროის შენახვა";
      }
    });

    refreshDuration();

    // Keep both dashboard and Settings in sync.
    setInterval(refreshDuration, 10000);

    document.addEventListener(
      "visibilitychange",
      () => {
        if (!document.hidden) {
          refreshDuration();
        }
      }
    );
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
