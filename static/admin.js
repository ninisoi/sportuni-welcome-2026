
(() => {
'use strict';

const $ = id => document.getElementById(id);
let state = null;
let page = 'live';
let modalResolve = null;
let durationDirty = false;
let questionSelectionMode = false;
let questionDeleteBusy = false;
const selectedQuestionIds = new Set();

const esc = x => String(x ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;'
}[c]));

const api = async (url, method = 'GET', data) => {
  const r = await fetch(url, {
    method,
    headers: data ? {'Content-Type': 'application/json'} : {},
    body: data ? JSON.stringify(data) : undefined,
    cache: 'no-store'
  });

  if (r.status === 401 || r.status === 403) {
    location.href = '/login';
    throw Error('ავტორიზაცია აუცილებელია');
  }

  const v = await r.json().catch(() => ({}));
  if (!r.ok) throw Error(v.detail || 'ოპერაცია ვერ შესრულდა');
  return v;
};

function toast(msg) {
  $('toast').textContent = msg;
  $('toast').classList.add('on');
  clearTimeout(window._toast);
  window._toast = setTimeout(() => {
    $('toast').classList.remove('on');
  }, 2600);
}

async function act(fn) {
  try {
    await fn();
    await refresh();
  } catch (e) {
    toast(e.message);
  }
}

const labels = {
  
  poll: [
    'Live Poll',
    'გამოკითხვების მართვა და სატესტო რეჟიმი'
  ],

  live: [
    'ღონისძიების მართვის ცენტრი',
    'ყველა აუცილებელი მოქმედება ერთ ეკრანზე'
  ],
  questions: [
    'კითხვების მართვა',
    'შექმენი და გამოაქვეყნე ახალი კითხვა'
  ],
  responses: [
    'პასუხების არქივი',
    'მოძებნე, გაფილტრე და ჩამოტვირთე პასუხები'
  ],
  settings: [
    'პარამეტრები',
    'სისტემის წესები და ექსპორტი'
  ],
  team: [
    'მოდერატორები',
    'დამხმარე მოდერატორის უფლებები'
  ]
};

function showPage(p) {
  page = p;

  document.querySelectorAll('.pages').forEach(e => {
    e.classList.toggle('active', e.id === 'page-' + p);
  });

  document.querySelectorAll('.nav').forEach(e => {
    e.classList.toggle('active', e.dataset.page === p);
  });

  $('pageTitle').textContent = labels[p][0];
  $('pageDesc').textContent = labels[p][1];
  window.scrollTo(0, 0);
  render();
}

document.querySelectorAll('.nav').forEach(e => {
  e.onclick = () => showPage(e.dataset.page);
});

function confirmAction(title, message) {
  return new Promise(resolve => {
    $('modalTitle').textContent = title;
    $('modalText').textContent = message;
    $('modal').classList.add('open');
    modalResolve = resolve;
  });
}

function closeModal(value) {
  $('modal').classList.remove('open');
  modalResolve?.(value);
  modalResolve = null;
}

$('modalCancel').onclick = () => closeModal(false);
$('modalConfirm').onclick = () => closeModal(true);

async function refresh() {
  try {
    state = await api('/api/dashboard');
    render();
  } catch (e) {
    toast(e.message);
  }
}

function render() {
  if (!state) return;

  const q = state.questions.find(q => q.id === state.qid)
    || state.questions[0];

  const pending = state.answers.filter(a => a.status === 'pending');

  $('screenBadge').textContent =
    state.screen === 'qr' ? 'QR ეკრანი' : 'Live Wall';

  $('qrChoice').classList.toggle('active', state.screen === 'qr');
  $('wallChoice').classList.toggle('active', state.screen === 'wall');

  $('activeQuestion').textContent = q?.text || '—';
  $('qNumber').textContent = '№' + state.qid;

  $('intakeToggle').classList.toggle('on', state.intake);
  $('animationToggle').classList.toggle('on', state.animation);

  $('intakeStateLabel').textContent = state.intake
    ? 'სტუდენტებს შეუძლიათ პასუხის გაგზავნა'
    : 'პასუხების მიღება შეჩერებულია';

  $('pendingBadge').textContent = pending.length + ' მოლოდინში';

  $('moderationModeLabel').textContent = ({
    ai: 'AI მოდერაცია',
    manual: 'ხელით მოდერაცია',
    direct: 'პირდაპირი გამოქვეყნება'
  })[state.moderation_mode] || 'ხელით მოდერაცია';

  document.querySelectorAll('input[name=moderationMode]').forEach(r => {
    if (document.activeElement !== r) {
      r.checked = r.value === (
        window.selectedModerationMode || state.moderation_mode
      );
    }
  });

  // ძველი სიჩქარის კონტროლების თავსებადობა
  $('speedLabel').textContent =
    state.speed < 1 ? 'ნელი' :
    state.speed > 1 ? 'სწრაფი' : 'ნორმალური';

  $('slower').disabled = state.speed <= 0.5;
  $('faster').disabled = state.speed >= 2;

  // ახალი ფუნქცია: შენახული ხანგრძლივობა
  const savedDuration = Number(state.answer_duration_seconds) || 8;

  // ავტომატური განახლება არ წაშლის შეყვანილ რიცხვს
  if (
    document.activeElement !== $('answerDurationSeconds')
    && !durationDirty
  ) {
    $('answerDurationSeconds').value = savedDuration;
  }

  $('answerDurationStatus').textContent =
    'შენახული დრო: ' + savedDuration + ' წამი';

  const row = a => `
    <div class="item">
      <div>
        <p>${esc(a.text)}</p>
        <small>
          კითხვა №${a.qid} ·
          ${new Date(a.created_at).toLocaleTimeString('ka-GE', {
            hour: '2-digit',
            minute: '2-digit'
          })} · შესამოწმებელი
        </small>
      </div>
      <div class="actions">
        <button
          class="mini ok"
          data-review="${a.id}"
          data-action="approved"
        >✓ დამტკიცება</button>
        <button
          class="mini no"
          data-review="${a.id}"
          data-action="blocked"
        >✕ დაბლოკვა</button>
      </div>
    </div>
  `;

  $('pendingList').innerHTML = pending.length
    ? pending.map(row).join('')
    : '<div class="empty">✓ ამ მომენტში არცერთი პასუხი არ საჭიროებს შენს ჩარევას.</div>';

  renderQuestionHistory();

  const filter = $('statusFilter').value;
  const term = $('responseSearch').value.trim().toLowerCase();

  let list = state.answers.filter(a =>
    (filter === 'all' || a.status === filter)
    && a.text.toLowerCase().includes(term)
  );

  const badges = {
    approved: 'დამტკიცებული',
    pending: 'შესამოწმებელი',
    blocked: 'დაბლოკილი'
  };

  $('responseRows').innerHTML = list.length
    ? list.map(a => `
      <tr>
        <td>${esc(a.text)}</td>
        <td>№${a.qid}</td>
        <td>
          <span class="badge ${
            a.status === 'approved' ? 'green' :
            a.status === 'pending' ? 'amber' : 'red'
          }">${badges[a.status]}</span>
        </td>
        <td>
          ${new Date(a.created_at).toLocaleTimeString('ka-GE', {
            hour: '2-digit',
            minute: '2-digit'
          })}
        </td>
        <td>
          ${a.status === 'pending'
            ? `<button class="mini ok" data-review="${a.id}" data-action="approved">✓</button>
               <button class="mini no" data-review="${a.id}" data-action="blocked">✕</button>`
            : '—'
          }
        </td>
      </tr>
    `).join('')
    : '<tr><td colspan="5">პასუხები არ მოიძებნა</td></tr>';
}

