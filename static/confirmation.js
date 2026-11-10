(()=>{'use strict';const $=id=>document.getElementById(id);let currentId=null;
async function tick(){try{const r=await fetch('/api/student/status',{cache:'no-store'});if(!r.ok)throw Error();const d=await r.json();if(currentId!==null&&d.question.id!==currentId){location.replace('/join');return}currentId=d.question.id;if(!d.answered){location.replace('/join');return}$('submittedText').textContent=d.answer||'';$('status').hidden=!d.review;}catch{ /* leave the accepted answer visible during brief connectivity loss */ }}
const decor=$('decor');if(decor)for(let i=0;i<22;i++){const s=document.createElement('i');s.className='confetti-piece';s.style.setProperty('--x',Math.random()*100+'%');s.style.setProperty('--r',Math.random()*180+'deg');s.style.setProperty('--d',Math.random()*.55+'s');s.style.setProperty('--c',['#FDCB4E','#FFFFFF','#90D7EB'][i%3]);decor.append(s)}
tick();setInterval(tick,6500);
})();
