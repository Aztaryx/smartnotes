const $ = s => document.querySelector(s);
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
let C, S = {}, sel = null, checks = 0, qi = 0, score = 0, lines = [];

function say(t) {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(t);
  u.lang = 'en-US'; u.rate = 0.9;
  speechSynthesis.speak(u);
}
const spoken = t => t.replace(/\{(\d+)\}/g, 'blank $1').replace(/\+/g, ' plus ').replace(/=/g, ' equals ').replace(/^- /, '');
const shuffle = a => { a = [...a]; for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const sayFor = w => { const b = Object.values(C.blanks).find(b => b.answer === w); return (b && b.say) || w; };

function lineHTML(raw, full) {
  return esc(raw.replace(/^- /, '')).replace(/\{(\d+)\}/g, (m, n) => full
    ? `<mark>${esc(C.blanks[n].answer)}</mark>`
    : `<span class="bw"><button class="blank" data-n="${n}" aria-label="Blank ${n}">${n}</button><span class="hint" hidden></span></span>`);
}

function render() {
  $('#title').textContent = C.title;
  document.title = C.title + ' | smartnotes';
  let i = 0;
  $('#sections').innerHTML = C.sections.map(s => `<h2>${esc(s.heading)}</h2>` + s.lines.map(l => {
    lines.push(spoken(l));
    return `<div class="line${l.startsWith('- ') ? ' item' : ''}"><div class="t">${lineHTML(l)}</div><button class="spk" data-i="${i++}" aria-label="Read this line">🔊</button></div>`;
  }).join('')).join('');
  Object.keys(C.blanks).forEach(n => S[n] = { word: null, ok: false, hinted: false, wrong: false });
  C.bank = shuffle(Object.values(C.blanks).map(b => b.answer));
  paint();
}

function paint() {
  const placed = new Set(Object.values(S).map(s => s.word));
  $('#bank').innerHTML = C.bank.filter(w => !placed.has(w)).map(w =>
    `<button class="chip${sel === w ? ' sel' : ''}" draggable="true" data-w="${esc(w)}">${esc(w)}</button>`).join('')
    || '<span class="how">All words placed.</span>';
  document.querySelectorAll('.blank').forEach(b => {
    const n = b.dataset.n, s = S[n];
    b.textContent = s.word || n;
    b.className = 'blank' + (s.word ? ' filled' : '') + (s.ok ? ' ok' : '') + (s.wrong && !s.word ? ' wrong' : '');
    b.disabled = s.ok;
    const h = b.nextElementSibling;
    h.hidden = !(s.hinted && !s.ok);
    h.textContent = h.hidden ? '' : 'Hint: ' + C.blanks[n].hint;
  });
  const left = Object.values(S).filter(s => !s.word).length;
  $('#check').disabled = left > 0;
  if (!checks) $('#msg').textContent = left ? `${left} blank${left > 1 ? 's' : ''} left. Fill them all, then check.` : 'All filled. Press Check answers.';
}

function place(n, w) {
  const s = S[n]; if (s.ok || !w) return;
  s.word = w; s.wrong = false; sel = null; paint();
}
function blankTap(n) {
  const s = S[n]; if (s.ok) return;
  if (sel) place(n, sel);
  else if (s.word) { s.word = null; paint(); }
  else say('Blank ' + n);
}

function check() {
  checks++;
  const wrong = [];
  for (const n in S) {
    const s = S[n]; if (s.ok) continue;
    if (s.word === C.blanks[n].answer) s.ok = true;
    else { s.hinted = true; s.wrong = true; s.word = null; wrong.push(n); }
  }
  paint();
  if (wrong.length) {
    $('#msg').textContent = `${wrong.length} wrong. They popped out. Read the hints and try again.`;
    $('#jump').hidden = false; jump();
  } else {
    $('#msg').textContent = `All correct! You checked ${checks} time${checks > 1 ? 's' : ''}.`;
    $('#jump').hidden = true; $('#check').hidden = true; $('#startq').hidden = false;
  }
}
function jump() {
  const b = document.querySelector('.blank.wrong');
  if (b) b.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function startQuiz() {
  $('#read').hidden = true; $('#bar').hidden = true; $('#quiz').hidden = false;
  window.scrollTo(0, 0); showQ();
}
const qSay = q => `${q.say || q.text}. Traditional or modern?`;
function showQ() {
  const q = C.quiz[qi];
  $('#qn').textContent = `Question ${qi + 1} of ${C.quiz.length}`;
  $('#qt').textContent = q.text;
  $('#qfb').textContent = ''; $('#qfb').className = 'fb';
  $('#qnext').hidden = true;
  document.querySelectorAll('.choice').forEach(b => b.disabled = false);
  say(qSay(q));
}
function answer(a) {
  const q = C.quiz[qi], good = a === q.answer;
  if (good) score++;
  const msg = (good ? 'Correct! ' : `Not quite. It is ${q.answer}. `) + q.why;
  $('#qfb').className = 'fb ' + (good ? 'good' : 'bad');
  $('#qfb').textContent = msg;
  document.querySelectorAll('.choice').forEach(b => b.disabled = true);
  $('#qnext').textContent = qi + 1 < C.quiz.length ? 'Next' : 'See results';
  $('#qnext').hidden = false;
  say(msg);
}
function next() { if (++qi < C.quiz.length) showQ(); else finish(); }

function finish() {
  $('#quiz').hidden = true;
  const f = $('#full');
  f.hidden = false;
  const item = l => l.startsWith('- ');
  f.innerHTML = `
   <div class="score noprint"><b>Reviewer unlocked!</b><br>Fill-in: checked ${checks} time${checks > 1 ? 's' : ''}. Quiz: ${score} out of ${C.quiz.length}.
   <p><button class="main" onclick="window.print()">Save as PDF</button> <button class="ghost" onclick="location.reload()">Try again</button></p>
   <p class="how">In the print window, choose "Save as PDF" as the printer.</p></div>
   <h1>${esc(C.title)} Reviewer</h1>` +
   C.sections.map(s => `<h2>${esc(s.heading)}</h2>` + s.lines.map(l =>
     `<div class="line${item(l) ? ' item' : ''}"><div class="t">${lineHTML(l, true)}</div></div>`).join('')).join('') +
   `<h2>Traditional or Modern?</h2><table><tr><th>Example</th><th>Type</th><th>Why</th></tr>` +
   C.quiz.map(q => `<tr><td>${esc(q.text)}</td><td>${q.answer}</td><td>${esc(q.why)}</td></tr>`).join('') + `</table>`;
  window.scrollTo(0, 0);
}

document.addEventListener('click', e => {
  const t = e.target;
  if (t.closest('.chip')) {
    const w = t.closest('.chip').dataset.w;
    sel = sel === w ? null : w; say(sayFor(w)); paint();
  } else if (t.closest('.blank')) blankTap(t.closest('.blank').dataset.n);
  else if (t.closest('.spk')) say(lines[t.closest('.spk').dataset.i]);
  else if (t.closest('.choice')) answer(t.closest('.choice').dataset.a);
});
document.addEventListener('dragstart', e => {
  const c = e.target.closest && e.target.closest('.chip');
  if (c) { e.dataTransfer.setData('text/plain', c.dataset.w); sel = null; }
});
document.addEventListener('dragover', e => { if (e.target.closest && e.target.closest('.blank')) e.preventDefault(); });
document.addEventListener('drop', e => {
  const b = e.target.closest && e.target.closest('.blank');
  if (b) { e.preventDefault(); place(b.dataset.n, e.dataTransfer.getData('text/plain')); }
});

fetch('content/library.json').then(r => r.json()).then(async lib => {
  const id = new URLSearchParams(location.search).get('topic');
  const t = lib.find(x => x.id === id) || lib[0];
  C = await (await fetch('content/' + t.file)).json();
  render();
  $('#check').onclick = check; $('#jump').onclick = jump;
  $('#startq').onclick = startQuiz; $('#qnext').onclick = next;
  $('#qspk').onclick = () => say(qSay(C.quiz[qi]));
  $('#readall').onclick = () => say(lines.join(' ... '));
}).catch(() => {
  const e = $('#err'); e.hidden = false;
  e.textContent = 'Could not load the reviewer. Open this site from its web address, not from the file.';
});
