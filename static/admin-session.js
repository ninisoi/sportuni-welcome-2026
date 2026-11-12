
/* =====================================================
   SPORTUNI WELCOME 2026
   ADMIN — STUDENT SESSION CONTROL

   Main dashboard only.
   Existing admin.js is not modified.
===================================================== */

(() => {
  "use strict";

  const livePage = document.getElementById("page-live");

  if (!livePage) return;

  const style = document.createElement("style");

  style.textContent = `
    #suSessionCard {
      background: #fff;
      border: 1px solid #dce6ee;
      border-radius: 18px;
      padding: 20px 23px;
      margin: 18px 0;
      box-shadow: 0 10px 35px #10385809;
    }

    #suSessionCard .su-session-head {
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 12px;
      margin-bottom: 12px;
    }

    #suSessionCard h2 {
      font-size: 16px;
      color: #143b55;
      margin: 0;
    }

    #suSessionBadge {
      border-radius: 30px;
      padding: 8px 12px;
      font-size: 11px;
      font-weight: 800;
      background: #eef3f7;
      color: #49647a;
    }

    #suSessionBadge.active {
      background: #e7f8ef;
      color: #167b52;
    }

    #suSessionBadge.closed {
      background: #fff0f0;
      color: #b3424e;
    }

    #suSessionDescription {
      font-size: 12px;
      color: #61788b;
      line-height: 1.8;
      margin: 0 0 16px;
    }

    #suSessionAction {
      border: 1px solid #d87d87;
      color: #ad3948;
      background: #fff7f8;
      font-weight: 900;
      padding: 13px 17px;
      border-radius: 12px;
      cursor: pointer;
      max-width: 100%;
    }

    #suSessionAction.reopen {
      border-color: #bbdfcd;
      background: #eaf8f0;
      color: #176f4f;
    }

    #suSessionAction:disabled {
      opacity: .55;
      cursor: not-allowed;
    }

    #suSessionFeedback {
      font-size: 12px;
      font-weight: 700;
      margin-top: 12px;
      min-height: 18px;
      color: #61788b;
    }

    #suSessionFeedback.error {
      color: #b3424e;
    }

    @media (max-width: 640px) {
      #suSessionCard {
        padding: 16px;
      }
      #suSessionAction {
        width: 100%;
      }
    }
  `;

  document.head.appendChild(style);

  const card = document.createElement("section");
  card.id = "suSessionCard";

  card.innerHTML = `
    <div class="su-session-head">
      <h2>🔒 სტუდენტური სესიის მართვა</h2>
      <span id="suSessionBadge">იტვირთება…</span>
    </div>

    <p id="suSessionDescription">
      მიმდინარეობს სტუდენტური სესიის შემოწმება.
    </p>

    <button
      type="button"
      id="suSessionAction"
      disabled>
      იტვირთება…
    </button>

    <div
      id="suSessionFeedback"
      role="status"
      aria-live="polite">
    </div>
  `;

  // Add below the current control center
  // without changing existing control elements.
  livePage.appendChild(card);

  const badge =
    document.getElementById("suSessionBadge");

  const description =
    document.getElementById("suSessionDescription");

  const button =
    document.getElementById("suSessionAction");

  const feedback =
    document.getElementById("suSessionFeedback");

  let closed = null;
  let busy = false;

  function message(text, error = false) {
    feedback.textContent = text;
    feedback.classList.toggle("error", error);
  }

  async function api(method = "GET", body) {
    const response = await fetch(
      "/api/admin/student-session",
      {
        method,
        cache: "no-store",
        credentials: "same-origin",
        headers: body
          ? {"Content-Type": "application/json"}
          : {},
        body: body
          ? JSON.stringify(body)
          : undefined
      }
    );

    const data = await response.json()
      .catch(() => ({}));

    if (!response.ok || data.ok !== true) {
      throw new Error(
        data.detail ||
        "სესიის მდგომარეობა ვერ შემოწმდა."
      );
    }

    return data;
  }

  function render() {
    if (closed === null) {
      badge.textContent = "მიუწვდომელია";
      description.textContent =
        "სესიის სტატუსი ვერ ჩაიტვირთა.";
      button.disabled = true;
      return;
    }

    badge.className = closed
      ? "closed"
      : "active";

    badge.textContent = closed
      ? "სესია დასრულებულია"
      : "სესია აქტიურია";

    description.textContent = closed
      ? "სტუდენტების პასუხები დაბლოკილია. " +
        "მათ მადლობის გვერდი გამოუჩნდებათ. " +
        "შენახული პასუხები არ იშლება."
      : "სტუდენტური სესია ღიაა. " +
        "ღონისძიების დასრულებისას დახურე სესია, " +
        "რომ ძველი QR ბმულებით პასუხის გაგზავნაც შეწყდეს.";

    button.classList.toggle(
      "reopen",
      closed
    );

    button.textContent = closed
      ? "↻ სტუდენტური სესიის ხელახლა გახსნა"
      : "🔒 სტუდენტური სესიის დასრულება";

    button.disabled = busy;
  }

  async function refresh() {
    if (busy) return;

    try {
      const data = await api();
      closed = Boolean(data.closed);
      render();
    } catch (error) {
      if (closed === null) render();
      message(error.message, true);
    }
  }

  button.addEventListener("click", async () => {
    if (busy || closed === null) return;

    const target = !closed;

    const confirmation = target
      ? "დავასრულოთ სტუდენტური სესია?\n\n" +
        "ყველა სტუდენტის გვერდზე გამოჩნდება მადლობა. " +
        "ახალი ხმები და ტექსტური პასუხები დაიბლოკება.\n\n" +
        "ადმინისტრატორის პანელი მუშაობას გააგრძელებს."
      : "ხელახლა გავხსნათ სტუდენტური სესია?\n\n" +
        "პასუხების მიღება ისევ ჩაირთვება. " +
        "რეპეტიციისთვის შეგიძლია მუშაობის გაგრძელება.";

    if (!window.confirm(confirmation)) return;

    busy = true;
    render();
    message("მიმდინარეობს ცვლილების შენახვა…");

    try {
      const result = await api(
        "POST",
        {closed: target}
      );

      closed = Boolean(result.closed);

      if (closed !== target) {
        throw new Error(
          "სესიის მდგომარეობა ვერ დადასტურდა."
        );
      }

      message(
        closed
          ? "სესია წარმატებით დასრულდა."
          : "სესია ხელახლა გაიხსნა."
      );

      render();

    } catch (error) {
      message(error.message, true);

    } finally {
      busy = false;
      render();
    }
  });

  refresh();

  // Read authoritative state periodically,
  // including changes made in another admin tab.
  setInterval(refresh, 10000);

  document.addEventListener(
    "visibilitychange",
    () => {
      if (!document.hidden) refresh();
    }
  );
})();
