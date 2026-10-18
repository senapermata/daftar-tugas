// script.js
// Dashboard Tugas Kuliah - Pertemuan 2 (JavaScript Next Gen ES6+)

// ---------- Konstanta ----------
const STORAGE_KEY = "dashboard-tugas-sena-v1";

const API = {
  quote: "https://dummyjson.com/quotes/random",
  todos: "https://jsonplaceholder.typicode.com/todos?_limit=5"
};

// Prioritas dipetakan ke tingkat kelangkaan item
const RARITY = { rendah: "Biasa", sedang: "Langka", tinggi: "Epik" };
const MAX_HEARTS = 10;
const DEFAULT_JAM = "23:59";
const SATU_HARI = 86400000;
const SATU_JAM = 3600000;

// ---------- Fungsi bantu (arrow functions) ----------
const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

const toISODate = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const addDays = (n) => {
  const d = todayStart();
  d.setDate(d.getDate() + n);
  return toISODate(d);
};

// Nilai default deadline: n hari dari sekarang, jam 23:59 (format datetime-local)
const defaultDeadline = (n = 1) => `${addDays(n)}T${DEFAULT_JAM}`;

// Data lama yang hanya berisi tanggal (YYYY-MM-DD) dilengkapi jamnya
const normalizeDeadline = (value) =>
  value && value.length === 10 ? `${value}T${DEFAULT_JAM}` : value;

const formatTanggal = (iso) =>
  new Date(iso).toLocaleString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit"
  });

// Ubah selisih milidetik menjadi teks: menit, jam, atau hari
const formatDurasi = (ms) => {
  const menit = Math.floor(Math.abs(ms) / 60000);
  if (menit < 1) return "kurang dari 1 menit";
  if (menit < 60) return `${menit} menit`;
  const jam = Math.floor(menit / 60);
  if (jam < 24) return `${jam} jam`;
  return `${Math.floor(jam / 24)} hari`;
};

// Jumlah hati berdasarkan sisa waktu tugas terdekat
const heartsFor = (ms) => {
  const jam = ms / SATU_JAM;
  if (jam < 0) return 0;
  if (jam <= 1) return 1;
  if (jam <= 6) return 3;
  if (jam <= 24) return 6;
  if (jam <= 72) return 8;
  return MAX_HEARTS;
};

// Pesan untuk tugas terdekat: { teks, bahaya }
const pesanTerdekat = ({ title, msLeft }) => {
  const jam = msLeft / SATU_JAM;
  const durasi = formatDurasi(msLeft);
  if (jam < 0) return { teks: `Terlambat ${durasi}! Kerjakan "${title}" sekarang.`, bahaya: true };
  if (jam <= 1) return { teks: `Tinggal ${durasi}! "${title}" hampir habis waktunya.`, bahaya: true };
  if (jam <= 6) return { teks: `"${title}" ${durasi} lagi. Fokus kerjakan sekarang.`, bahaya: true };
  if (jam <= 24) return { teks: `"${title}" jatuh tempo ${durasi} lagi. Mulai kerjakan hari ini.`, bahaya: false };
  if (jam <= 72) return { teks: `Tugas terdekat: "${title}", ${durasi} lagi. Masih aman, mulai dicicil.`, bahaya: false };
  return { teks: `Tugas terdekat: "${title}", ${durasi} lagi. Santai dulu.`, bahaya: false };
};

// ---------- Class TaskItem: model data satu tugas ----------
class TaskItem {
  constructor({
    id = `t${Date.now()}${Math.floor(Math.random() * 1000)}`,
    title,
    course = "",
    deadline,
    priority = "sedang",
    done = false
  }) {
    this.id = id;
    this.title = title;
    this.course = course;
    this.deadline = normalizeDeadline(deadline);
    this.priority = priority;
    this.done = done;
  }

  // Sisa waktu dalam milidetik (negatif = sudah lewat)
  get msLeft() {
    return new Date(this.deadline) - Date.now();
  }

  get isOverdue() {
    return !this.done && this.msLeft < 0;
  }

