'use strict';
let historyStudentId = null;
let historyReturnView = 'grid';

function studentHistoryEntries(c, studentId) {
  return c.sessions.filter(s => s.students.some(st => st.id === studentId))
    .slice().sort((a,b) => b.date.localeCompare(a.date));
}

function renderStudentHistory() {
  const c = course();
  const entries = studentHistoryEntries(c, historyStudentId);
  const student = c.students.find(st => st.id === historyStudentId) ||
    entries[0]?.students.find(st => st.id === historyStudentId);
  if (!student) return '<section class="empty"><h2>No encontramos este estudiante</h2><button data-action="close-student-history">Volver a la clase</button></section>';
  return `<section class="individual-history" aria-label="Historial individual">
    <div class="row toolbar">
      <div><div class="eyebrow">Historial del estudiante</div><h2>${esc(student.name)}</h2>
      <p>${entries.length} ${entries.length===1?'clase registrada':'clases registradas'} · Solo consulta</p></div>
      <button data-action="close-student-history">Volver a la clase</button>
    </div>
    <div class="student-timeline">${entries.length ? entries.map(s => {
      const snapshot = s.students.find(st => st.id === historyStudentId);
      return `<article class="student-history-day">
        <h3>${esc(dateLabel(s.date))}</h3>
        ${snapshot.name!==student.name ? `<p class="hint">Registrado como ${esc(snapshot.name)}</p>` : ''}
        <div class="history-marks">${s.criteria.map(k => {
          const info = states[s.marks[historyStudentId]?.[k.id] || 'empty'] || states.empty;
          return `<div class="history-result ${info.cls}"><span>${esc(k.name)}</span>
            <strong><span aria-hidden="true">${info.symbol}</span> ${info.label}</strong></div>`;
        }).join('')}</div></article>`;
    }).join('') : '<div class="empty">Este estudiante todavía no tiene clases registradas.</div>'}</div>
  </section>`;
}

app.addEventListener('click', e => {
  const button = e.target.closest('[data-action]');
  if (!button || (window.AulaCloud && !window.AulaCloud.canEdit())) return;
  if (button.dataset.action === 'student-history') {
    historyStudentId = button.dataset.id;
    historyReturnView = view === 'student' ? 'student' : 'grid';
    view = 'student-history';
    render();
    app.querySelector('[data-action="close-student-history"]')?.focus({preventScroll:true});
  } else if (button.dataset.action === 'close-student-history') {
    view = historyReturnView;
    render();
  }
});