// კითხვების ინდივიდუალური და ჯგუფური მართვა
function renderQuestionHistory() {
  if (!state) return;
  const questions = state.questions || [];
  const available = new Set(questions.map(q => q.uuid));
  for (const id of selectedQuestionIds) {
    if (!available.has(id)) selectedQuestionIds.delete(id);
  }

  $('bulkSelectQuestions').textContent = questionSelectionMode
    ? '✕ არჩევის რეჟიმის გამორთვა'
    : '☑ რამდენიმე კითხვის არჩევა';
  $('bulkQuestionToolbar').style.display = questionSelectionMode ? 'flex' : 'none';
  $('selectedQuestionsCount').textContent = selectedQuestionIds.size + ' კითხვა მონიშნულია';
  $('deleteSelectedQuestions').disabled = questionDeleteBusy || selectedQuestionIds.size === 0;

  $('questionHistory').innerHTML = questions.length
    ? questions.map(q => {
      const active = q.id === state.qid;
      return `<div class="item question-history-item">
        <div class="question-history-main">
          ${questionSelectionMode ? `<input type="checkbox" class="question-select-checkbox"
            data-question-check="${esc(q.uuid)}" aria-label="კითხვა №${q.id}-ის მონიშვნა"
            ${selectedQuestionIds.has(q.uuid) ? 'checked' : ''} ${active ? 'disabled' : ''}>` : ''}
          <div><p>${esc(q.text)}</p><small>კითხვა №${q.id}</small></div>
        </div>
        <div class="question-history-actions">
          ${active ? '<span class="badge green">აქტიური · წაშლა აკრძალულია</span>' : ''}
          <button type="button" class="mini" data-question-export="${esc(q.uuid)}">↓ პასუხების შენახვა</button>
          <button type="button" class="mini no" data-question-delete="${esc(q.uuid)}"
            ${active || questionDeleteBusy ? 'disabled' : ''}>🗑 წაშლა</button>
        </div>
      </div>`;
    }).join('')
    : '<div class="empty">კითხვები ჯერ არ არის გამოქვეყნებული.</div>';
}

$('bulkSelectQuestions').onclick = () => {
  if (questionDeleteBusy) return;
  questionSelectionMode = !questionSelectionMode;
  selectedQuestionIds.clear();
  renderQuestionHistory();
};

$('cancelQuestionSelection').onclick = () => {
  if (questionDeleteBusy) return;
  questionSelectionMode = false;
  selectedQuestionIds.clear();
  renderQuestionHistory();
};

$('questionHistory').addEventListener('change', e => {
  const checkbox = e.target.closest('[data-question-check]');
  if (!checkbox || !state || checkbox.disabled) return;
  const id = checkbox.dataset.questionCheck;
  if (checkbox.checked) selectedQuestionIds.add(id);
  else selectedQuestionIds.delete(id);
  $('selectedQuestionsCount').textContent = selectedQuestionIds.size + ' კითხვა მონიშნულია';
  $('deleteSelectedQuestions').disabled = questionDeleteBusy || selectedQuestionIds.size === 0;
});

