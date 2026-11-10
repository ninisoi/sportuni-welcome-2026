(()=>{'use strict';
const $=x=>document.getElementById(x), field=$('answer'), counter=$('counter'), send=$('sendBtn'), error=$('answerError');
let qid=null, submitting=false;const limit=100;
const segmenter=Intl.Segmenter?new Intl.Segmenter('ka',{granularity:'grapheme'}):null;
const chars=s=>segmenter?[...segmenter.segment(s)].map(x=>x.segment):[...s];
const draftKey=id=>'su_draft_'+id;
function err(msg){field.classList.add('field-error');field.setAttribute('aria-invalid','true');error.textContent=msg;error.classList.add('show')}
function clear(){field.classList.remove('field-error');field.removeAttribute('aria-invalid');error.classList.remove('show')}
function update(){const a=chars(field.value);if(a.length>limit)field.value=a.slice(0,limit).join('');counter.textContent=chars(field.value).length+' / 100';counter.classList.toggle('warn',chars(field.value).length>=90);if(field.value.trim())clear();if(qid)localStorage.setItem(draftKey(qid),field.value)}
field.addEventListener('input',update);
async function get(){const r=await fetch('/api/student/status',{cache:'no-store'});if(!r.ok)throw Error();return r.json()}
async function tick(){try{const d=await get();if(!d.question || !d.question.id){field.disabled=true;send.disabled=true;$('question').textContent='კითხვა ჯერ არ გამოქვეყნებულა';return}if(qid!==d.question.id){qid=d.question.id;$('question').textContent=d.question.text;field.value=localStorage.getItem(draftKey(qid))||'';update()};if(d.answered){location.replace('/confirmation');return}field.disabled=!d.intake||submitting;send.disabled=!d.intake||submitting;if(!d.intake&&!submitting)err('ამ ეტაპზე პასუხების მიღება შეჩერებულია');else if(d.intake&&field.value.trim())clear()}catch{if(!submitting)err('სერვერთან კავშირი ვერ დამყარდა. სცადე ხელახლა.')}}
document.querySelectorAll('[data-emoji]').forEach(btn=>btn.addEventListener('click',()=>{if(field.disabled)return;const start=field.selectionStart,end=field.selectionEnd,emoji=btn.dataset.emoji;let t=field.value.slice(0,start)+emoji+field.value.slice(end);if(chars(t).length>limit)return;field.value=t;update();field.focus();field.setSelectionRange(start+emoji.length,start+emoji.length)}));
$('answerForm').addEventListener('submit',async e=>{e.preventDefault();if(submitting)return;const text=field.value.trim();if(!text){err('ველი ცარიელია — ჩაწერე შენი პასუხი.');field.focus();return}if(!qid)return err('კითხვა ჯერ არ ჩატვირთულა.');submitting=true;send.disabled=true;try{const r=await fetch('/api/student/submit',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({qid,text,submission_id:(()=>{let k='su_submission_'+qid;let v=localStorage.getItem(k);if(!v){v=crypto.randomUUID();localStorage.setItem(k,v)}return v})()})});const j=await r.json();if(!r.ok)throw Error(j.detail||'პასუხი ვერ გაიგზავნა. სცადე ხელახლა.');localStorage.removeItem(draftKey(qid));location.href='/confirmation'}catch(ex){err(typeof ex.message==='string'?ex.message:'პასუხი ვერ გაიგზავნა. სცადე ხელახლა.');submitting=false;send.disabled=false}});
tick();setInterval(tick,6500);
})();
