/* Shared, conflict-aware synchronization for every workspace page. */
(() => {
 if(window.MomentWorkspaceCloud)return;
 const URL='https://fuivzblvhjuuzhygdeln.supabase.co',API_KEY='sb_publishable_Kcy_SCyyVSeYWRJLLcV1IA_I1dHFSYe',TABLE='field_app_state';
 const TOKEN='boringLogSupabaseAccessToken',REFRESH='boringLogSupabaseRefreshToken',ACCOUNT='momentWorkspaceAccountV2',TIMES='momentWorkspaceKeyTimesV3';
 const DATA_KEYS=['boringLogAppState','moment-lab-custody-v1','moment-lab-custody-archive-v1','moment-job-calendar-v1','moment-scheduling-contacts-v1','moment-scheduling-team-v1','moment-proposals-v1','moment-project-maps-v1','momentAccessControlV1'];
 const nativeSet=Storage.prototype.setItem,nativeRemove=Storage.prototype.removeItem;
 let account='',base=null,running=null,refreshing=null,timer=0,applying=false,resolution='',conflicts=[],lastStatus={state:'checking',message:'Checking saved data…'};
 const parse=(v,f={})=>{try{return JSON.parse(v)??f}catch{return f}};
 const payload=token=>{try{return parse(atob(token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')))}catch{return{}}};
 const stateIdFor=token=>payload(token||'').sub?`account-${payload(token).sub}`:'';
 const equal=(a,b)=>JSON.stringify(a)===JSON.stringify(b),stamp=()=>new Date().toISOString();
 const editing=()=>!document.querySelector?.('#accountLoginForm')&&Boolean(document.activeElement?.matches?.('input,select,textarea')||document.querySelector?.('dialog[open]'));
 const status=(state,message)=>{lastStatus={state,message,accountId:account,accountEmail:payload(localStorage.getItem(TOKEN)||'').email||''};window.dispatchEvent(new CustomEvent('moment-sync-status',{detail:lastStatus}));};
 const storage=()=>Object.fromEntries(DATA_KEYS.map(key=>[key,localStorage.getItem(key)]));
 const normalizeCloudState=state=>state?.storage?state:{version:2,storage:state?.projects||state?.borings?{boringLogAppState:JSON.stringify(state)}:{}};
 const snapshot=()=>({version:4,accountId:account,keyUpdatedAt:parse(localStorage.getItem(TIMES)),storage:storage()});
 const remember=(label,values)=>{try{nativeSet.call(localStorage,`moment-recovery:${Date.now()}:${label}`,JSON.stringify({accountId:account,storage:values}))}catch{}};
 const identity=item=>item&&typeof item==='object'&&item.id!=null?JSON.stringify([item.projectId||'',String(item.id)]):null;
 function merge(b,l,r,path='',found=[],choice=''){
  if(equal(l,r))return l;if(equal(l,b))return r;if(equal(r,b))return l;
  if(Array.isArray(l)&&Array.isArray(r)&&(b===undefined||Array.isArray(b))){
   const arrays=[b||[],l,r];
   if(arrays.every(a=>a.every(identity)&&new Set(a.map(identity)).size===a.length)){
    const maps=arrays.map(a=>new Map(a.map(i=>[identity(i),i]))),ids=new Set([...maps[2].keys(),...maps[1].keys(),...maps[0].keys()]);
    return [...ids].map(id=>merge(maps[0].get(id),maps[1].get(id),maps[2].get(id),`${path}/${id}`,found,choice)).filter(i=>i!==undefined);
   }
  }
  if(l&&r&&typeof l==='object'&&typeof r==='object'&&!Array.isArray(l)&&!Array.isArray(r)&&(b===undefined||(b&&typeof b==='object'&&!Array.isArray(b)))){
   const result={};for(const key of new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])){const v=merge(b?.[key],l[key],r[key],`${path}/${key}`,found,choice);if(v!==undefined)result[key]=v;}return result;
  }
  if(choice)return choice==='local'?l:r;found.push({path,local:l,remote:r});return l;
 }
 function mergeStorage(baseline,local,remote,choice=''){
  const found=[],merged={};
  for(const key of new Set([...Object.keys(baseline),...Object.keys(local),...Object.keys(remote)])){
   const b=baseline[key]??null,l=local[key]??null,r=remote[key]??null;
   try{const v=merge(b===null?undefined:JSON.parse(b),l===null?undefined:JSON.parse(l),r===null?undefined:JSON.parse(r),key,found,choice);merged[key]=v===undefined?null:JSON.stringify(v)}catch{merged[key]=merge(b,l,r,key,found,choice)}
  }return{storage:merged,conflicts:found};
 }
 async function refreshToken(){
  if(refreshing)return refreshing;
  refreshing=(async()=>{
   const refresh=localStorage.getItem(REFRESH);if(!refresh)throw new Error('Sign in again to sync. Your edits are saved on this device.');
   const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),12000);let response;
   try{response=await fetch(`${URL}/auth/v1/token?grant_type=refresh_token`,{method:'POST',signal:controller.signal,headers:{apikey:API_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:refresh})})}finally{clearTimeout(timeout)}
   const result=await response.json();if(!response.ok||!result.access_token)throw new Error('Sign in again to sync. Your edits are saved on this device.');
   if(account&&payload(result.access_token).sub!==account)throw new Error('Account changed. Saved edits were preserved.');
   nativeSet.call(localStorage,TOKEN,result.access_token);if(result.refresh_token)nativeSet.call(localStorage,REFRESH,result.refresh_token);return result.access_token;
  })().finally(()=>{refreshing=null});return refreshing;
 }
 async function request(path,options={},retry=true){
  let token=localStorage.getItem(TOKEN)||'';if(!token)throw new Error('Sign in to sync between devices.');
  if(payload(token).exp&&payload(token).exp*1000<Date.now()+30000)token=await refreshToken();
  const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),15000);let response;
  try{response=await fetch(`${URL}/rest/v1/${path}`,{...options,cache:'no-store',signal:controller.signal,headers:{apikey:API_KEY,Authorization:`Bearer ${token}`,'Content-Type':'application/json',...options.headers}})}finally{clearTimeout(timeout)}
  if(response.status===401&&retry){await refreshToken();return request(path,options,false)}
  if(!response.ok){const e=new Error(response.status===403?'Cloud access was denied. Your edits remain on this device.':`Cloud sync failed (${response.status}). Your edits remain on this device.`);e.status=response.status;throw e;}
  return response.status===204?null:response.json();
 }
 function apply(values){const changed=[];applying=true;try{for(const key of DATA_KEYS){if(!Object.hasOwn(values,key))continue;const v=values[key];if(localStorage.getItem(key)===v)continue;if(v===null)nativeRemove.call(localStorage,key);else nativeSet.call(localStorage,key,v);changed.push(key)}}finally{applying=false}return changed;}
 async function baselineStore(action,value){
  if(typeof indexedDB==='undefined'){
   if(action==='read')return parse(localStorage.getItem(`momentSyncBaseV4:${account}`),null);
   nativeSet.call(localStorage,`momentSyncBaseV4:${account}`,JSON.stringify(value));return;
  }
  return new Promise((resolve,reject)=>{
   const open=indexedDB.open('moment-workspace-sync-v4',1);
   open.onupgradeneeded=()=>open.result.createObjectStore('baselines');
   open.onerror=()=>reject(open.error);
   open.onsuccess=()=>{
    const db=open.result,tx=db.transaction('baselines',action==='read'?'readonly':'readwrite'),store=tx.objectStore('baselines');
    const request=action==='read'?store.get(account):store.put(value,account);
    let result;
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>{db.close();resolve(action==='read'?(result||parse(localStorage.getItem(`momentSyncBaseV4:${account}`),null)):undefined);};
    tx.onerror=()=>{db.close();reject(tx.error);};
    tx.onabort=()=>{db.close();reject(tx.error);};
   };
  });
 }
 async function cacheBaseline(values){await baselineStore('write',values);base=values;}
 async function synchronize(){
  const token=localStorage.getItem(TOKEN)||'',id=stateIdFor(token),nextAccount=payload(token).sub||'';
  if(!id){status('signed-out','Sign in to sync between devices');return{loaded:false,saved:false}}
  if(navigator.onLine===false){status('offline','Saved on this device · waiting for connection');return{loaded:false,saved:false}}
  if(account!==nextAccount){const previous=localStorage.getItem(ACCOUNT);account=nextAccount;if(previous&&previous!==account){remember(`account-${previous}`,storage());apply(Object.fromEntries(DATA_KEYS.map(key=>[key,null])));nativeRemove.call(localStorage,TIMES)}base=await baselineStore('read');nativeSet.call(localStorage,ACCOUNT,account)}
  status('saving','Syncing changes…');
  for(let attempt=0;attempt<5;attempt++){
   const rows=await request(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=state,updated_at&limit=1`),row=rows?.[0],cloud=normalizeCloudState(row?.state),remote=Object.fromEntries(DATA_KEYS.map(key=>[key,cloud.storage?.[key]??null])),local=storage();
   if(!base){const lt=parse(localStorage.getItem(TIMES)),ct=cloud.keyUpdatedAt||{},initial={};for(const key of DATA_KEYS)initial[key]=local[key]===null||(lt[key]&&ct[key]&&lt[key]<=ct[key])?local[key]:remote[key]===null?null:local[key]===remote[key]?local[key]:null;base=initial;}
   const result=mergeStorage(base,local,remote,resolution);conflicts=result.conflicts;
   if(conflicts.length){remember('conflict-device',local);remember('conflict-cloud',remote);status('conflict',`${conflicts.length} conflicting edits · review before syncing`);return{loaded:Boolean(row),saved:false,conflicts}}
   const merged=result.storage;
   if(!equal(merged,local)&&editing()){
    status('pending','Saved on this device · finish editing to receive cloud updates');
    return{loaded:Boolean(row),saved:false,deferred:true};
   }
   if(!equal(merged,remote)){
    const updatedAt=new Date(Math.max(Date.now(),Date.parse(row?.updated_at || '')+1||0)).toISOString(),state={version:4,accountId:account,storage:merged,keyUpdatedAt:{...(cloud.keyUpdatedAt||{}),...parse(localStorage.getItem(TIMES))}};
    const saved=row?await request(`${TABLE}?id=eq.${encodeURIComponent(id)}&updated_at=${row.updated_at===null?'is.null':`eq.${encodeURIComponent(row.updated_at)}`}`,{method:'PATCH',headers:{Prefer:'return=representation'},body:JSON.stringify({state,updated_at:updatedAt,updated_by:localStorage.getItem('boringLogCurrentUser')||'Workspace user'})}):await request(`${TABLE}?on_conflict=id`,{method:'POST',headers:{Prefer:'resolution=ignore-duplicates,return=representation'},body:JSON.stringify({id,state,updated_at:updatedAt,updated_by:localStorage.getItem('boringLogCurrentUser')||'Workspace user'})});
    if(!saved?.length)continue;
   }
   const current=storage(),after=mergeStorage(local,current,merged,'local').storage;if(!equal(current,after))remember('before-cloud-update',current);
   if(!equal(current,after)&&editing()){
    // Keep the baseline for the view the user actually edited. Unseen remote
    // additions remain remote changes, rather than becoming accidental deletions.
    await cacheBaseline(local);resolution='';
    status('pending','Cloud updates waiting · finish editing to sync');
    return{loaded:Boolean(row),saved:false,deferred:true};
   }
   const changed=apply(after);await cacheBaseline(merged);resolution='';
   if(changed.length)window.dispatchEvent(new CustomEvent('moment-workspace-updated',{detail:{keys:changed}}));
   if(!equal(after,merged)){status('pending','New edits saved on this device · syncing next');scheduleSave()}else status('saved',`Cloud saved · ${new Date().toLocaleTimeString([],{hour:'numeric',minute:'2-digit'})}`);
   return{loaded:Boolean(row),saved:true,changed:changed.length>0};
  }throw new Error('Another device is still saving. Your edits are kept here; retrying shortly.');
 }
 function save(){if(running)return running;running=synchronize().catch(e=>{status(e.message.includes('Sign in')?'signed-out':'error',e.message);throw e}).finally(()=>{running=null});return running;}
 function scheduleSave(){clearTimeout(timer);timer=setTimeout(()=>save().catch(()=>{}),450)}
 Storage.prototype.setItem=function(key,value){const previous=this.getItem(key);try{nativeSet.call(this,key,value)}catch(error){if(this===localStorage&&DATA_KEYS.includes(String(key)))status('error','Device storage is full. Keep this page open and export your work before refreshing.');throw error;}if(this===localStorage&&DATA_KEYS.includes(String(key))&&!applying&&previous!==String(value)){const times=parse(localStorage.getItem(TIMES));times[key]=stamp();nativeSet.call(localStorage,TIMES,JSON.stringify(times));status('pending','Saved on this device · waiting for cloud');scheduleSave()}};
 Storage.prototype.removeItem=function(key){const previous=this.getItem(key);nativeRemove.call(this,key);if(this===localStorage&&DATA_KEYS.includes(String(key))&&!applying&&previous!==null){status('pending','Saved on this device · waiting for cloud');scheduleSave()}};
 const boot=()=>save().catch(()=>({saved:false}));
 async function activate(){
  if(running)await running;
  const token=localStorage.getItem(TOKEN)||'',id=stateIdFor(token);
  if(!id)throw new Error('Sign in to load your Supabase workspace.');
  if(navigator.onLine===false)throw new Error('Connect to the internet to load your Supabase workspace.');
  account=payload(token).sub;
  status('saving','Loading your saved Supabase workspace…');
  const rows=await request(`${TABLE}?id=eq.${encodeURIComponent(id)}&select=state,updated_at&limit=1`);
  const cloud=normalizeCloudState(rows?.[0]?.state),values=Object.fromEntries(DATA_KEYS.map(key=>[key,cloud.storage?.[key]??null]));
  if(!equal(storage(),values))remember('before-account-cloud-load',storage());
  apply(values);await cacheBaseline(values);nativeSet.call(localStorage,ACCOUNT,account);conflicts=[];resolution='';
  status('saved','Supabase workspace loaded');
  return{loaded:true,saved:true};
 }
 window.MomentWorkspaceCloud={boot,activate,save,scheduleSave,snapshot,stateIdFor,normalizeCloudState,getStatus:()=>lastStatus,getConflicts:()=>conflicts,resolveConflicts:choice=>{if(!['local','remote'].includes(choice))throw new Error('Choose which conflicting edits to keep.');resolution=choice;return save()},mergeStorage};
 window.addEventListener('online',boot);window.addEventListener('offline',()=>status('offline','Saved on this device · waiting for connection'));window.addEventListener('focus',()=>{if(!running)boot()});
 window.addEventListener('pageshow',boot);
 window.addEventListener('storage',event=>{if(DATA_KEYS.includes(event.key))window.dispatchEvent(new CustomEvent('moment-workspace-updated',{detail:{keys:[event.key]}}))});
 document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')boot();else if(base&&!equal(storage(),base))save().catch(()=>{})});
 document.addEventListener('focusout',scheduleSave);
 document.addEventListener('close',scheduleSave,true);
 setInterval(()=>{if(document.visibilityState==='visible'&&!running&&!conflicts.length)boot()},20000);
})();
