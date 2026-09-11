(()=>{
  const supabaseUrl="https://fuivzblvhjuuzhygdeln.supabase.co";
  const supabaseKey="sb_publishable_Kcy_SCyyVSeYWRJLLcV1IA_I1dHFSYe";
  const keys={access:"momentAccessControlV1",worker:"momentWorkerSessionV1",user:"boringLogCurrentUser",password:"boringLogCurrentPassword",token:"boringLogSupabaseAccessToken",refresh:"boringLogSupabaseRefreshToken",onboarded:"momentAdminOnboardedV1"};
  const hash=async value=>{const bytes=new TextEncoder().encode(value),digest=await crypto.subtle.digest("SHA-256",bytes);return[...new Uint8Array(digest)].map(byte=>byte.toString(16).padStart(2,"0")).join("")};
  const readJson=(key,fallback={})=>{try{return JSON.parse(localStorage.getItem(key)||"")||fallback}catch{return fallback}};
  const readAccess=()=>readJson(keys.access,{});
  const setProfile=(id,name)=>{localStorage.setItem(keys.worker,JSON.stringify({id}));localStorage.setItem(keys.user,name)};
  const friendlyError=error=>String(error?.message||error||"Sign in failed.").replace(/^AuthApiError:\s*/i,"");

  document.addEventListener("DOMContentLoaded",()=>{
    const accountForm=document.querySelector("#accountLoginForm"),codeForm=document.querySelector("#codeLoginForm"),description=document.querySelector("#modeDescription"),accountButton=accountForm.querySelector(".primary-button"),actionToggle=document.querySelector("#toggleAccountAction");
    let accountAction="signin";
    const selectMode=mode=>document.querySelector(`[data-login-mode="${mode}"]`).click();
    const lockToCode=()=>{document.body.classList.add("workplace-active");accountForm.hidden=true;codeForm.hidden=false;description.textContent="Workplace verified. Enter your personal or administrator code.";document.querySelector("#accessCode").focus()};

    document.querySelectorAll("[data-login-mode]").forEach(tab=>tab.addEventListener("click",()=>{
      const account=tab.dataset.loginMode==="account";
      document.querySelectorAll("[data-login-mode]").forEach(button=>{button.classList.toggle("active",button===tab);button.setAttribute("aria-selected",String(button===tab))});
      accountForm.hidden=!account;codeForm.hidden=account;
      description.textContent=account?(accountAction==="signup"?"Create the administrator account for this program.":"Use your administrator or program account."):"Enter your profile code after the program account has been verified.";
      (account?document.querySelector("#accountEmail"):document.querySelector("#accessCode")).focus();
    }));

    actionToggle.addEventListener("click",()=>{
      accountAction=accountAction==="signin"?"signup":"signin";
      accountButton.textContent=accountAction==="signup"?"Create program account":"Sign in as administrator";
      actionToggle.textContent=accountAction==="signup"?"I already have a program account":"Create a new program account";
      description.textContent=accountAction==="signup"?"Create the administrator account for this program.":"Use your administrator or program account.";
      document.querySelector("#accountStatus").textContent="";
    });

    const access=readAccess();
    if(!access.ownerHash)document.querySelector("#loginStatus").textContent="Sign in with the program account first so the administrator code can be set up.";
    if(localStorage.getItem(keys.token))lockToCode();

    document.querySelector("#fullLogoutButton").addEventListener("click",async()=>{
      const token=localStorage.getItem(keys.token);
      try{if(token)await fetch(`${supabaseUrl}/auth/v1/logout`,{method:"POST",headers:{apikey:supabaseKey,Authorization:`Bearer ${token}`}})}catch(error){console.warn("Remote logout could not be confirmed.",error)}
      [keys.worker,keys.user,keys.password,keys.token,keys.refresh].forEach(key=>localStorage.removeItem(key));
      location.reload();
    });

    accountForm.addEventListener("submit",async event=>{
      event.preventDefault();
      const status=document.querySelector("#accountStatus"),email=document.querySelector("#accountEmail").value.trim(),password=document.querySelector("#accountPassword").value;
      accountButton.disabled=true;status.textContent=accountAction==="signup"?"Creating account…":"Signing in…";
      try{
        const authPath=accountAction==="signup"?"/auth/v1/signup":"/auth/v1/token?grant_type=password";
        const response=await fetch(`${supabaseUrl}${authPath}`,{method:"POST",headers:{apikey:supabaseKey,"Content-Type":"application/json"},body:JSON.stringify({email,password})});
        const result=await response.json();
        if(!response.ok)throw new Error(result.msg||result.message||result.error_description||"The email or password was not accepted.");
        if(!result.access_token){
          status.textContent="Account created. Check your email to confirm it, then return here to sign in.";
          accountAction="signin";accountButton.textContent="Sign in as administrator";actionToggle.textContent="Create a new program account";return;
        }
        localStorage.setItem(keys.user,email);localStorage.setItem(keys.password,password);localStorage.setItem(keys.token,result.access_token);localStorage.setItem(keys.refresh,result.refresh_token||"");
        const identity=result.user?.id||email.toLowerCase(),onboarded=readJson(keys.onboarded,{}),firstVisit=accountAction==="signup"||!onboarded[identity]||!readAccess().ownerHash;
        if(firstVisit){onboarded[identity]=true;localStorage.setItem(keys.onboarded,JSON.stringify(onboarded));setProfile("owner",email);location.href="admin.html";return}
        status.textContent="Account verified. Enter your profile code to continue.";
        selectMode("code");lockToCode();
      }catch(error){status.textContent=friendlyError(error)}finally{accountButton.disabled=false}
    });

    codeForm.addEventListener("submit",async event=>{
      event.preventDefault();
      const status=document.querySelector("#loginStatus");
      if(!localStorage.getItem(keys.token)){status.textContent="Sign in with the program account first.";selectMode("account");return}
      const current=readAccess();status.textContent="Checking code…";
      const entered=await hash(document.querySelector("#accessCode").value);
      if(current.ownerHash&&entered===current.ownerHash){setProfile("owner","Fares");location.href="admin.html";return}
      const worker=(current.workers||[]).find(item=>item.active!==false&&item.codeHash===entered);
      if(!worker){status.textContent="That code is not active or was not recognized.";return}
      setProfile(worker.id,worker.name||"Worker");
      location.href=worker.permissions?.includes("dashboard.html")?"dashboard.html":worker.permissions?.[0]||"access-denied.html";
    });
  });
})();
