(() => {
  const cloudReady = window.MomentWorkspaceCloud
    ? window.MomentWorkspaceCloud.boot()
    : new Promise(resolve => {
        const script=document.createElement('script');script.src='workspace-cloud.js';script.onload=()=>window.MomentWorkspaceCloud.boot().finally(resolve);script.onerror=resolve;document.head.append(script);
      });
  const init = () => {
  const icons={log:'<path d="M6 3.5h9l3 3V20.5H6z"/><path d="M15 3.5v4h4M9 12h6M9 16h6"/>',clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',calendar:'<rect x="3.5" y="5.5" width="17" height="15" rx="2"/><path d="M8 3v5M16 3v5M3.5 10h17"/>',hours:'<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>',dashboard:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',pipeline:'<rect x="4" y="3" width="16" height="18" rx="2"/><path d="M9 3v18M4 9h16"/>',mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m4 7 8 6 8-6"/>',documents:'<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/>',custody:'<path d="M8 4h8M9 3h6v3H9z"/><rect x="5" y="5" width="14" height="16" rx="2"/><path d="m9 14 2 2 4-5"/>',inventory:'<path d="m4 7 8-4 8 4-8 4zM4 7v10l8 4 8-4V7M12 11v10"/>',lab:'<path d="M9 3h6M10 3v6l-5 8.5A2.3 2.3 0 0 0 7 21h10a2.3 2.3 0 0 0 2-3.5L14 9V3M8 15h8"/>',manual:'<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H11v16H6.5A2.5 2.5 0 0 0 4 21.5zM20 5.5A2.5 2.5 0 0 0 17.5 3H13v16h4.5a2.5 2.5 0 0 1 2.5 2.5z"/>',contacts:'<circle cx="9" cy="8" r="3"/><path d="M3.5 19v-1.5A4.5 4.5 0 0 1 8 13h2a4.5 4.5 0 0 1 4.5 4.5V19M16 5.5a3 3 0 0 1 0 5.5M17 13a4.5 4.5 0 0 1 3.5 4.4V19"/>',me:'<circle cx="12" cy="8" r="4"/><path d="M4.5 21a7.5 7.5 0 0 1 15 0"/>',payroll:'<path d="M12 2v20M17 6.5H9.5a3 3 0 0 0 0 6h5a3 3 0 0 1 0 6H6"/>',reports:'<path d="M5 20V10M12 20V4M19 20v-7"/>'};
  const item=(href,label,icon)=>`<a class="menu-item" href="${href}"><svg class="menu-icon" viewBox="0 0 24 24" aria-hidden="true">${icons[icon]}</svg><span>${label}</span></a>`;
  const nav=document.querySelector('nav.app-tabs'); if(!nav)return;
  nav.innerHTML=`<a class="menu-brand" href="dashboard.html"><span class="menu-brand-mark">M</span><span class="menu-brand-copy"><strong>Moment Engineering</strong><small>Field workspace</small></span></a><section class="menu-section"><h2 class="menu-heading">My Day</h2>${item('clock-in-out.html','Clock In/Out','clock')}${item('schedule.html','Schedule','calendar')}${item('my-hours.html','My Hours','hours')}${item('job-calendar.html','Calendar','calendar')}</section><section class="menu-section"><h2 class="menu-heading">Projects</h2>${item('dashboard.html','Dashboard','dashboard')}${item('lab-work.html','Lab Pipeline','pipeline')}${item('lab-manual.html','Lab Manual','manual')}${item('correspondence.html','Correspondence','mail')}${item('documents.html','Documents','documents')}${item('index.html','Boring Logs','log')}${item('lab-inventory.html','Custody','custody')}${item('contacts.html','Contacts','contacts')}</section><section class="menu-section menu-account">${item('admin.html','Admin','contacts')}${item('me.html','Me','me')}</section><section class="menu-section menu-reports">${item('reports.html','Reports','reports')}</section><div class="menu-footer"><strong id="accessProfileName">Fares</strong><span id="accessProfileRole">Administrator</span><a class="switch-profile" href="worker-login.html">Switch profile</a></div><div class="menu-context"><div class="project-chip" id="activeProjectChip">No active project</div><div class="user-chip" id="userChip"><button id="signedInUser" type="button" title="Open settings"></button><button class="text-button" type="button" id="logoutButton">Logout</button></div></div>`;
  const page=(location.pathname.split('/').pop()||'index.html').toLowerCase();
  const schedulerLabel=nav.querySelector('a[href="schedule.html"] span');
  if(schedulerLabel)schedulerLabel.textContent='Scheduler';
  ['clock-in-out.html','my-hours.html','correspondence.html'].forEach(href=>nav.querySelector(`a[href="${href}"]`)?.remove());
  const pipelineLink=nav.querySelector('a[href="lab-work.html"]'),custodyLink=nav.querySelector('a[href="lab-inventory.html"]');
  if(pipelineLink&&custodyLink)pipelineLink.after(custodyLink);
  const accessStore=(()=>{try{return JSON.parse(localStorage.getItem('momentAccessControlV1')||'{}')}catch{return{}}})();
  const savedSession=(()=>{try{return JSON.parse(localStorage.getItem('momentWorkerSessionV1')||'null')}catch{return null}})();
  let profile={id:'owner',name:'Fares',role:'admin',permissions:['*'],active:true};
  if(savedSession?.id&&savedSession.id!=='owner')profile=(accessStore.workers||[]).find(worker=>worker.id===savedSession.id)||null;
  if(!profile||profile.active===false){if(page!=='worker-login.html')location.replace('worker-login.html');return;}
  const permitted=href=>profile.role==='admin'||profile.permissions?.includes('*')||profile.permissions?.includes(href);
  nav.querySelectorAll('.menu-item').forEach(link=>{const href=link.getAttribute('href').toLowerCase();link.classList.toggle('active',href===page);link.setAttribute('data-page-link','');if(!permitted(href))link.remove();});
  if(profile.role!=='admin')nav.querySelector('a[href="admin.html"]')?.remove();
  document.querySelector('#accessProfileName').textContent=profile.name||'Worker';document.querySelector('#accessProfileRole').textContent=profile.role==='admin'?'Administrator':'Worker profile';
  document.querySelector('.switch-profile').textContent=profile.role==='admin'?'Switch profile':'Administrator sign in';
  const unrestricted=['worker-login.html','access-denied.html'];
  if(!unrestricted.includes(page)&&page==='admin.html'&&profile.role!=='admin'){location.replace('access-denied.html');return;}
  if(!unrestricted.includes(page)&&page!=='admin.html'&&!permitted(page)){location.replace('access-denied.html');return;}
  nav.querySelectorAll('a[href]').forEach(link=>{const preload=document.createElement('link');preload.rel='prefetch';preload.href=link.href;document.head.append(preload);});
  const currentPageLabel=nav.querySelector('.menu-item.active span')?.textContent||'Pages';
  const logout=nav.querySelector('#logoutButton');
  if(logout)logout.addEventListener('click',()=>{['momentWorkerSessionV1','boringLogCurrentUser','boringLogCurrentPassword','boringLogSupabaseAccessToken','boringLogSupabaseRefreshToken'].forEach(key=>localStorage.removeItem(key));location.href='worker-login.html';});
  const toggle=document.createElement('button'); toggle.className='moment-menu-toggle'; toggle.type='button'; toggle.setAttribute('aria-label','Switch page'); toggle.setAttribute('aria-controls','momentPageMenu'); toggle.setAttribute('aria-expanded','false'); toggle.innerHTML=`<span class="moment-menu-mark" aria-hidden="true"></span><span class="moment-menu-label"><small>Switch page</small><strong>${currentPageLabel}</strong></span><span class="moment-menu-chevron" aria-hidden="true">⌄</span>`;
  nav.id='momentPageMenu';
  const closeMenu=()=>{document.body.classList.remove('menu-open');toggle.setAttribute('aria-expanded','false');};
  toggle.addEventListener('click',()=>{const open=document.body.classList.toggle('menu-open');toggle.setAttribute('aria-expanded',String(open));});
  document.addEventListener('click',event=>{if(document.body.classList.contains('menu-open')&&!nav.contains(event.target)&&!toggle.contains(event.target))closeMenu();});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&document.body.classList.contains('menu-open')){closeMenu();toggle.focus();}});
  document.body.classList.add('has-moment-menu'); document.body.append(toggle);
  };
  const start=()=>Promise.resolve(cloudReady).finally(init);
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
