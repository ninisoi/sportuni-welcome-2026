
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const stage = $('stage');
  const slots = [...document.querySelectorAll('.answer')];
  const count = $('counter');
  const progress = $('progress');

  let qid = null;
  let answers = [];
  let answerIndex = 0;
  let paused = false;
  let durationMs = 8000;
  let active = [];
  let clock = 0;
  let previousFrame = null;
  let nextAt = 0;
  let previousSlot = -1;

  function reset() {
    answerIndex = 0;
    active = [];
    nextAt = clock;
    previousSlot = -1;

    stage.classList.add('initial');

    slots.forEach(slot => {
      slot.classList.remove(
        'visible', 'long', 'very-long'
      );
      slot.querySelector('p').textContent = '';
    });
  }

  function randomItem(items) {
    return items[Math.floor(Math.random() * items.length)];
  }

  function chooseRandomSlot() {
    const busy = new Set(active.map(x => x.slot));

    const free = slots
      .map((slot, index) => ({ slot, index }))
      .filter(item => !busy.has(item.slot));

    if (!free.length) return null;

    // Prefer positions away from the previous slot.
    let candidates = free.filter(item =>
      Math.abs(item.index - previousSlot) > 1
    );

    if (!candidates.length) {
      candidates = free.filter(item =>
        item.index !== previousSlot
      );
    }

    if (!candidates.length) candidates = free;

    const chosen = randomItem(candidates);
    previousSlot = chosen.index;

    return chosen.slot;
  }

  function showAnswer() {
    if (!answers.length) return false;

    const slot = chooseRandomSlot();
    if (!slot) return false;

    const item = answers[answerIndex % answers.length];
    answerIndex++;

    const text = String(item.text ?? '');

    slot.classList.remove(
      'visible', 'long', 'very-long'
    );

    slot.querySelector('p').textContent = text;

    slot.classList.toggle('long', text.length > 28);
    slot.classList.toggle('very-long', text.length > 44);

    // Restart the existing fade-in animation.
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
      const [r, a] = await Promise.all([
        fetch('/api/public', { cache: 'no-store' }),
        fetch('/api/screen/answers', { cache: 'no-store' })
      ]);

      if (!r.ok || !a.ok) return;

      const status = await r.json();
      const data = await a.json();

      const seconds = Number(
        status.answer_duration_seconds
      );

      if (Number.isFinite(seconds)) {
        durationMs =
          Math.max(3, Math.min(60, seconds)) * 1000;
      }

      if (qid !== status.question.id) {
        qid = status.question.id;
        reset();

        $('questionText').textContent =
          status.question.text;
      }

      paused = !status.animation;

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
    if (previousFrame === null) previousFrame = now;

    const delta = Math.max(
      0,
      Math.min(now - previousFrame, 1000)
    );

    previousFrame = now;

    if (!paused) {
      // Logical time stops while animation is paused.
      clock += delta;

      // Hide answers after their saved duration.
      active = active.filter(entry => {
        if (clock - entry.startedAt >= durationMs) {
          entry.slot.classList.remove('visible');
          return false;
        }
        return true;
      });

      if (answers.length && clock >= nextAt) {
        const shown = showAnswer();

        const averageGap =
          durationMs / Math.max(2, slots.length);

        // A slightly different gap each time
        // creates a more natural appearance rhythm.
        const randomFactor = 0.75 + Math.random() * 0.5;

        nextAt = clock + (
          shown
            ? averageGap * randomFactor
            : 200
        );
      }
    }

    if (progress) {
      const oldest = active[0];

      progress.style.width = oldest
        ? Math.min(
            100,
            Math.max(
              0,
              (clock - oldest.startedAt) /
              durationMs * 100
            )
          ) + '%'
        : '0%';
    }

    requestAnimationFrame(frame);
  }

  reset();
  poll();

  setInterval(poll, 1800);
  requestAnimationFrame(frame);
})();
