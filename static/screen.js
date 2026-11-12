
/* ======================================================
   SPORTUNI WELCOME 2026
   FAST PROJECTOR CONTROLLER

   QR stays controlled by admin.
   Poll loads while QR is visible.
   Poll appears only after real results are ready.
   No default 3-heart screen or wrong Live Wall.
====================================================== */

(() => {
  "use strict";

  const frames = {
    qr: document.getElementById("qr"),
    wall: document.getElementById("wall"),
    poll: document.getElementById("poll")
  };

  let questionId = null;
  let questionType = null;
  let screenMode = "qr";
  let desired = "qr";

  let busy = false;
  let initialized = false;

  const frameLoaded = {
    qr: false,
    wall: false,
    poll: false
  };

  let readyPollId = null;

  function urlFor(name,id){
    const paths={
      qr:"/qr-view",
      wall:"/wall-view",
      poll:"/poll-view"
    };

    return paths[name]+(
      id ? "?q="+encodeURIComponent(id) : ""
    );
  }

  function show(name){
    for(const [key,frame] of Object.entries(frames)){
      frame.hidden=key!==name;
    }
  }

  function hideAll(){
    for(const frame of Object.values(frames)){
      frame.hidden=true;
    }
  }

  function targetFor(mode,type){
    if(mode!=="wall") return "qr";

    return type==="poll"
      ? "poll"
      : "wall";
  }

  function prepare(name,id){
    const frame=frames[name];
    const nextUrl=urlFor(name,id);

    if(frame.getAttribute("src")!==nextUrl){
      frameLoaded[name]=false;

      if(name==="poll"){
        readyPollId=null;
      }

      frame.src=nextUrl;
    }
  }

  function activate(){
    desired=targetFor(screenMode,questionType);

    if(desired==="poll"){
      const ready=
        readyPollId===questionId;

      if(!ready){
        hideAll();

        // Poll continues loading in the background.
        return;
      }

      show("poll");

      frames.poll.contentWindow?.postMessage(
        {type:"SPORTUNI_POLL_ACTIVATE"},
        location.origin
      );

      return;
    }

    if(frameLoaded[desired]){
      show(desired);
    }else{
      hideAll();
    }
  }

  // Poll readiness is sent by poll.html only after
  // its first successful real-results response.
  window.addEventListener("message",event=>{
    if(event.origin!==location.origin) return;

    if(
      event.source!==frames.poll.contentWindow ||
      event.data?.type!=="SPORTUNI_POLL_READY"
    ){
      return;
    }

    if(event.data.questionId!==questionId){
      return;
    }

    readyPollId=event.data.questionId;
    frameLoaded.poll=true;

    if(desired==="poll"){
      activate();
    }
  });

  for(const [name,frame] of Object.entries(frames)){
    frame.addEventListener("load",()=>{
      if(name==="poll"){
        // iframe load is not enough: wait for
        // real Poll data from poll.html.
        return;
      }

      const expected=urlFor(name,questionId);

      if(frame.getAttribute("src")===expected){
        frameLoaded[name]=true;

        if(desired===name){
          show(name);
        }
      }
    });
  }

  async function tick(){
    if(busy) return;
    busy=true;

    try{
      const response=await fetch(
        "/api/public",
        {
          cache:"no-store",
          credentials:"same-origin"
        }
      );

      if(!response.ok){
        throw new Error("Projector status error");
      }

      const data=await response.json();

      const nextId=data.question?.id||null;

      const nextType=data.question_type==="poll"
        ? "poll"
        : "text";

      const nextMode=data.screen==="wall"
        ? "wall"
        : "qr";

      const changed=
        !initialized ||
        nextId!==questionId ||
        nextType!==questionType ||
        nextMode!==screenMode;

      if(!changed) return;

      const questionChanged=
        nextId!==questionId ||
        nextType!==questionType;

      questionId=nextId;
      questionType=nextType;
      screenMode=nextMode;
      initialized=true;

      desired=targetFor(screenMode,questionType);

      if(questionChanged){
        hideAll();

        // QR is prepared for every question.
        prepare("qr",questionId);

        // Prepare only the relevant live screen.
        if(questionType==="poll"){
          prepare("poll",questionId);
        }else{
          prepare("wall",questionId);
        }
      }

      activate();

    }catch(error){
      console.warn("Projector status:",error);
    }finally{
      busy=false;
    }
  }

  hideAll();

  tick();
  setInterval(tick,800);

  document.addEventListener("visibilitychange",()=>{
    if(!document.hidden) tick();
  });

})();