async function deleteQuestionIds(ids) {
  if (!state || questionDeleteBusy) return;
  const unique = [...new Set(ids)];
  if (!unique.length || unique.length > 100) return toast('აირჩიე 1-დან 100-მდე კითხვა');
  const targets = state.questions.filter(q => unique.includes(q.uuid));
  if (targets.length !== unique.length) return toast('კითხვა ვერ მოიძებნა. განაახლე გვერდი.');
  if (targets.some(q => q.id === state.qid)) return toast('აქტიური კითხვის წაშლა აკრძალულია');

  const message = targets.length === 1
    ? `ნამდვილად წავშალოთ კითხვა №${targets[0].id}: „${targets[0].text}“? ამ კითხვის ყველა პასუხი და მოდერაციის ისტორია სამუდამოდ წაიშლება. საჭიროების შემთხვევაში ჯერ ჩამოტვირთე CSV.`
    : `ნამდვილად წავშალოთ ${targets.length} მონიშნული კითხვა? მათი ყველა პასუხი და მოდერაციის ისტორია სამუდამოდ წაიშლება. საჭიროების შემთხვევაში ჯერ ჩამოტვირთე CSV.`;
  if (!await confirmAction('კითხვის წაშლის დადასტურება', message)) return;

  questionDeleteBusy = true;
  renderQuestionHistory();
  try {
    const result = await api('/api/admin/questions/delete', 'POST', {question_ids: unique});
    if (result.ok !== true) throw Error('წაშლის შესრულება ვერ დადასტურდა');
    questionSelectionMode = false;
    selectedQuestionIds.clear();
    await refresh();
    toast(`წაიშალა ${result.deleted_questions ?? targets.length} კითხვა`);
  } catch (e) {
    toast(e.message);
  } finally {
    questionDeleteBusy = false;
    renderQuestionHistory();
  }
}

$('questionHistory').addEventListener('click', e => {
  const exportButton = e.target.closest('[data-question-export]');
  if (exportButton) {
    const id = exportButton.dataset.questionExport;
    if (state?.questions.some(q => q.uuid === id)) {
      location.href = '/api/admin/questions/' + encodeURIComponent(id) + '/export.csv';
    }
    return;
  }
  const deleteButton = e.target.closest('[data-question-delete]');
  if (deleteButton && !deleteButton.disabled) {
    deleteQuestionIds([deleteButton.dataset.questionDelete]);
  }
});

$('deleteSelectedQuestions').onclick = () => {
  if (selectedQuestionIds.size) deleteQuestionIds([...selectedQuestionIds]);
};

// მოდერაციის რეჟიმი
document.querySelectorAll('input[name=moderationMode]').forEach(r => {
  r.onchange = () => {
    window.selectedModerationMode = r.value;
  };
});

$('saveModerationMode').onclick = async () => {
  const next = window.selectedModerationMode || state.moderation_mode;

  if (next === state.moderation_mode) {
    return toast('ეს რეჟიმი უკვე ჩართულია');
  }

  if (
    next === 'direct'
    && !await confirmAction(
      'მოდერაციის გარეშე გამოქვეყნება',
      'ყველა ახალი პასუხი ეკრანზე შემოწმების გარეშე გამოჩნდება, მათ შორის შეურაცხმყოფელი ტექსტი. ნამდვილად ჩავრთოთ?'
    )
  ) return;

  await act(async () => {
    await api('/api/admin/change', 'POST', {
      key: 'moderation_mode',
      value: next
    });
    window.selectedModerationMode = null;
    toast('მოდერაციის რეჟიმი შენახულია');
  });
};

$('statusFilter').onchange = render;
$('responseSearch').oninput = render;

// პასუხების დამტკიცება / დაბლოკვა
document.addEventListener('click', e => {
  const b = e.target.closest('[data-review]');
  if (!b) return;

  act(async () => {
    await api('/api/review/' + b.dataset.review, 'POST', {
      status: b.dataset.action
    });

    toast(
      b.dataset.action === 'approved'
        ? 'პასუხი დამტკიცებულია'
        : 'პასუხი დაბლოკილია'
    );
  });
});

async function change(key, value) {
  await act(async () =>
    api('/api/admin/change', 'POST', {key, value})
  );
}

// პროექტორის კონტროლი
$('qrChoice').onclick = () => change('screen', 'qr');
$('wallChoice').onclick = () => change('screen', 'wall');

$('intakeToggle').onclick = () =>
  change('intake', !state.intake);

$('animationToggle').onclick = () =>
  change('animation', !state.animation);

// ძველი სიჩქარის კონტროლები — თავსებადობისთვის
$('slower').onclick = () =>
  change('speed', Math.max(0.5, +(state.speed - 0.25).toFixed(2)));

$('faster').onclick = () =>
  change('speed', Math.min(2, +(state.speed + 0.25).toFixed(2)));

$('normalSpeed').onclick = () => change('speed', 1);

// ========================================
// ახალი ფუნქცია: პასუხის ხანგრძლივობის შენახვა
// ========================================

$('answerDurationSeconds').addEventListener('input', () => {
  durationDirty = true;
});

$('saveAnswerDuration').onclick = async () => {
  const input = $('answerDurationSeconds');
  const raw = input.value.trim();
  const seconds = Number(raw);

  if (
    !raw
    || !Number.isInteger(seconds)
    || seconds < 3
    || seconds > 60
  ) {
    toast('შეიყვანე მთელი რიცხვი 3-დან 60-მდე');
    return;
  }

  $('saveAnswerDuration').disabled = true;

  try {
    await api('/api/admin/change', 'POST', {
      key: 'answer_duration_seconds',
      value: seconds
    });

    durationDirty = false;
    await refresh();

    toast('დრო შენახულია: ' + seconds + ' წამი');
  } catch (e) {
    toast(e.message);
  } finally {
    $('saveAnswerDuration').disabled = false;
  }
};

// კითხვების მართვა
$('quickQuestionInput').oninput = () => {
  $('quickQuestionCount').textContent =
    $('quickQuestionInput').value.length + ' / 200';
};

$('questionInput').oninput = () => {
  $('questionCount').textContent =
    $('questionInput').value.length + ' სიმბოლო';
};