  get dueLabel() {
    if (this.done) return "Selesai";
    const { msLeft } = this;
    return msLeft < 0
      ? `Terlambat ${formatDurasi(msLeft)}`
      : `${formatDurasi(msLeft)} lagi`;
  }

  // Immutable: mengembalikan TaskItem baru, objek lama tidak diubah
  update(changes) {
    return new TaskItem({ ...this, ...changes });
  }

  toggle() {
    return this.update({ done: !this.done });
  }
}

// ---------- Class DashboardApp: state, localStorage, fetch, render ----------
class DashboardApp {
  constructor() {
    this.tasks = this.load();
    this.filter = "semua";
    this.editingId = null;
    this.query = "";

    const $ = (id) => document.getElementById(id);
    this.el = {
      today: $("today"), quote: $("quote"), reminder: $("reminder"),
      stats: $("stats"), hearts: $("hearts"), heartsText: $("heartsText"), heartsMsg: $("heartsMsg"),
      progress: $("progress"), progressBar: $("progressBar"),
      progressText: $("progressText"), search: $("searchInput"),
      form: $("taskForm"), formTitle: $("formTitle"),
      submitBtn: $("submitBtn"), cancelBtn: $("cancelBtn"),
      list: $("taskList"), empty: $("emptyMsg"), filters: $("filters"),
      quoteBtn: $("quoteBtn"), sampleBtn: $("sampleBtn"), clearDoneBtn: $("clearDoneBtn")
    };

    this.startClock();
    this.el.form.elements.deadline.value = defaultDeadline();

    this.bindEvents();
    this.render();
    this.loadQuote();
  }

  // ----- Jam live + penyegaran sisa waktu tiap menit -----
  startClock() {
    const tick = () => {
      this.el.today.textContent = new Date().toLocaleString("id-ID", {
        weekday: "long", day: "numeric", month: "long", year: "numeric",
        hour: "2-digit", minute: "2-digit", second: "2-digit"
      });
    };
    tick();
    setInterval(tick, 1000);
    setInterval(() => this.render(), 60000);
  }

