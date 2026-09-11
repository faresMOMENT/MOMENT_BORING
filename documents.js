(()=>{
  const boringKey="boringLogAppState",labKey="moment-lab-custody-v1";
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch{return fallback}};
  const safe=value=>String(value??"").replace(/[&<>'"]/g,char=>({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"})[char]);
  const boring=read(boringKey,{projects:[],borings:[],projectFiles:[]});
  const lab=read(labKey,{homes:[]});
  const projects=Array.isArray(boring.projects)?[...boring.projects]:[];
  const borings=Array.isArray(boring.borings)?boring.borings:[];
  const files=Array.isArray(boring.projectFiles)?boring.projectFiles:[];
  const homes=Array.isArray(lab.homes)?lab.homes:[];
  homes.forEach(home=>{
    const linked=projects.some(project=>home.sourceProjectId===project.id||home.id===project.id||(project.number&&home.projectNumber===project.number));
    if(!linked)projects.push({id:home.sourceProjectId||home.id,number:home.projectNumber,name:home.projectName,address:home.address,client:home.clientName,labHomeId:home.id});
  });
  const elements={list:document.querySelector("#projectDocuments"),search:document.querySelector("#documentSearch"),project:document.querySelector("#projectFilter"),type:document.querySelector("#typeFilter")};
  const labHome=project=>homes.find(home=>home.id===project.labHomeId||home.sourceProjectId===project.id||home.id===project.id||(project.number&&home.projectNumber===project.number));
  const title=project=>project.name||project.address||`Project ${project.number||""}`.trim();
  function documentsFor(project){
    const docs=[];
    borings.filter(item=>item.projectId===project.id).forEach((item,index)=>docs.push({type:"boring",icon:"BL",name:`Boring Log · ${item.id||index+1}`,detail:item.info?.location||project.address||"Field boring record",generated:true,href:`index.html?project=${encodeURIComponent(project.id)}&boring=${encodeURIComponent(item.id)}&download=boring-simple`,openHref:`index.html?project=${encodeURIComponent(project.id)}&boring=${encodeURIComponent(item.id)}`}));
    const home=labHome(project);
    if(home){
      docs.push({type:"lab",icon:"CC",name:"Chain of Custody",detail:"Lab sample custody record",generated:true,href:`lab-work.html?project=${encodeURIComponent(home.id)}&download=custody`,openHref:`lab-work.html?project=${encodeURIComponent(home.id)}`});
      if(home.tests?.moisture)docs.push({type:"lab",icon:"MD",name:"Moisture Density · MD & DD",detail:"Laboratory test report",generated:true,href:`lab-work.html?project=${encodeURIComponent(home.id)}&download=md`,openHref:`lab-work.html?project=${encodeURIComponent(home.id)}`});
      if(home.tests?.sieve)docs.push({type:"lab",icon:"SA",name:"Sieve Analysis",detail:"Laboratory test report",generated:true,href:`lab-work.html?project=${encodeURIComponent(home.id)}&download=sieve`,openHref:`lab-work.html?project=${encodeURIComponent(home.id)}`});
    }
    files.filter(file=>file.projectId===project.id).forEach(file=>docs.push({type:"uploaded",icon:"UP",name:file.name||"Uploaded document",detail:[file.type,file.size].filter(Boolean).join(" · ")||"Project file",href:file.dataUrl||"#",openHref:file.dataUrl||"#",download:file.name||"project-file"}));
    return docs;
  }
  function render(){
    const query=elements.search.value.trim().toLowerCase(),projectId=elements.project.value,type=elements.type.value;
    let documentCount=0;
    const cards=projects.map(project=>{
      let docs=documentsFor(project);
      if(type!=="all")docs=docs.filter(doc=>doc.type===type);
      const haystack=[title(project),project.number,project.client,project.address,...docs.map(doc=>doc.name)].join(" ").toLowerCase();
      if((projectId!=="all"&&project.id!==projectId)||(query&&!haystack.includes(query)))return"";
      documentCount+=docs.length;
      const rows=docs.length?docs.map(doc=>`<article class="document-row"><span class="document-icon">${safe(doc.icon)}</span><div class="document-copy"><h3>${safe(doc.name)}</h3><p>${safe(doc.detail)}</p></div><div class="document-actions"><a class="download-link" href="${safe(doc.href)}" ${doc.generated?'target="documentDownloadFrame"':`download="${safe(doc.download||"project-file")}"`}>Download</a><a class="open-link" href="${safe(doc.openHref||doc.href)}" ${doc.type==="uploaded"?'target="_blank" rel="noopener"':""}>Open document</a></div></article>`).join(""):'<div class="empty-project">No matching documents are available for this project yet.</div>';
      return `<details class="project-card" open><summary><div class="project-title"><h2>${safe(title(project))}</h2><p>${safe([project.number,project.client,project.address].filter(Boolean).join(" · "))}</p></div><span class="project-count">${docs.length} file${docs.length===1?"":"s"}</span></summary><div class="document-list">${rows}</div></details>`;
    }).filter(Boolean).join("");
    elements.list.innerHTML=cards||'<div class="empty-documents">No projects or documents match these filters.</div>';
    document.querySelector("#projectTotal").textContent=projects.length;
    document.querySelector("#documentTotal").textContent=documentCount;
  }
  document.addEventListener("DOMContentLoaded",()=>{
    elements.project.innerHTML+=[...projects].sort((a,b)=>title(a).localeCompare(title(b))).map(project=>`<option value="${safe(project.id)}">${safe(title(project))}</option>`).join("");
    [elements.search,elements.project,elements.type].forEach(element=>element.addEventListener("input",render));
    render();
  });
})();