async function publish(value) {
  if (!value.trim()) return toast('ჩაწერე კითხვა');

  if (value.trim().length > 200) {
    return toast('მაქსიმუმ 200 სიმბოლო');
  }

  const confirmed = await confirmAction(
    'ახალი კითხვის გამოქვეყნება',
    'ახალი კითხვა გამოჩნდება სტუდენტებთან და პროექტორი ავტომატურად გადავა ახალი QR კოდის ეკრანზე. ძველი პასუხები შენარჩუნდება. ადასტურებ?'
  );

  if (!confirmed) return;

  await act(async () => {
    await api('/api/admin/question', 'POST', {
      text: value.trim()
    });

    $('quickQuestionInput').value = '';
    $('questionInput').value = '';
    localStorage.removeItem('su_admin_draft');

    $('quickQuestionCount').textContent = '0 / 200';
    $('questionCount').textContent = '0 სიმბოლო';

    toast('ახალი კითხვა გამოქვეყნდა · QR ეკრანი ჩართულია');
  });
}

$('quickPublish').onclick = () =>
  publish($('quickQuestionInput').value);

$('publishQuestion').onclick = () =>
  publish($('questionInput').value);

$('saveDraft').onclick = () => {
  localStorage.setItem(
    'su_admin_draft',
    $('questionInput').value
  );
  toast('მონახაზი შენახულია ამ ბრაუზერში');
};

// CSV ექსპორტი
$('exportCsv').onclick = () => {
  location.href = '/api/admin/export.csv';
};

// მასობრივი წაშლა გამორთულია
$('clearDemo').textContent = 'წაშლა გამორთულია';
$('clearDemo').disabled = true;

$('clearDemo').onclick = async () => {
  if (await confirmAction(
    'ყველა პასუხის წაშლა',
    'ეს სამუდამოდ წაშლის ყველა კითხვის პასუხს. კითხვები შენარჩუნდება. ადასტურებ?'
  )) {
    act(async () => {
      await api('/api/admin/clear-answers', 'POST');
      toast('პასუხები წაიშალა');
    });
  }
};

$('demoIncoming').style.display = 'none';

// მოდერატორების მართვა
async function refreshTeam() {
  try {
    const r = await api('/api/admin/team');

    $('teamMembers').innerHTML = r.members
      .filter(x => x.role === 'moderator')
      .map(x => `
        <div class="item">
          <small>${esc(x.user_id)}</small>
          <div class="actions">
            <span class="badge ${x.is_active ? 'green' : 'red'}">
              ${x.is_active ? 'აქტიური' : 'შეჩერებული'}
            </span>
            ${x.is_active
              ? `<button class="mini no" data-revoke="${esc(x.user_id)}">წვდომის გაუქმება</button>`
              : ''
            }
          </div>
        </div>
      `).join('')
      || '<div class="empty">დამხმარე მოდერატორი ჯერ არ არის დამატებული</div>';
  } catch (e) {
    toast(e.message);
  }
}

$('grantModerator').onclick = () => act(async () => {
  await api('/api/admin/team/grant', 'POST', {
    user_id: $('moderatorUserId').value.trim()
  });

  $('moderatorUserId').value = '';
  await refreshTeam();
  toast('უფლება მინიჭებულია');
});

$('teamMembers').addEventListener('click', async e => {
  const b = e.target.closest('[data-revoke]');
  if (!b) return;

  const confirmed = await confirmAction(
    'წვდომის გაუქმება',
    'დამხმარე მოდერატორი ვეღარ შევიდეს პანელში?'
  );

  if (!confirmed) return;

  await act(async () => {
    await api('/api/admin/team/revoke', 'POST', {
      user_id: b.dataset.revoke
    });
    await refreshTeam();
  });
});

document.querySelector('[data-page=team]')
  .addEventListener('click', refreshTeam);

// პროექტორის 6-წამიანი გადახედვა
const overlay = $('peekOverlay');
const stage = overlay.querySelector('.peek-stage');

stage.innerHTML = `
  <iframe
    title="საპროექციო ეკრანის პირდაპირი წინასწარი ხედი"
    src="/screen"
    style="width:100%;height:100%;border:0;border-radius:14px"
  ></iframe>
`;

let countdown;

function closePreview() {
  overlay.classList.remove('open');
  clearInterval(countdown);
  stage.querySelector('iframe').src = 'about:blank';
}

function openPreview() {
  stage.querySelector('iframe').src = '/screen';
  overlay.classList.add('open');

  let left = 6;
  $('peekCountdown').textContent = '6 წმ';

  clearInterval(countdown);

  countdown = setInterval(() => {
    left--;
    $('peekCountdown').textContent = left + ' წმ';

    if (left <= 0) closePreview();
  }, 1000);
}

$('peekPreview').onclick = openPreview;
$('previewButton').onclick = openPreview;
$('peekClose').onclick = closePreview;

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closePreview();
});

// დაწყება და ავტომატური განახლება
refresh().then(() => {
  if (state) {
    $('questionInput').value =
      localStorage.getItem('su_admin_draft') || '';

    $('questionCount').textContent =
      $('questionInput').value.length + ' სიმბოლო';
  }
});

setInterval(refresh, 1600);

/* =========================================================
   SPORTUNI WELCOME 2026
   PREPARED QUESTIONS
   Existing admin functionality remains unchanged.
   ========================================================= */

let preparedItems = [];
let preparedActionBusy = false;
let preparedLoading = false;

function preparedStatus(item) {
  return item.last_published_at
    ? 'უკვე გამოყენებულია'
    : 'მზადაა გამოსაქვეყნებლად';
}

