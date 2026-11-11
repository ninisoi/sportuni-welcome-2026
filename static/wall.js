
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const slots = [...document.querySelectorAll('.answer')];
  const count = $('counter');
  const progress = $('progress');

  let qid = null;
  let answers = [];
  let shown = new Set();
  let active = [];

  let screenMode = 'qr';
  let animationEnabled = true;
  let durationMs = 8000;

  let clock = 0;
  let previousFrame = null;
  let nextAt = 0;
  let previousSlot = -1;
  let polling = false;

  function storageKey(id) {
    return 'sportuni_wall_shown_' + id;
  }

  function restoreShown(id) {
    if (!id) return new Set();

    try {
      const saved = JSON.parse(
        sessionStorage.getItem(storageKey(id)) || '[]'
      );

      return new Set(
        Array.isArray(saved) ? saved.map(String) : []
      );
    } catch {
      return new Set();
    }
  }

  function saveShown() {
    if (!qid) return;

    try {
      sessionStorage.setItem(
        storageKey(qid),
        JSON.stringify([...shown])
      );
    } catch (error) {
      console.warn('Saving display history failed', error);
    }
  }

  function clearBubbles() {
    active = [];

    slots.forEach(slot => {
      slot.classList.remove(
        'visible',
        'long',
        'very-long'
      );
      slot.querySelector('p').textContent = '';
    });

    stage.classList.add('initial');

    if (progress) {
      progress.style.width = '0%';
    }
  }

  function resetQuestion(id) {
    qid = id;
    shown = restoreShown(id);
    answers = [];
    nextAt = clock;
    previousSlot = -1;
    clearBubbles();
  }

  function randomItem(items) {
    return items[
      Math.floor(Math.random() * items.length)
    ];
  }

  function chooseRandomSlot() {
    const busy = new Set(
      active.map(entry => entry.slot)
    );

    const free = slots
      .map((slot, index) => ({slot, index}))
      .filter(item => !busy.has(item.slot));

    if (!free.length) return null;

    let choices = free.filter(item =>
      Math.abs(item.index - previousSlot) > 1
    );

    if (!choices.length) {
      choices = free.filter(item =>
        item.index !== previousSlot
      );
    }

    if (!choices.length) choices = free;

    const selected = randomItem(choices);
    previousSlot = selected.index;

    return selected.slot;
  }

  function nextUnshownAnswer() {
    return answers.find(answer =>
      answer.id != null &&
      !shown.has(String(answer.id))
    );
  }

  function showNextAnswer() {
    // NEVER show answers while QR mode is active.
    if (screenMode !== 'wall') return false;

    if (!animationEnabled) return false;

    const answer = nextUnshownAnswer();
    if (!answer) return false;

    const slot = chooseRandomSlot();
    if (!slot) return false;

    const text = String(answer.text ?? '');

    slot.classList.remove(
      'visible',
      'long',
      'very-long'
    );

    slot.querySelector('p').textContent = text;

    slot.classList.toggle(
      'long',
      text.length > 28
    );

    slot.classList.toggle(
      'very-long',
      text.length > 44
    );

    void slot.offsetWidth;

    slot.classList.add('visible');
    stage.classList.remove('initial');

    // Mark as shown ONLY after Live Wall displays it.
    shown.add(String(answer.id));
    saveShown();

    active.push({
      slot,
      startedAt: clock
    });

    return true;
  }

  async function poll() {
    if (polling) return;
    polling = true;

    try {
      const statusResponse = await fetch(
        '/api/public',
        {cache: 'no-store'}
      );

      if (!statusResponse.ok) {
        throw new Error('Status unavailable');
      }

      const status = await statusResponse.json();

      const seconds = Number(
        status.answer_duration_seconds
      );

      if (Number.isFinite(seconds)) {
        durationMs =
          Math.max(3, Math.min(60, seconds)) * 1000;
      }

      const newQuestionId = status.question?.id ?? null;

      if (qid !== newQuestionId) {
        resetQuestion(newQuestionId);

        $('questionText').textContent =
          status.question?.text || '';
      }

      const previousMode = screenMode;

      // This value comes from the main admin's
      // QR / Live Wall setting in Supabase.
      screenMode = status.screen === 'wall'
        ? 'wall'
        : 'qr';

      animationEnabled = status.animation === true;

      if (screenMode !== 'wall') {
        // QR mode: do not consume waiting answers.
        // Answers already shown remain in history.
        if (previousMode === 'wall') {
          clearBubbles();
        }
      }

      if (
        previousMode !== 'wall' &&
        screenMode === 'wall'
      ) {
        // Begin displaying queued answers only now.
        nextAt = clock;
      }

      const answersResponse = await fetch(
        '/api/screen/answers',
        {cache: 'no-store'}
      );

      if (!answersResponse.ok) {
        throw new Error('Answers unavailable');
      }

      const data = await answersResponse.json();

      // Discard results if the question changed
      // while this request was running.
      if (qid !== newQuestionId) return;

      answers = Array.isArray(data.answers)
        ? data.answers
        : [];

      count.textContent =
        `${answers.length} დამტკიცებული პასუხი`;

    } catch (error) {
      console.warn('Live Wall update failed', error);
    } finally {
      polling = false;
    }
  }

  function frame(now) {
    if (previousFrame === null) {
      previousFrame = now;
    }

    const delta = Math.max(
      0,
      Math.min(now - previousFrame, 1000)
    );

    previousFrame = now;

    // Time moves ONLY during active Live Wall.
    const canPlay =
      screenMode === 'wall' &&
      animationEnabled;

    if (canPlay) {
      clock += delta;

      // Fade out after the configured duration.
      active = active.filter(entry => {
        if (clock - entry.startedAt >= durationMs) {
          entry.slot.classList.remove('visible');
          return false;
        }

        return true;
      });

      if (
        nextUnshownAnswer() &&
        clock >= nextAt
      ) {
        const displayed = showNextAnswer();

        if (displayed) {
          // Stagger answers naturally.
          const averageGap =
            durationMs / Math.max(2, slots.length);

          const randomFactor =
            0.8 + Math.random() * 0.4;

          nextAt = clock +
            Math.max(250, averageGap * randomFactor);
        } else {
          nextAt = clock + 200;
        }
      }
    }

    if (progress) {
      const first = active[0];

      progress.style.width = first
        ? Math.min(
            100,
            Math.max(
              0,
              (clock - first.startedAt) /
              durationMs * 100
            )
          ) + '%'
        : '0%';
    }

    requestAnimationFrame(frame);
  }

  resetQuestion(null);

  // Before the first status response, QR mode
  // is assumed, so no answer can be consumed.
  poll();
  setInterval(poll, 1800);

  requestAnimationFrame(frame);
})();
