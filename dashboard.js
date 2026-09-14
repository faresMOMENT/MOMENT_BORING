(()=>{
  const boringKey="boringLogAppState",labKey="moment-lab-custody-v1";
  const safe=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
  const read=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||"null")||fallback}catch{return fallback}};
  const sameProject=(entry,project)=>entry&&(entry.sourceProjectId===project.id||entry.id===project.id||(project.number&&String(entry.projectNumber||"").trim().toLowerCase()===String(project.number).trim().toLowerCase()));
  let model=[];
  function loadModel(){
    const field=read(boringKey,{}),lab=read(labKey,{homes:[],upcomingProjects:[]});
    const projects=Array.isArray(field.projects)?field.projects:[],borings=Array.isArray(field.borings)?field.borings:[],homes=Array.isArray(lab.homes)?lab.homes:[],upcoming=Array.isArray(lab.upcomingProjects)?lab.upcomingProjects:[];
    model=projects.map(project=>{
      const projectBorings=borings.filter(item=>item.projectId===project.id),samples=projectBorings.reduce((total,item)=>total+(Array.isArray(item.samples)?item.samples.length:0),0),home=homes.find(item=>sameProject(item,project)),queued=upcoming.find(item=>sameProject(item,project));
      const labStatus=String(home?.projectStatus||"").toLowerCase();
      const stage=home?(labStatus==="report"?"report":labStatus==="received"?"received":"testing"):queued||samples?"waiting":"field";
      return{project,projectBorings,samples,home,queued,stage};
    }).filter(item=>!item.home?.completedAt);
  }
  const stageLabel=item=>item.stage==="report"?"Report":item.stage==="testing"?"Testing In Progress":item.stage==="received"?"Received":item.stage==="waiting"?"Awaiting lab arrival":"Field work";
  function render(){
    loadModel();
    const query=document.querySelector("#projectSearch").value.trim().toLowerCase(),filter=document.querySelector("#statusFilter").value;
    const visible=model.filter(item=>{const p=item.project,text=[p.number,p.name,p.address,p.client,p.county,item.home?.projectStatus].filter(Boolean).join(" ").toLowerCase(),matchesStage=filter==="all"||(filter==="lab"&&(item.stage==="received"||item.stage==="testing"||item.stage==="report"))||item.stage===filter;return(!query||text.includes(query))&&matchesStage});
    document.querySelector("#activeProjectCount").textContent=model.length;
    document.querySelector("#labProjectCount").textContent=model.filter(item=>item.stage==="received"||item.stage==="testing"||item.stage==="report").length;
    document.querySelector("#waitingProjectCount").textContent=model.filter(item=>item.stage==="waiting").length;
    document.querySelector("#sampleCount").textContent=model.reduce((sum,item)=>sum+item.samples,0);
    document.querySelector("#dashboardUpdated").textContent=`${visible.length} of ${model.length} active projects shown`;
    document.querySelector("#dashboardProjects").innerHTML=visible.length?visible.map(item=>{const p=item.project,labDate=item.home?.labCheckInDate||p.labCheckInDate||"Not checked in";return`<article class="project-overview"><div class="project-title"><span class="project-number">${safe(p.number||"No project number")}</span><h2>${safe(p.name||p.address||"Untitled project")}</h2><p class="project-address">${safe(p.address||"No address saved")} · ${safe(p.client||"No client saved")}</p></div><div class="project-details"><div class="project-detail"><span>Borings</span><strong>${item.projectBorings.length}</strong></div><div class="project-detail"><span>Samples</span><strong>${item.samples}</strong></div><div class="project-detail"><span>Lab check-in</span><strong>${safe(labDate)}</strong></div><div class="project-detail"><span>County</span><strong>${safe(p.county||item.home?.county||"Not set")}</strong></div></div><div class="project-actions"><span class="status-pill ${item.stage}">${safe(stageLabel(item))}</span><a class="pipeline-link" href="lab-work.html?project=${encodeURIComponent(p.id)}">View in Lab Pipeline →</a></div></article>`}).join(""):`<div class="empty-dashboard"><h2>${model.length?"No matching projects":"No active projects yet"}</h2><p>${model.length?"Try a different search or status filter.":"Projects created in Boring Logs will appear here automatically."}</p><a href="index.html">Open Boring Logs</a></div>`;
  }
  document.addEventListener("DOMContentLoaded",()=>{document.querySelector("#projectSearch").addEventListener("input",render);document.querySelector("#statusFilter").addEventListener("change",render);render()});
  window.addEventListener("storage",render);window.addEventListener("focus",render);
})();