function preparedRender() {
  const manager = $('preparedManagerList');
  const quick = $('preparedQuickList');

  if (!manager || !quick) return;

  $('preparedManagerCount').textContent =
    preparedItems.length + ' კითხვა';

  $('preparedQuickCount').textContent =
    preparedItems.length + ' კითხვა';

  if (!preparedItems.length) {
    manager.innerHTML =
      '<div class="empty">ჯერ არ გაქვს შენახული კითხვები.</div>';

    quick.innerHTML =
      '<div class="empty">კითხვები დაამატე „კითხვების“ გვერდიდან.</div>';

    return;
  }

  manager.innerHTML = preparedItems.map((item, index) => `
    <div class="prepared-entry">
      <div class="prepared-entry-main">
        <p>
          ${index + 1}. ${esc(item.question_text)}
        </p>
        <small>${preparedStatus(item)}</small>
      </div>

      <div class="prepared-entry-actions">
        <button
          type="button"
          class="mini"
          data-prepared-up="${esc(item.id)}"
          ${index === 0 || preparedActionBusy ? 'disabled' : ''}
          title="ზემოთ გადატანა"
        >↑</button>

        <button
          type="button"
          class="mini"
          data-prepared-down="${esc(item.id)}"
          ${index === preparedItems.length - 1 || preparedActionBusy ? 'disabled' : ''}
          title="ქვემოთ გადატანა"
        >↓</button>

        <button
          type="button"
          class="mini"
          data-prepared-edit="${esc(item.id)}"
          ${preparedActionBusy ? 'disabled' : ''}
        >✎ შეცვლა</button>

        <button
          type="button"
          class="mini no"
          data-prepared-delete="${esc(item.id)}"
          ${preparedActionBusy ? 'disabled' : ''}
        >წაშლა</button>
      </div>
    </div>
  `).join('');

  quick.innerHTML = preparedItems.map((item, index) => `
    <div class="prepared-entry">
      <div class="prepared-entry-main">
        <p>
          ${index + 1}. ${esc(item.question_text)}
        </p>
        <small>
          ${item.last_published_at
            ? '✓ უკვე გამოყენებულია · ხელახლა გაშვება შესაძლებელია'
            : '● მზადაა გამოსაქვეყნებლად'}
        </small>
      </div>

      <div class="prepared-entry-actions">
        <button
          type="button"
          class="primary"
          data-prepared-publish="${esc(item.id)}"
          ${preparedActionBusy ? 'disabled' : ''}
        >გაშვება ↗</button>
      </div>
    </div>
  `).join('');
}

async function preparedLoad() {
  if (preparedLoading || preparedActionBusy) return;

  preparedLoading = true;

  try {
    const result = await api(
      '/api/admin/prepared-questions'
    );

    preparedItems = result.questions || [];
    preparedRender();

  } catch (e) {
    console.error('Prepared questions:', e);

    if (!preparedItems.length) {
      $('preparedManagerList').innerHTML =
        '<div class="empty">კითხვები ვერ ჩაიტვირთა.</div>';

      $('preparedQuickList').innerHTML =
        '<div class="empty">კითხვები ვერ ჩაიტვირთა.</div>';
    }

  } finally {
    preparedLoading = false;
  }
}

async function preparedAction(fn) {
  if (preparedActionBusy) return;

  preparedActionBusy = true;
  preparedRender();

  try {
    await fn();
  } catch (e) {
    toast(e.message);
  } finally {
    preparedActionBusy = false;
    await preparedLoad();
    preparedRender();
  }
}

function preparedFind(id) {
  return preparedItems.find(item => item.id === id);
}

/* PREPARED QUESTION INPUT */

$('preparedQuestionInput').addEventListener('input', () => {
  $('preparedQuestionCount').textContent =
    $('preparedQuestionInput').value.length + ' / 200';
});

/* SAVE NEW QUESTION */

$('savePreparedQuestion').onclick = async () => {
  const input = $('preparedQuestionInput');
  const text = input.value.trim();

  if (!text || text.length > 200) {
    return toast('კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს');
  }

  await preparedAction(async () => {
    await api(
      '/api/admin/prepared-questions',
      'POST',
      {text}
    );

    input.value = '';
    $('preparedQuestionCount').textContent = '0 / 200';

    toast('კითხვა შენახულია და მზადაა გასაშვებად');
  });
};

/* REORDER, EDIT AND DELETE */

$('preparedManagerList').addEventListener('click', async event => {
  const button = event.target.closest('button[data-prepared-up], button[data-prepared-down], button[data-prepared-edit], button[data-prepared-delete]');

  if (!button || preparedActionBusy) return;

  const id = button.dataset.preparedUp
    || button.dataset.preparedDown
    || button.dataset.preparedEdit
    || button.dataset.preparedDelete;

  const item = preparedFind(id);
  if (!item) return toast('კითხვა ვერ მოიძებნა');

  // Move question up or down.
  if (
    button.hasAttribute('data-prepared-up')
    || button.hasAttribute('data-prepared-down')
  ) {
    const index = preparedItems.findIndex(q => q.id === id);
    const direction = button.hasAttribute('data-prepared-up')
      ? -1 : 1;

    const nextIndex = index + direction;

    if (
      nextIndex < 0 ||
      nextIndex >= preparedItems.length
    ) return;

    const reordered = [...preparedItems];

    [reordered[index], reordered[nextIndex]] =
      [reordered[nextIndex], reordered[index]];

    await preparedAction(async () => {
      await api(
        '/api/admin/prepared-questions/reorder',
        'POST',
        {question_ids: reordered.map(q => q.id)}
      );

      toast('კითხვების თანმიმდევრობა შენახულია');
    });

    return;
  }

  // Edit prepared question.
  if (button.hasAttribute('data-prepared-edit')) {
    const edited = window.prompt(
      'შეცვალე მომზადებული კითხვა:',
      item.question_text
    );

    if (edited === null) return;

    const text = edited.trim();

    if (!text || text.length > 200) {
      return toast('კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს');
    }

    if (text === item.question_text) return;

    await preparedAction(async () => {
      await api(
        '/api/admin/prepared-questions/' +
          encodeURIComponent(id),
        'PATCH',
        {text}
      );

      toast('კითხვა განახლებულია');
    });

    return;
  }

  // Delete only the prepared draft.
  if (button.hasAttribute('data-prepared-delete')) {
    const confirmed = await confirmAction(
      'მომზადებული კითხვის წაშლა',
      'წაიშლება მხოლოდ წინასწარ შენახული კითხვა: „' +
      item.question_text +
      '“. თუ ის უკვე გამოქვეყნებული იყო, გამოქვეყნებული კითხვა და სტუდენტების პასუხები შენარჩუნდება. ნამდვილად წავშალოთ?'
    );

    if (!confirmed) return;

    await preparedAction(async () => {
      await api(
        '/api/admin/prepared-questions/' +
          encodeURIComponent(id),
        'DELETE'
      );

      toast('მომზადებული კითხვა წაშლილია');
    });
  }
});