  // ----- localStorage -----
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw).map((data) => new TaskItem(data)) : [];
    } catch (err) {
      console.error("Gagal membaca localStorage:", err);
      return [];
    }
  }

  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.tasks));
    } catch (err) {
      console.error("Gagal menyimpan ke localStorage:", err);
    }
  }

  commit() {
    this.save();
    this.render();
  }

  // ----- CRUD (spread agar array tidak dimutasi) -----
  addTask(data) {
    this.tasks = [...this.tasks, new TaskItem(data)];
    this.commit();
  }

  updateTask(id, changes) {
    this.tasks = this.tasks.map((task) => (task.id === id ? task.update(changes) : task));
    this.commit();
  }

  toggleTask(id) {
    this.tasks = this.tasks.map((task) => (task.id === id ? task.toggle() : task));
    this.commit();
  }

  deleteTask(id) {
    this.tasks = this.tasks.filter((task) => task.id !== id);
    if (this.editingId === id) this.stopEdit();
    this.commit();
  }

  clearDone() {
    this.tasks = this.tasks.filter(({ done }) => !done);
    this.commit();
  }

  // ----- Event -----
  bindEvents() {
    this.el.form.addEventListener("submit", (e) => {
      e.preventDefault();
      const { title, course, deadline, priority } = Object.fromEntries(new FormData(this.el.form));
      const data = { title: title.trim(), course: course.trim(), deadline, priority };
      if (!data.title || !data.deadline) return;

      if (this.editingId) {
        this.updateTask(this.editingId, data);
        this.stopEdit();
      } else {
        this.addTask(data);
        this.el.form.reset();
        this.el.form.elements.deadline.value = defaultDeadline();
      }
    });

    // Klik di mana saja pada kolom deadline langsung membuka pemilih tanggal dan jam
    this.el.form.elements.deadline.addEventListener("click", (e) => {
      try {
        e.target.showPicker();
      } catch (err) {
        // Browser lama tanpa showPicker: pakai pemilih bawaan
      }
    });

    this.el.cancelBtn.addEventListener("click", () => this.stopEdit());

    this.el.list.addEventListener("click", (e) => {
      const target = e.target.closest("[data-action]");
      if (!target) return;
      const { id } = target.closest("[data-id]").dataset;
      const { action } = target.dataset;

      if (action === "toggle") this.toggleTask(id);
      if (action === "edit") this.startEdit(id);
      if (action === "delete" && confirm("Hapus tugas ini?")) this.deleteTask(id);
    });

    this.el.filters.addEventListener("click", (e) => {
      const chip = e.target.closest("[data-filter]");
      if (!chip) return;
      this.filter = chip.dataset.filter;
      this.render();
    });

    this.el.search.addEventListener("input", (e) => {
      this.query = e.target.value.trim().toLowerCase();
      this.render();
    });

    this.el.quoteBtn.addEventListener("click", () => this.loadQuote());
    this.el.sampleBtn.addEventListener("click", () => this.importSample());
    this.el.clearDoneBtn.addEventListener("click", () => this.clearDone());
  }

  startEdit(id) {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) return;
    this.editingId = id;
    const { title, course, deadline, priority } = this.el.form.elements;
    title.value = task.title;
    course.value = task.course;
    deadline.value = task.deadline;
    priority.value = task.priority;
    this.el.formTitle.textContent = "Edit Tugas";
    this.el.submitBtn.textContent = "Simpan perubahan";
    this.el.cancelBtn.hidden = false;
    this.el.form.scrollIntoView({ behavior: "smooth", block: "center" });
    title.focus();
  }

  stopEdit() {
    this.editingId = null;
    this.el.form.reset();
    this.el.form.elements.deadline.value = defaultDeadline();
    this.el.formTitle.textContent = "Tambah Tugas";
    this.el.submitBtn.textContent = "Tambah";
    this.el.cancelBtn.hidden = true;
  }

  // ----- Fetch async (async/await + try/catch) -----
  async loadQuote() {
    this.el.quote.textContent = "Memuat kutipan...";
    try {
      const res = await fetch(API.quote);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const { quote, author } = await res.json();
      this.el.quote.innerHTML = `
        <p class="quote-text">“${escapeHtml(quote)}”</p>
        <p class="quote-author">— ${escapeHtml(author)}</p>`;
    } catch (err) {
      this.el.quote.textContent = `Kutipan tidak tersedia (${err.message})`;
    }
  }

  async importSample() {
    this.el.sampleBtn.disabled = true;
    this.el.sampleBtn.textContent = "Memuat...";
    try {
      const res = await fetch(API.todos);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const todos = await res.json();
      const baru = todos.map(({ title, completed }, i) =>
        new TaskItem({ title, course: "Contoh dari API", deadline: defaultDeadline(i + 1), done: completed }));
      this.tasks = [...this.tasks, ...baru];
      this.commit();
    } catch (err) {
      alert(`Gagal memuat contoh tugas: ${err.message}`);
    } finally {
      this.el.sampleBtn.disabled = false;
      this.el.sampleBtn.textContent = "Muat contoh tugas dari API";
    }
  }

  // ----- Render (template literals) -----
  get visibleTasks() {
    const { filter, query } = this;
    return this.tasks
      .filter(({ done }) => filter === "semua" || (filter === "aktif" ? !done : done))
      .filter(({ title, course }) => `${title} ${course}`.toLowerCase().includes(query))
      .sort((a, b) => Number(a.done) - Number(b.done) || a.deadline.localeCompare(b.deadline));
  }

  // Tugas belum selesai dengan deadline paling dekat (yang terlambat dihitung paling dekat)
  get nearestTask() {
    return this.tasks
      .filter(({ done }) => !done)
      .reduce((dekat, t) => (!dekat || t.msLeft < dekat.msLeft ? t : dekat), null);
  }

  renderStats() {
    const total = this.tasks.length;
    const selesai = this.tasks.filter(({ done }) => done).length;
    const terlambat = this.tasks.filter((t) => t.isOverdue).length;
    this.el.stats.innerHTML = `
      <div class="stat"><strong>${total}</strong><span>Total tugas</span></div>
      <div class="stat"><strong>${total - selesai}</strong><span>Belum selesai</span></div>
      <div class="stat stat-ok"><strong>${selesai}</strong><span>Selesai</span></div>
      <div class="stat stat-danger"><strong>${terlambat}</strong><span>Terlambat</span></div>`;
    this.renderProgress(total, selesai);
    this.renderHearts();
  }

  // Hati mengikuti tugas terdekat, lengkap dengan pesannya
  renderHearts() {
    const { nearestTask: dekat } = this;
    const nyawa = dekat ? heartsFor(dekat.msLeft) : MAX_HEARTS;
    this.el.hearts.innerHTML = Array.from({ length: MAX_HEARTS }, (_, i) =>
      `<span class="heart ${i < nyawa ? "full" : "empty"}" aria-hidden="true">♥</span>`).join("");
    this.el.hearts.setAttribute("aria-label", `${nyawa} dari ${MAX_HEARTS} hati tersisa`);
    this.el.heartsText.textContent = `${nyawa}/${MAX_HEARTS}`;

    const { teks, bahaya } = dekat
      ? pesanTerdekat(dekat)
      : { teks: "Tidak ada tugas aktif. Jadwalmu aman.", bahaya: false };
    this.el.heartsMsg.textContent = teks;
    this.el.heartsMsg.classList.toggle("danger", bahaya);
  }

  renderProgress(total, selesai) {
    const persen = total ? Math.round((selesai / total) * 100) : 0;
    this.el.progressBar.style.width = `${persen}%`;
    this.el.progress.setAttribute("aria-valuenow", persen);
    this.el.progressText.textContent = total
      ? `${selesai} dari ${total} tugas selesai (${persen}%)`
      : "Belum ada tugas";
  }

  renderReminder() {
    const aktif = this.tasks.filter(({ done }) => !done);
    const terlambat = aktif.filter((t) => t.isOverdue).length;
    const segera = aktif.filter((t) => t.msLeft >= 0 && t.msLeft <= SATU_HARI).length;
    const bagian = [];
    if (terlambat) bagian.push(`${terlambat} tugas terlambat`);
    if (segera) bagian.push(`${segera} tugas jatuh tempo dalam 24 jam`);
    this.el.reminder.hidden = bagian.length === 0;
    this.el.reminder.textContent = bagian.join(" · ");
  }

  renderTask(task) {
    const { id, title, course, deadline, priority, done, isOverdue, dueLabel } = task;
    const kelas = ["task", done && "done", isOverdue && "overdue"].filter(Boolean).join(" ");
    const rarity = RARITY[priority] ? priority : "rendah";
    return `
      <li class="${kelas}" data-id="${id}">
        <label class="check">
          <input type="checkbox" data-action="toggle" ${done ? "checked" : ""} aria-label="Tandai selesai">
        </label>
        <div class="task-main">
          <p class="task-title rarity-${rarity}">${escapeHtml(title)}</p>
          <p class="task-meta">
            ${course ? `<span>${escapeHtml(course)}</span>` : ""}
            <span>${formatTanggal(deadline)}</span>
            <span class="badge badge-${rarity}">${RARITY[rarity]}</span>
            <span class="due ${isOverdue ? "due-late" : ""}">${dueLabel}</span>
          </p>
        </div>
        <div class="task-actions">
          <button type="button" data-action="edit">Edit</button>
          <button type="button" data-action="delete">Hapus</button>
        </div>
      </li>`;
  }

  render() {
    this.renderStats();
    this.renderReminder();

    const tasks = this.visibleTasks;
    this.el.list.innerHTML = tasks.map((task) => this.renderTask(task)).join("");

    const pesan = {
      semua: "Belum ada tugas. Tambahkan tugas pertamamu di atas.",
      aktif: "Tidak ada tugas yang belum selesai. Mantap!",
      selesai: "Belum ada tugas yang selesai."
    };
    this.el.empty.hidden = tasks.length > 0;
    this.el.empty.textContent = this.query
      ? "Tidak ada tugas yang cocok dengan pencarian."
      : pesan[this.filter];

    this.el.filters.querySelectorAll("[data-filter]").forEach((chip) => {
      chip.classList.toggle("active", chip.dataset.filter === this.filter);
    });
  }
}

new DashboardApp();