
(() => {
  'use strict';

  const $ = id => document.getElementById(id);

  const stage = $('stage');
  const slots = [...document.querySelectorAll('.answer')];
  const count = $('counter');
  const progress = $('progress');

  let qid = null;
  let answers = [];

  // Each answer ID is displayed only once per question.
  let shown = new Set();

  let active = [];
  let paused = false;
  let durationMs = 8000;

  let clock = 0;
  let previousFrame = null;
  let nextAt = 0;
  let previousSlot = -1;

  function storageKey(id) {
    return 'sportuni_wall_shown_' + id;
  }

  function saveShown() {
    if (!qid) return;

    try {
      sessionStorage.setItem(
        storageKey(qid),
        JSON.stringify([...shown])
      );
    } catch (error) {
      console.warn('Could not save wall history', error);
    }
  }

  function restoreShown(id) {
    try {
      const saved = JSON.parse(
        sessionStorage.getItem(storageKey(id)) || '[]'
      );

      return new Set(
        Array.isArray(saved) ? saved.map(String) : []
      );
    } catch (error) {
      return new Set();
    }
  }

  function reset(newQuestionId) {
    qid = newQuestionId;

    // Restore answers already displayed in this tab.
    shown = qid ? restoreShown(qid) : new Set();

    active = [];
    nextAt = clock;
    previousSlot = -1;

    stage.classList.add('initial');

    slots.forEach(slot => {
      slot.classList.remove(
        'visible',
        'long',
        'very-long'
      );

      slot.querySelector('p').textContent = '';
    });

    if (progress) {
      progress.style.width = '0%';
    }
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
      .map((slot, index) => ({ slot, index }))
      .filter(item => !busy.has(item.slot));

    if (!free.length) return null;

    // Avoid the last position and neighboring slots
    // whenever other free positions are available.
    let choices = free.filter(item =>
      Math.abs(item.index - previousSlot) > 1
    );

    if (!choices.length) {
      choices = free.filter(item =>
        item.index !== previousSlot
      );
    }

    if (!choices.length) choices = free;

    const chosen = randomItem(choices);
    previousSlot = chosen.index;

    return chosen.slot;
  }

  function nextUnshownAnswer() {
    return answers.find(answer =>
      answer.id != null &&
      !shown.has(String(answer.id))
    );
  }

  function showNextAnswer() {
    const item = nextUnshownAnswer();

    if (!item) return false;

    const slot = chooseRandomSlot();

    if (!slot) return false;

    const text = String(item.text ?? '');

    // Mark the answer as shown BEFORE animating.
    // It must never enter the display queue again.
    shown.add(String(item.id));
    saveShown();

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

    // Restart the fade-in transition.
    void slot.offsetWidth;

    slot.classList.add('visible');

    stage.classList.remove('initial');

    active.push({
      slot,
      startedAt: clock
    });

    return true;
  }

  async function poll() {
    try {
      const statusResponse = await fetch(
        '/api/public',
        { cache: 'no-store' }
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

      if (qid !== status.question.id) {
        reset(status.question.id);

        $('questionText').textContent =
          status.question.text;
      }

      paused = !status.animation;

      // Fetch answers for the current question.
      const answersResponse = await fetch(
        '/api/screen/answers',
        { cache: 'no-store' }
      );

      if (!answersResponse.ok) {
        throw new Error('Answers unavailable');
      }

      const data = await answersResponse.json();

      // If the question changed during the request,
      // discard this outdated response.
      if (qid !== status.question.id) return;

      answers = Array.isArray(data.answers)
        ? data.answers
        : [];

      count.textContent =
        `${answers.length} დამტკიცებული პასუხი`;

    } catch (error) {
      console.warn('Live Wall update failed', error);
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

    if (!paused) {
      clock += delta;

      // Fade out answers after their saved duration.
      active = active.filter(entry => {
        if (
          clock - entry.startedAt >= durationMs
        ) {
          entry.slot.classList.remove('visible');
          return false;
        }

        return true;
      });

      const hasNewAnswers = Boolean(
        nextUnshownAnswer()
      );

      if (hasNewAnswers && clock >= nextAt) {
        const didShow = showNextAnswer();

        if (didShow) {
          const gap =
            durationMs / Math.max(2, slots.length);

          // Randomize the timing slightly.
          const randomFactor =
            0.8 + Math.random() * 0.4;

          nextAt =
            clock + Math.max(250, gap * randomFactor);
        } else {
          // Wait for a free position.
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
              (clock - first.startedAt)
                / durationMs * 100
            )
          ) + '%'
        : '0%';
    }

    requestAnimationFrame(frame);
  }

  reset(null);
  poll();

  // Check for newly approved answers.
  setInterval(poll, 1800);

  requestAnimationFrame(frame);
})();