/* QUICK LAUNCH ON THE MAIN CONTROL PAGE */

$('preparedQuickList').addEventListener('click', async event => {
  const button = event.target.closest(
    '[data-prepared-publish]'
  );

  if (!button || preparedActionBusy) return;

  const id = button.dataset.preparedPublish;
  const item = preparedFind(id);

  if (!item) {
    return toast('კითხვა ვერ მოიძებნა');
  }

  const alreadyUsed = Boolean(item.last_published_at);

  const message =
    'გავუშვათ კითხვა: „' +
    item.question_text +
    '“? დადასტურების შემდეგ სტუდენტებთან გამოჩნდება ახალი კითხვა, პროექტორი გადავა QR რეჟიმზე და პასუხების მიღება ჩვეულებრივ გაგრძელდება.' +
    (alreadyUsed
      ? ' ეს კითხვა უკვე გამოყენებულია; ხელახლა გაშვება შექმნის ახალ აქტიურ კითხვას.'
      : '');

  const confirmed = await confirmAction(
    'მომზადებული კითხვის გაშვება',
    message
  );

  if (!confirmed) return;

  await preparedAction(async () => {
    const result = await api(
      '/api/admin/prepared-questions/' +
        encodeURIComponent(id) +
        '/publish',
      'POST',
      {}
    );

    if (result.ok !== true) {
      throw Error('კითხვის გამოქვეყნება ვერ დადასტურდა');
    }

    await refresh();

    toast('კითხვა გამოქვეყნებულია · QR ეკრანი ჩართულია');
  });
});

/* INITIAL LOAD AND PERIODIC SYNCHRONIZATION */

preparedLoad();

// Keep lists synchronized with Supabase.
// Editing or saving is not interrupted by refresh.
setInterval(preparedLoad, 8000);

/* ==========================================================
   SPORTUNI WELCOME 2026 — LIVE POLL EDITOR
   Poll creation, editing, saving and publishing.
   Existing text-question functions remain unchanged.
========================================================== */

