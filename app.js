(() => {
  "use strict";

  /* ---------- Storage ---------- */

  const STORE_TASKS = "board.tasks";
  const STORE_IDEAS = "board.ideas";

  const load = (key) => {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      console.error("Storage read failed", key, e);
      return [];
    }
  };

  const save = (key, value) => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      console.error("Storage write failed", key, e);
      alert("Couldn't save — your device storage may be full.");
    }
  };

  let tasks = load(STORE_TASKS);
  let ideas = load(STORE_IDEAS);

  const persistTasks = () => save(STORE_TASKS, tasks);
  const persistIdeas = () => save(STORE_IDEAS, ideas);

  /* ---------- Utilities ---------- */

  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  const startOfDay = (d) => { const c = new Date(d); c.setHours(0, 0, 0, 0); return c; };
  const endOfDay = (d) => { const c = new Date(d); c.setHours(23, 59, 59, 999); return c; };
  const addDays = (d, n) => { const c = new Date(d); c.setDate(c.getDate() + n); return c; };
  const daysBetween = (a, b) => Math.floor((startOfDay(b) - startOfDay(a)) / 86400000);

  const DOW = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];

  function dateHeadingFor(date) {
    const today = startOfDay(new Date());
    const diff = daysBetween(today, date);
    if (diff === 0) return "Today";
    if (diff === 1) return "Tomorrow";
    if (diff === -1) return "Yesterday";
    return `${DOW[date.getDay()]}, ${MONTHS[date.getMonth()].slice(0,3)} ${date.getDate()}`;
  }

  function formatTime(date) {
    let h = date.getHours();
    const m = date.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    h = h % 12; if (h === 0) h = 12;
    return `${h}:${String(m).padStart(2, "0")} ${ampm}`;
  }

  // Deterministic color per label so the same label always reads the same way.
  function labelHue(label) {
    let hash = 0;
    for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
    return hash % 360;
  }

  function labelPill(label) {
    const hue = labelHue(label);
    return `<span class="pill"><span class="pill-dot" style="background:hsl(${hue},55%,60%)"></span>${escapeHtml(label)}</span>`;
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function parseLabels(str) {
    return str.split(",").map(s => s.trim()).filter(Boolean);
  }

  // Builds a Google Calendar "quick add" link. Unlike the Clock app's SET_ALARM
  // intent, this is a plain https:// URL, so Chrome doesn't block it the way
  // it blocks browser-triggered intent:// links to non-browsable activities.
  // Opens the Calendar app directly if installed; the saved event's reminder
  // then fires locally, offline, same as a native alarm would.
  function calendarUrl(task) {
    if (!task.datetime) return null;
    const start = new Date(task.datetime);
    const end = new Date(start.getTime() + 30 * 60000);
    const fmt = (d) => d.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const params = new URLSearchParams({
      action: "TEMPLATE",
      text: task.title,
      dates: `${fmt(start)}/${fmt(end)}`,
      details: task.description || "",
    });
    return `https://calendar.google.com/calendar/render?${params.toString()}`;
  }

  /* ---------- State ---------- */

  const state = {
    tab: "queue",
    queueView: "list",
    doneView: "list",
    rangeDays: 7,
    summaryRangeDays: 7,
    calMonth: startOfDay(new Date()),
    calSelected: null,
    entryType: "task",
    editingTaskId: null,
    editingIdeaId: null,
  };

  /* ---------- Rendering: Queue (list) ---------- */

  function cardActionsForTask(task) {
    const calUrl = calendarUrl(task);
    const calBtn = calUrl
      ? `<a class="icon-btn alarm" href="${calUrl}" target="_blank" rel="noopener" aria-label="Add to Calendar" title="Add to Calendar">&#128197;</a>`
      : "";
    const moveBtn = task.status === "queue"
      ? `<button class="icon-btn move-done" data-action="complete" data-id="${task.id}" aria-label="Mark done" title="Mark done">&#10003;</button>`
      : `<button class="icon-btn move-queue" data-action="reopen" data-id="${task.id}" aria-label="Move back to queue" title="Reopen">&#8617;</button>`;
    return `
      <div class="card-actions">
        ${moveBtn}
        ${calBtn}
        <button class="icon-btn" data-action="edit-task" data-id="${task.id}" aria-label="Edit" title="Edit">&#8942;</button>
      </div>`;
  }

  function taskCardHtml(task) {
    const d = task.datetime ? new Date(task.datetime) : null;
    const overdue = d && task.status === "queue" && d < new Date();
    const timeHtml = d
      ? `<div class="card-time ${overdue ? "overdue" : ""}">${dateHeadingFor(d)} · ${formatTime(d)}</div>`
      : "";
    const descHtml = task.description ? `<div class="card-desc">${escapeHtml(task.description)}</div>` : "";
    const labelsHtml = task.labels.length
      ? `<div class="card-labels">${task.labels.map(labelPill).join("")}</div>` : "";
    return `
      <div class="card" data-id="${task.id}">
        <div class="card-body">
          <div class="card-title ${task.status === "done" ? "done" : ""}">${escapeHtml(task.title)}</div>
          ${timeHtml}
          ${descHtml}
          ${labelsHtml}
        </div>
        ${cardActionsForTask(task)}
      </div>`;
  }

  function renderQueueList() {
    const el = document.getElementById("view-queue-list");
    const now = new Date();
    const today = startOfDay(now);
    const rangeEnd = state.rangeDays >= 9999 ? null : endOfDay(addDays(today, state.rangeDays));

    const queueTasks = tasks.filter(t => t.status === "queue");
    const noDate = queueTasks.filter(t => !t.datetime);
    const dated = queueTasks
      .filter(t => t.datetime && (!rangeEnd || new Date(t.datetime) <= rangeEnd))
      .sort((a, b) => new Date(a.datetime) - new Date(b.datetime));

    if (!noDate.length && !dated.length) {
      el.innerHTML = `<div class="empty-state">Nothing in range. Tap + to add a task, or widen the range above.</div>`;
      return;
    }

    let html = "";

    if (noDate.length) {
      html += `<div class="date-heading">No date</div>`;
      html += noDate.map(taskCardHtml).join("");
    }

    const overdue = dated.filter(t => new Date(t.datetime) < now);
    const upcoming = dated.filter(t => new Date(t.datetime) >= now);

    if (overdue.length) {
      html += `<div class="date-heading overdue">Overdue</div>`;
      html += overdue.map(taskCardHtml).join("");
    }

    let lastHeading = null;
    upcoming.forEach(t => {
      const heading = dateHeadingFor(new Date(t.datetime));
      if (heading !== lastHeading) {
        html += `<div class="date-heading">${heading}</div>`;
        lastHeading = heading;
      }
      html += taskCardHtml(t);
    });

    el.innerHTML = html;
  }

  /* ---------- Rendering: Queue (calendar) ---------- */

  function renderQueueCalendar() {
    const label = document.getElementById("cal-month-label");
    const grid = document.getElementById("cal-grid");
    const dayTasksEl = document.getElementById("cal-day-tasks");

    const month = state.calMonth;
    label.textContent = `${MONTHS[month.getMonth()]} ${month.getFullYear()}`;

    const firstOfMonth = new Date(month.getFullYear(), month.getMonth(), 1);
    const startWeekday = firstOfMonth.getDay();
    const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    const today = startOfDay(new Date());

    const queueTasks = tasks.filter(t => t.status === "queue" && t.datetime);
    const tasksByDay = {};
    queueTasks.forEach(t => {
      const d = startOfDay(new Date(t.datetime));
      if (d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear()) {
        const key = d.getDate();
        (tasksByDay[key] = tasksByDay[key] || []).push(t);
      }
    });

    let html = DOW.map(d => `<div class="cal-dow">${d}</div>`).join("");
    for (let i = 0; i < startWeekday; i++) html += `<div class="cal-day empty"></div>`;

    for (let day = 1; day <= daysInMonth; day++) {
      const cellDate = new Date(month.getFullYear(), month.getMonth(), day);
      const isToday = daysBetween(today, cellDate) === 0;
      const isSelected = state.calSelected && daysBetween(state.calSelected, cellDate) === 0;
      const hasTasks = !!tasksByDay[day];
      html += `<button class="cal-day ${isToday ? "today" : ""} ${isSelected ? "selected" : ""}" data-day="${day}">
        ${day}${hasTasks ? '<div class="cal-dot"></div>' : ""}
      </button>`;
    }
    grid.innerHTML = html;

    if (state.calSelected) {
      const key = state.calSelected.getDate();
      const inMonth = state.calSelected.getMonth() === month.getMonth() && state.calSelected.getFullYear() === month.getFullYear();
      const dayTasks = inMonth ? (tasksByDay[key] || []) : [];
      dayTasksEl.innerHTML = dayTasks.length
        ? `<div class="date-heading">${dateHeadingFor(state.calSelected)}</div>` + dayTasks.map(taskCardHtml).join("")
        : `<div class="empty-state">No tasks that day.</div>`;
    } else {
      dayTasksEl.innerHTML = "";
    }
  }

  /* ---------- Rendering: Done (list) ---------- */

  function renderDoneList() {
    const el = document.getElementById("view-done-list");
    const done = tasks.filter(t => t.status === "done").sort((a, b) => new Date(b.doneAt) - new Date(a.doneAt));

    if (!done.length) {
      el.innerHTML = `<div class="empty-state">Nothing done yet. Once you complete tasks, they'll land here.</div>`;
      return;
    }

    let html = "";
    let lastHeading = null;
    done.forEach(t => {
      const heading = dateHeadingFor(new Date(t.doneAt));
      if (heading !== lastHeading) {
        html += `<div class="date-heading">${heading}</div>`;
        lastHeading = heading;
      }
      html += taskCardHtml(t);
    });
    el.innerHTML = html;
  }

  /* ---------- Rendering: Done (summary) ---------- */

  function renderDoneSummary() {
    const el = document.getElementById("view-done-summary");
    const since = startOfDay(addDays(new Date(), -state.summaryRangeDays));
    const done = tasks.filter(t => t.status === "done" && new Date(t.doneAt) >= since);

    if (!done.length) {
      el.innerHTML = `<div class="empty-state">No completed tasks in this period yet.</div>`;
      return;
    }

    const counts = {};
    done.forEach(t => {
      const labels = t.labels.length ? t.labels : ["unlabeled"];
      labels.forEach(l => { counts[l] = (counts[l] || 0) + 1; });
    });

    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const max = rows[0][1];

    let html = `<div class="summary-total"><strong>${done.length}</strong> task${done.length === 1 ? "" : "s"} done</div>`;
    rows.forEach(([label, count]) => {
      const pct = Math.round((count / max) * 100);
      const hue = label === "unlabeled" ? null : labelHue(label);
      const dot = hue !== null ? `<span class="pill-dot" style="background:hsl(${hue},55%,60%)"></span>` : "";
      html += `
        <div class="summary-row">
          <div class="summary-row-top">
            <span class="summary-label">${dot}${escapeHtml(label)}</span>
            <span class="summary-count">${count}</span>
          </div>
          <div class="summary-bar-track">
            <div class="summary-bar-fill" style="width:${pct}%; background:${hue !== null ? `hsl(${hue},55%,55%)` : "var(--text-faint)"}"></div>
          </div>
        </div>`;
    });

    el.innerHTML = html;
  }

  /* ---------- Rendering: Ideas ---------- */

  function ideaCardHtml(idea) {
    const age = daysBetween(new Date(idea.createdAt), new Date());
    const pct = Math.min(age / 30, 1) * 100;
    const fuseClass = age >= 30 ? "warm" : age >= 15 ? "mid" : "";
    const descHtml = idea.description ? `<div class="card-desc">${escapeHtml(idea.description)}</div>` : "";
    const flagHtml = age >= 30
      ? `<div class="idea-flag"><span class="idea-flag-text">Sitting for ${age} days — worth deciding on a deadline?</span></div>`
      : "";

    return `
      <div class="card idea-card" data-id="${idea.id}">
        <div class="idea-top">
          <div class="card-title">${escapeHtml(idea.title)}</div>
          <div class="idea-age">${age}d</div>
        </div>
        ${descHtml}
        <div class="fuse"><div class="fuse-fill ${fuseClass}" style="width:${pct}%"></div></div>
        ${flagHtml}
        <div class="idea-actions">
          <button class="btn btn-ghost btn-small" data-action="convert-idea" data-id="${idea.id}">Give it a deadline</button>
          <button class="btn btn-ghost btn-small" data-action="delete-idea" data-id="${idea.id}">Delete</button>
        </div>
      </div>`;
  }

  function renderIdeas() {
    const el = document.getElementById("view-ideas");
    if (!ideas.length) {
      el.innerHTML = `<div class="empty-state">No ideas parked here. Use + &rarr; Idea for things you're not ready to schedule yet.</div>`;
      return;
    }
    const sorted = [...ideas].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    el.innerHTML = sorted.map(ideaCardHtml).join("");
  }

  /* ---------- Master render ---------- */

  function renderAll() {
    renderQueueList();
    renderQueueCalendar();
    renderDoneList();
    renderDoneSummary();
    renderIdeas();
  }

  /* ---------- View switching ---------- */

  function showTab(tab) {
    state.tab = tab;
    document.querySelectorAll(".tab").forEach(b => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
    document.getElementById("queue-subbar").hidden = tab !== "queue";
    document.getElementById("done-subbar").hidden = tab !== "done";

    document.getElementById("view-queue-list").hidden = !(tab === "queue" && state.queueView === "list");
    document.getElementById("view-queue-calendar").hidden = !(tab === "queue" && state.queueView === "calendar");
    document.getElementById("view-done-list").hidden = !(tab === "done" && state.doneView === "list");
    document.getElementById("view-done-summary").hidden = !(tab === "done" && state.doneView === "summary");
    document.getElementById("view-ideas").hidden = tab !== "ideas";
  }

  function showQueueView(view) {
    state.queueView = view;
    document.querySelectorAll("#queue-view-toggle .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    showTab("queue");
  }

  function showDoneView(view) {
    state.doneView = view;
    document.querySelectorAll("#done-view-toggle .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.view === view));
    document.getElementById("summary-range-select").hidden = view !== "summary";
    showTab("done");
  }

  /* ---------- Modal ---------- */

  const backdrop = document.getElementById("modal-backdrop");
  const form = document.getElementById("entry-form");

  function openModal(type, prefill) {
    state.entryType = type;
    state.editingTaskId = null;
    state.editingIdeaId = null;

    document.querySelectorAll("#entry-type-toggle .seg-btn").forEach(b => b.classList.toggle("active", b.dataset.type === type));
    document.getElementById("f-datetime-field").hidden = type === "idea";
    document.getElementById("f-labels-field").hidden = type === "idea";

    document.getElementById("f-title").value = prefill?.title || "";
    document.getElementById("f-description").value = prefill?.description || "";
    document.getElementById("f-date").value = prefill?.date || "";
    document.getElementById("f-time").value = prefill?.time || "";
    document.getElementById("f-labels").value = prefill?.labels ? prefill.labels.join(", ") : "";
    document.querySelectorAll("#quick-dates .chip").forEach(c => c.classList.remove("active"));

    backdrop.hidden = false;
    document.getElementById("f-title").focus();
  }

  function closeModal() {
    backdrop.hidden = true;
    form.reset();
  }

  function openEditTask(id) {
    const t = tasks.find(t => t.id === id);
    if (!t) return;
    const d = t.datetime ? new Date(t.datetime) : null;
    openModal("task", {
      title: t.title,
      description: t.description,
      date: d ? toDateInputValue(d) : "",
      time: d ? toTimeInputValue(d) : "",
      labels: t.labels,
    });
    state.editingTaskId = id;
  }

  function toDateInputValue(date) {
    const pad = n => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth()+1)}-${pad(date.getDate())}`;
  }

  function toTimeInputValue(date) {
    const pad = n => String(n).padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const title = document.getElementById("f-title").value.trim();
    if (!title) return;
    const description = document.getElementById("f-description").value.trim();

    if (state.entryType === "task") {
      const dateRaw = document.getElementById("f-date").value;
      const timeRaw = document.getElementById("f-time").value || "09:00";
      const datetime = dateRaw ? new Date(`${dateRaw}T${timeRaw}`).toISOString() : null;
      const labels = parseLabels(document.getElementById("f-labels").value);

      if (state.editingTaskId) {
        const t = tasks.find(t => t.id === state.editingTaskId);
        Object.assign(t, { title, description, datetime, labels });
      } else {
        tasks.push({
          id: uid(), title, description, datetime, labels,
          status: "queue", createdAt: new Date().toISOString(), doneAt: null,
        });
        // If this came from converting an idea, remove the idea now.
        if (state.editingIdeaId) {
          ideas = ideas.filter(i => i.id !== state.editingIdeaId);
          persistIdeas();
        }
      }
      persistTasks();
    } else {
      ideas.push({ id: uid(), title, description, createdAt: new Date().toISOString() });
      persistIdeas();
    }

    closeModal();
    renderAll();
  });

  document.getElementById("f-cancel").addEventListener("click", closeModal);
  document.getElementById("modal-close").addEventListener("click", closeModal);
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  document.getElementById("entry-type-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (!btn) return;
    openModal(btn.dataset.type);
  });

  document.getElementById("quick-dates").addEventListener("click", (e) => {
    const chip = e.target.closest(".chip");
    if (!chip) return;
    document.querySelectorAll("#quick-dates .chip").forEach(c => c.classList.remove("active"));
    chip.classList.add("active");

    const today = startOfDay(new Date());
    let target;
    switch (chip.dataset.quick) {
      case "today": target = today; break;
      case "tomorrow": target = addDays(today, 1); break;
      case "weekend": {
        // Next Saturday (today counts if it already is Saturday).
        const dow = today.getDay();
        const offset = (6 - dow + 7) % 7;
        target = addDays(today, offset);
        break;
      }
      case "nextweek": {
        // Next Monday.
        const dow = today.getDay();
        const offset = ((1 - dow + 7) % 7) || 7;
        target = addDays(today, offset);
        break;
      }
      default: target = today;
    }
    document.getElementById("f-date").value = toDateInputValue(target);
    if (!document.getElementById("f-time").value) {
      document.getElementById("f-time").value = "09:00";
    }
  });

  document.getElementById("fab").addEventListener("click", () => openModal("task"));

  /* ---------- Tab / toggle wiring ---------- */

  document.querySelectorAll(".tab").forEach(btn => {
    btn.addEventListener("click", () => showTab(btn.dataset.tab));
  });

  document.getElementById("queue-view-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (btn) showQueueView(btn.dataset.view);
  });

  document.getElementById("done-view-toggle").addEventListener("click", (e) => {
    const btn = e.target.closest(".seg-btn");
    if (btn) showDoneView(btn.dataset.view);
  });

  document.getElementById("range-select").addEventListener("change", (e) => {
    state.rangeDays = Number(e.target.value);
    renderQueueList();
  });

  document.getElementById("summary-range-select").addEventListener("change", (e) => {
    state.summaryRangeDays = Number(e.target.value);
    renderDoneSummary();
  });

  /* ---------- Calendar nav ---------- */

  document.getElementById("cal-prev").addEventListener("click", () => {
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() - 1, 1);
    renderQueueCalendar();
  });
  document.getElementById("cal-next").addEventListener("click", () => {
    state.calMonth = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth() + 1, 1);
    renderQueueCalendar();
  });
  document.getElementById("cal-grid").addEventListener("click", (e) => {
    const btn = e.target.closest(".cal-day[data-day]");
    if (!btn) return;
    state.calSelected = new Date(state.calMonth.getFullYear(), state.calMonth.getMonth(), Number(btn.dataset.day));
    renderQueueCalendar();
  });

  /* ---------- Card action delegation ---------- */

  document.getElementById("main-content").addEventListener("click", (e) => {
    const actionBtn = e.target.closest("[data-action]");
    if (!actionBtn) return;
    const { action, id } = actionBtn.dataset;

    if (action === "complete") {
      const t = tasks.find(t => t.id === id);
      if (t) { t.status = "done"; t.doneAt = new Date().toISOString(); persistTasks(); renderAll(); }
    } else if (action === "reopen") {
      const t = tasks.find(t => t.id === id);
      if (t) { t.status = "queue"; t.doneAt = null; persistTasks(); renderAll(); }
    } else if (action === "edit-task") {
      const t = tasks.find(t => t.id === id);
      if (!t) return;
      const choice = confirm(`Edit "${t.title}"?\n\nOK to edit, Cancel to delete instead.`);
      if (choice) {
        openEditTask(id);
      } else if (confirm("Delete this task? This can't be undone.")) {
        tasks = tasks.filter(t => t.id !== id);
        persistTasks();
        renderAll();
      }
    } else if (action === "convert-idea") {
      const idea = ideas.find(i => i.id === id);
      if (!idea) return;
      openModal("task", { title: idea.title, description: idea.description });
      state.editingIdeaId = id;
    } else if (action === "delete-idea") {
      if (confirm("Delete this idea?")) {
        ideas = ideas.filter(i => i.id !== id);
        persistIdeas();
        renderAll();
      }
    }
  });

  /* ---------- Service worker ---------- */

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("service-worker.js").catch(err => console.error("SW registration failed", err));
    });
  }

  /* ---------- Init ---------- */

  renderAll();
})();
