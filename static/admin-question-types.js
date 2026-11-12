
/* =====================================================
   SPORTUNI WELCOME 2026
   PREPARED QUESTION TYPE LABELS

   Visual badges only.
   No API calls or publishing changes.
===================================================== */

(() => {
  "use strict";

  const style = document.createElement("style");

  style.textContent = `
    #preparedManagerList
      .prepared-entry-main > p::before,
    #preparedQuickList
      .prepared-entry-main > p::before,
    #pollSavedList
      .prepared-entry-main > p::before {
      display: inline-block;
      vertical-align: middle;
      padding: 5px 9px;
      margin: 0 9px 5px 0;
      border-radius: 30px;
      font-size: 10px;
      line-height: 1.4;
      font-weight: 900;
      white-space: nowrap;
    }

    #preparedManagerList
      .prepared-entry-main > p::before,
    #preparedQuickList
      .prepared-entry-main > p::before {
      content: "✎ ტექსტური";
      color: #164c70;
      background: #eaf3fa;
      border: 1px solid #d2e6f3;
    }

    #pollSavedList
      .prepared-entry-main > p::before {
      content: "💛 Live Poll";
      color: #7c5914;
      background: #fff5d7;
      border: 1px solid #f2dea2;
    }

    #preparedManagerList .prepared-entry-main,
    #preparedQuickList .prepared-entry-main,
    #pollSavedList .prepared-entry-main {
      min-width: 0;
    }

    #preparedManagerList .prepared-entry-main p,
    #preparedQuickList .prepared-entry-main p,
    #pollSavedList .prepared-entry-main p {
      line-height: 1.8;
      overflow-wrap: anywhere;
    }
  `;

  document.head.appendChild(style);
})();