(function setupLivePollEditor() {

  const panel = document.getElementById('pollCreatorPanel');

  // If the HTML panel is not yet installed,
  // do not affect existing admin functionality.
  if (!panel) {
    console.warn('Live Poll HTML panel not found');
    return;
  }

  const get = id => document.getElementById(id);

  const editor = get('pollOptionsEditor');
  const question = get('pollQuestionInput');
  const count = get('pollOptionCount');
  const limitError = get('pollLimitError');
  const message = get('pollEditorMessage');

  const saveButton = get('pollSavePrepared');
  const publishButton = get('pollPublishNow');
  const addButton = get('pollAddOption');
  const resetButton = get('pollResetForm');

  const palette = [
    {key:'yellow', heart:'💛', name:'ყვითელი'},
    {key:'green', heart:'💚', name:'მწვანე'},
    {key:'lightblue', heart:'🩵', name:'ცისფერი'},
    {key:'red', heart:'❤️', name:'წითელი'},
    {key:'orange', heart:'🧡', name:'ნარინჯისფერი'},
    {key:'blue', heart:'💙', name:'ლურჯი'},
    {key:'purple', heart:'💜', name:'იისფერი'},
    {key:'pink', heart:'🩷', name:'ვარდისფერი'},
    {key:'brown', heart:'🤎', name:'ყავისფერი'},
    {key:'black', heart:'🖤', name:'შავი'},
    {key:'gray', heart:'🩶', name:'ნაცრისფერი'},
    {key:'white', heart:'🤍', name:'თეთრი'}
  ];

  const MAX_OPTIONS = 12;
  const MIN_OPTIONS = 2;

  let editingId = null;
  let busy = false;
  let savedPolls = [];

  // Saved polls are displayed in the same editor panel.
  const savedSection = document.createElement('div');

  savedSection.style.marginTop = '25px';

  savedSection.innerHTML = `
    <div class="divider"></div>
    <div class="sectiontitle">
      <h2>✦ შენახული Poll-ები</h2>
      <span class="badge" id="pollSavedCount">
        0 Poll
      </span>
    </div>
    <p class="smallprint">
      შენახული გამოკითხვები შეგიძლია
      შეცვალო, წაშალო ან გაუშვა.
    </p>
    <div id="pollSavedList"
         class="prepared-question-list">
      <div class="empty">იტვირთება…</div>
    </div>
  `;

  panel.appendChild(savedSection);

  const savedList = get('pollSavedList');
  const savedCount = get('pollSavedCount');

  function note(text, error = false) {
    message.textContent = text;
    message.style.color =
      error ? '#c74955' : '#17835e';
  }

  function rows() {
    return [...editor.querySelectorAll('.poll-option-row')];
  }

  function availableColor() {
    const used = new Set(
      rows().map(row =>
        row.querySelector('.poll-option-color').value
      )
    );

    return palette.find(color => !used.has(color.key));
  }

  function updateCounter() {
    const amount = rows().length;

    count.textContent = amount + ' / ' + MAX_OPTIONS;

    // The plus button stays available so the
    // maximum-limit warning can be displayed.
    rows().forEach(row => {
      row.querySelector('.poll-remove-option').disabled =
        amount <= MIN_OPTIONS;
    });
  }

  function refreshColorSelectors() {
    const allRows = rows();

    allRows.forEach(row => {
      const selector = row.querySelector('.poll-option-color');
      const previous = selector.value;

      selector.replaceChildren();

      palette.forEach(color => {
        const option = document.createElement('option');
        option.value = color.key;
        option.textContent =
          color.heart + ' ' + color.name;

        selector.appendChild(option);
      });

      if (palette.some(p => p.key === previous)) {
        selector.value = previous;
      } else {
        selector.value = 'yellow';
      }

      const color = palette.find(
        p => p.key === selector.value
      );

      row.querySelector('.poll-heart-preview').textContent =
        color?.heart || '💛';
    });

    updateCounter();
  }

  function makeRow(text = '', colorKey = null) {
    const color = palette.find(
      p => p.key === colorKey
    ) || availableColor() || palette[0];

    const row = document.createElement('div');
    row.className = 'poll-option-row';

    row.style.cssText =
      'display:flex;gap:10px;align-items:center;' +
      'flex-wrap:wrap;margin-bottom:2px';

    const heart = document.createElement('span');
    heart.className = 'poll-heart-preview';
    heart.style.fontSize = '26px';
    heart.textContent = color.heart;

    const input = document.createElement('input');
    input.className = 'poll-option-text';
    input.type = 'text';
    input.maxLength = 200;
    input.value = text;
    input.placeholder = 'ჩაწერე პასუხის ვარიანტი';
    input.style.cssText =
      'flex:1;min-width:180px';

    const selector = document.createElement('select');
    selector.className = 'poll-option-color';
    selector.style.minWidth = '140px';

    palette.forEach(item => {
      const option = document.createElement('option');
      option.value = item.key;
      option.textContent =
        item.heart + ' ' + item.name;
      selector.appendChild(option);
    });

    selector.value = color.key;

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'quiet poll-remove-option';
    remove.textContent = '✕';
    remove.title = 'პასუხის წაშლა';

    row.append(heart, input, selector, remove);

    selector.addEventListener('change', () => {
      const chosen = palette.find(
        p => p.key === selector.value
      );

      heart.textContent = chosen?.heart || '💛';

      // Warn about duplicate colors.
      const selectedColors = rows().map(
        r => r.querySelector('.poll-option-color').value
      );

      const duplicates = selectedColors.some(
        (key, index) =>
          selectedColors.indexOf(key) !== index
      );

      note(
        duplicates
          ? 'ერთ Poll-ში ერთი და იგივე ფერი არ უნდა განმეორდეს.'
          : '',
        duplicates
      );
    });

    remove.addEventListener('click', () => {
      if (rows().length <= MIN_OPTIONS) {
        note(
          'Poll-ს მინიმუმ ორი პასუხი სჭირდება.',
          true
        );
        return;
      }

      row.remove();
      refreshColorSelectors();
      limitError.style.display = 'none';
    });

    return row;
  }

  function readOptions() {
    return rows().map(row => ({
      text: row.querySelector('.poll-option-text')
        .value.trim(),
      color_key: row.querySelector('.poll-option-color')
        .value
    }));
  }

  function validate() {
    const text = question.value.trim();
    const options = readOptions();

    if (!text || text.length > 200) {
      throw Error(
        'კითხვა უნდა შეიცავდეს 1–200 სიმბოლოს.'
      );
    }

    if (
      options.length < MIN_OPTIONS ||
      options.length > MAX_OPTIONS
    ) {
      throw Error('Poll-ს სჭირდება 2–12 პასუხი.');
    }

    if (options.some(o =>
      !o.text || o.text.length > 200
    )) {
      throw Error(
        'შეავსე ყველა პასუხის ტექსტი.'
      );
    }

    const colors = options.map(o => o.color_key);

    if (new Set(colors).size !== colors.length) {
      throw Error(
        'პასუხებს განსხვავებული ფერები უნდა ჰქონდეს.'
      );
    }

    return {text, options};
  }

  function resetForm() {
    editingId = null;
    question.value = '';
    get('pollQuestionCount').textContent = '0 / 200';

    editor.replaceChildren(
      makeRow('', 'yellow'),
      makeRow('', 'green'),
      makeRow('', 'lightblue')
    );

    saveButton.textContent =
      '✦ Poll-ის წინასწარ შენახვა';

    refreshColorSelectors();
    limitError.style.display = 'none';
    note('');
  }

  function loadIntoEditor(poll) {
    editingId = poll.id;
    question.value = poll.question_text;

    get('pollQuestionCount').textContent =
      question.value.length + ' / 200';

    editor.replaceChildren();

    (poll.options || []).forEach(option => {
      editor.appendChild(
        makeRow(option.text, option.color_key)
      );
    });

    refreshColorSelectors();

    saveButton.textContent =
      '✓ Poll-ის ცვლილებების შენახვა';

    note('რედაქტირდება შენახული Poll.');

    panel.scrollIntoView({
      behavior: 'smooth',
      block: 'start'
    });
  }

  function setBusy(value) {
    busy = value;

    saveButton.disabled = value;
    publishButton.disabled = value;
    resetButton.disabled = value;
    addButton.disabled = value;
  }

  async function loadSaved() {
    try {
      const result = await api('/api/admin/polls');

      savedPolls = Array.isArray(result.polls)
        ? result.polls
        : [];

      renderSaved();

    } catch (error) {
      savedList.textContent =
        'Poll-ების ჩატვირთვა ვერ მოხერხდა: ' +
        error.message;
    }
  }

  function renderSaved() {
    savedCount.textContent =
      savedPolls.length + ' Poll';

    savedList.replaceChildren();

    if (!savedPolls.length) {
      const empty = document.createElement('div');
      empty.className = 'empty';
      empty.textContent =
        'ჯერ არ გაქვს შენახული Poll.';
      savedList.appendChild(empty);
      return;
    }

    savedPolls.forEach(poll => {
      const entry = document.createElement('div');
      entry.className = 'prepared-entry';

      const main = document.createElement('div');
      main.className = 'prepared-entry-main';

      const title = document.createElement('p');
      title.textContent = poll.question_text;

      const subtitle = document.createElement('small');
      subtitle.textContent =
        (poll.options?.length || 0) +
        ' ვარიანტი · ' +
        (poll.last_published_at
          ? 'უკვე გამოყენებულია'
          : 'მზადაა გამოსაქვეყნებლად');

      main.append(title, subtitle);

      const actions = document.createElement('div');
      actions.className = 'prepared-entry-actions';

      function actionButton(label, className, handler) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = label;
        button.addEventListener('click', handler);
        return button;
      }

      actions.append(
        actionButton(
          '✎ შეცვლა',
          'mini',
          () => loadIntoEditor(poll)
        ),
        actionButton(
          'გაშვება ↗',
          'mini ok',
          () => publishSaved(poll)
        ),
        actionButton(
          'წაშლა',
          'mini no',
          () => deleteSaved(poll)
        )
      );

      entry.append(main, actions);
      savedList.appendChild(entry);
    });
  }

  async function publishSaved(poll) {
    if (busy) return;

    const confirmed = await confirmAction(
      'Poll-ის გამოქვეყნება',
      'გამოვაქვეყნოთ „' +
      poll.question_text +
      '“? პროექტორი ავტომატურად QR რეჟიმზე გადავა.'
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const result = await api(
        '/api/admin/polls/' +
        encodeURIComponent(poll.id) +
        '/publish',
        'POST',
        {}
      );

      if (result.ok !== true) {
        throw Error('გამოქვეყნება ვერ დადასტურდა');
      }

      toast('Poll გამოქვეყნდა · QR ჩართულია');
      await loadSaved();
      await refresh();

    } catch (error) {
      note(error.message, true);
      toast(error.message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSaved(poll) {
    if (busy) return;

    const confirmed = await confirmAction(
      'შენახული Poll-ის წაშლა',
      'წავშალოთ „' +
      poll.question_text +
      '“? უკვე გამოქვეყნებული შედეგები შენარჩუნდება.'
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      await api(
        '/api/admin/polls/' +
        encodeURIComponent(poll.id),
        'DELETE'
      );

      if (editingId === poll.id) resetForm();

      toast('შენახული Poll წაიშალა');
      await loadSaved();

    } catch (error) {
      note(error.message, true);
    } finally {
      setBusy(false);
    }
  }

  // Existing HTML initially contains 3 sample rows.
  // Replace their color selectors with the full palette.
  refreshColorSelectors();

  // Fix the initial sample color selections.
  const initialRows = rows();

  ['yellow', 'green', 'lightblue'].forEach(
    (key, index) => {
      const row = initialRows[index];
      if (!row) return;

      const selector = row.querySelector(
        '.poll-option-color'
      );
      selector.value = key;
    }
  );

  // Use the same handlers on initial rows.
  initialRows.forEach(row => {
    const input = row.querySelector('.poll-option-text');
    const color = row.querySelector('.poll-option-color');
    const replacement = makeRow(input.value, color.value);
    row.replaceWith(replacement);
  });

  refreshColorSelectors();

  question.addEventListener('input', () => {
    get('pollQuestionCount').textContent =
      question.value.length + ' / 200';
  });

  addButton.addEventListener('click', () => {
    if (rows().length >= MAX_OPTIONS) {
      limitError.style.display = 'block';
      note(
        'მაქსიმუმ 12 პასუხის ვარიანტის დამატება შეიძლება.',
        true
      );
      return;
    }

    const next = availableColor();

    if (!next) {
      limitError.style.display = 'block';
      return;
    }

    editor.appendChild(makeRow('', next.key));
    updateCounter();
    limitError.style.display = 'none';
  });

  resetButton.addEventListener('click', resetForm);

  saveButton.addEventListener('click', async () => {
    if (busy) return;

    let payload;

    try {
      payload = validate();
    } catch (error) {
      note(error.message, true);
      return;
    }

    setBusy(true);

    try {
      if (editingId) {
        await api(
          '/api/admin/polls/' +
          encodeURIComponent(editingId),
          'PATCH',
          payload
        );
        toast('Poll-ის ცვლილებები შენახულია');
      } else {
        await api(
          '/api/admin/polls',
          'POST',
          payload
        );
        toast('Poll წინასწარ შენახულია');
      }

      resetForm();
      await loadSaved();

    } catch (error) {
      note(error.message, true);
      toast(error.message);
    } finally {
      setBusy(false);
    }
  });

  publishButton.addEventListener('click', async () => {
    if (busy) return;

    let payload;

    try {
      payload = validate();
    } catch (error) {
      note(error.message, true);
      return;
    }

    const confirmed = await confirmAction(
      'Poll-ის პირდაპირ გამოქვეყნება',
      'ახალი Poll გამოჩნდება სტუდენტებთან ' +
      'და პროექტორი ავტომატურად QR რეჟიმზე გადავა. ' +
      'გავაგრძელოთ?'
    );

    if (!confirmed) return;

    setBusy(true);

    try {
      const result = await api(
        '/api/admin/polls/publish-now',
        'POST',
        payload
      );

      if (result.ok !== true) {
        throw Error('გამოქვეყნება ვერ დადასტურდა');
      }

      toast('Poll გამოქვეყნდა · QR ჩართულია');
      resetForm();
      await refresh();

    } catch (error) {
      note(error.message, true);
      toast(error.message);
    } finally {
      setBusy(false);
    }
  });

  loadSaved();

})();
  
/* END LIVE POLL EDITOR */

})();
