'use strict';
(() => {
  const originalRender = render;
  let client, user = null, ready = false, busy = false, timer, revision = 0;
  let dirty = false, sending = false, conflict = false, authMode = 'login';
  let status = 'Conectando…', error = '', authBusy = false;
  const localKey = () => `${KEY}:user:${user.id}`;
  const pendingKey = () => `${localKey()}:pending`;
  const valid = data => data?.version === 1 && Array.isArray(data.courses) && data.courses.every(c =>
    typeof c.id === 'string' && /^[\w-]+$/.test(c.id) && typeof c.name === 'string' &&
    Array.isArray(c.students) && Array.isArray(c.criteria) && Array.isArray(c.sessions) &&
    c.students.every(st=>typeof st.name==='string' && /^[\w-]+$/.test(st.id)) &&
    c.criteria.every(k=>typeof k.name==='string' && /^[\w-]+$/.test(k.id) && Array.isArray(k.states) && k.states.length && k.states.every(v=>['yes','part','no'].includes(v))) &&
    c.sessions.every(s=>typeof s.date==='string' && /^\d{4}-\d{2}-\d{2}$/.test(s.date) && /^[\w-]+$/.test(s.id) && Array.isArray(s.students) && Array.isArray(s.criteria) && s.marks && typeof s.marks==='object' &&
      s.students.every(st=>typeof st.name==='string' && /^[\w-]+$/.test(st.id)) && s.criteria.every(k=>typeof k.name==='string' && /^[\w-]+$/.test(k.id) && Array.isArray(k.states) && k.states.every(v=>['yes','part','no'].includes(v)))));
  function exportData(data = db) {
    const blob = new Blob([JSON.stringify(data,null,2)],{type:'application/json'});
    const url=URL.createObjectURL(blob), a=document.createElement('a');
    a.href=url;a.download=`aula-al-dia-${today()}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
  }
  function showError(message) { error=message;render(); }
  function authPage() {
    return `<main class="wrap"><section class="empty"><div class="brand"><span class="mark">✓</span>Aula al día</div><h1>${busy?'Abriendo tus cursos…':user?'No pudimos cargar tus cursos':authMode==='signup'?'Crear mi cuenta':'Entrar a mi aula'}</h1><p>${user?'Tus registros no se han reemplazado.':'Accede a tus cursos e historial desde cualquier dispositivo.'}</p>${!user&&!busy?`<form id="auth-form"><label for="email">Correo electrónico</label><input id="email" name="email" type="email" autocomplete="email" required><label for="password">Contraseña</label><input id="password" name="password" type="password" minlength="8" autocomplete="${authMode==='signup'?'new-password':'current-password'}" required><button class="primary large" style="margin-top:22px" ${authBusy?'disabled':''}>${authBusy?'Un momento…':authMode==='signup'?'Crear cuenta':'Iniciar sesión'}</button></form><button data-cloud="mode" style="margin-top:15px">${authMode==='signup'?'Ya tengo cuenta':'Crear una cuenta'}</button>`:''}<p class="error" role="alert">${esc(error)}</p>${user&&!busy?'<button data-cloud="reload">Volver a cargar</button><button data-cloud="logout">Cerrar sesión</button>':''}</section></main>`;
  }
  render = function() {
    if(!ready) { document.body.classList.remove('projection');app.innerHTML=authPage();return; }
    originalRender();
    const header=app.querySelector('.topbar');
    header.querySelector('.local').textContent=status;
    const controls=document.createElement('div');controls.className='actions cloud-controls';
    controls.innerHTML='<button data-cloud="export">Descargar respaldo</button><button data-cloud="import">Importar respaldo</button><button data-cloud="logout">Cerrar sesión</button>';
    try {const old=JSON.parse(localStorage.getItem(KEY)||'null');if(valid(old)&&old.courses.length){controls.innerHTML+='<button data-cloud="legacy">Recuperar cursos de este navegador</button>';}}catch{}
    header.append(controls);
    if(error){const banner=document.createElement('div');banner.className='save-error';banner.innerHTML=`${esc(error)} <button data-cloud="retry">Reintentar</button>${conflict?'<button data-cloud="reload">Cargar versión de la nube</button>':''}`;header.after(banner);}
  };
  function cache() {
    localStorage.setItem(localKey(),JSON.stringify(db));
    localStorage.setItem(pendingKey(),JSON.stringify({revision,data:db}));
  }
  window.AulaCloud={
    canEdit:()=>ready&&!conflict,
    save() {
      if(!ready||conflict)return false;
      dirty=true;status='Guardando…';
      try {cache();saveFailed=false;}catch{saveFailed=true;error='No se pudo guardar la copia local. Mantén la página abierta hasta completar el guardado en la nube.';}
      clearTimeout(timer);timer=setTimeout(flush,400);return !saveFailed;
    },
    receiveStorage(event) {if(user&&event.key===localKey())showError('Hay otra pestaña con cambios. Usa una sola pestaña para editar y vuelve a cargar antes de continuar.');}
  };
  async function flush() {
    if(!dirty||sending||!ready||conflict)return;
    sending=true; const snapshot=copy(db);dirty=false;
    try {
      const result=await client.rpc('save_aula_records',{document:snapshot,expected_revision:revision});
      if(result.error)throw result.error;
      revision=Number(result.data);status='Guardado en la nube';error='';saveFailed=false;
      try {if(dirty)cache();else localStorage.removeItem(pendingKey());}catch{error='Guardado en la nube; la copia local no está disponible.';}
    }catch(e){
      dirty=true;conflict=String(e.message).includes('AULA_CONFLICT');status='Cambios pendientes';
      error=conflict?'Otro dispositivo guardó cambios. Descarga tu respaldo antes de cargar la versión de la nube. Tus cambios no se sobrescribieron.':'No se pudo guardar en Supabase. Revisa la conexión y que hayas ejecutado supabase-setup.sql. Tus cambios siguen en este dispositivo.';
    }finally{sending=false;render();if(dirty&&!error)void flush();}
  }
  async function loadCloud() {
    if(sending)return;
    busy=true;ready=false;error='';render();
    try {
      const result=await client.from('aula_records').select('data,revision').eq('user_id',user.id).maybeSingle();
      if(result.error)throw result.error;
      const cloud=result.data?.data||{version:1,courses:[]};
      if(!valid(cloud))throw Error('Invalid data');
      revision=Number(result.data?.revision||0);
      const pending=JSON.parse(localStorage.getItem(pendingKey())||'null');
      conflict=false;dirty=false;
      if(pending&&valid(pending.data)){
        db=pending.data;dirty=true;conflict=pending.revision!==revision;
        status='Cambios pendientes';error=conflict?'Hay cambios locales y una versión distinta en la nube. Descarga un respaldo antes de cargar la versión de la nube.':'Hay cambios locales pendientes. Pulsa Reintentar para guardarlos.';
      }else{db=cloud;status='Guardado en la nube';}
      courseId=null;sessionId=null;loadFailed=false;saveFailed=false;ready=true;
    }catch{error='No se pudo abrir el registro. Comprueba tu conexión y ejecuta supabase-setup.sql en SQL Editor de Supabase.';}
    finally{busy=false;render();}
  }
  app.addEventListener('submit',async e=>{
    if(e.target.id!=='auth-form')return;e.preventDefault();if(authBusy||!client)return;
    const data=new FormData(e.target),email=String(data.get('email')).trim(),password=String(data.get('password'));
    authBusy=true;error='';
    e.target.querySelector('button').disabled=true;
    try {
      const result=authMode==='signup'?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
      if(result.error)throw result.error;
      if(result.data.session){user=result.data.session.user;await loadCloud();}
      else{authMode='login';error='Revisa tu correo para confirmar tu cuenta y luego inicia sesión.';}
    }catch{error='No se pudo completar el acceso. Revisa el correo, la contraseña y la confirmación de tu cuenta.';}
    finally{authBusy=false;render();}
  });
  app.addEventListener('click',async e=>{
    const b=e.target.closest('[data-cloud]');if(!b)return;
    switch(b.dataset.cloud){
      case'mode':authMode=authMode==='login'?'signup':'login';error='';render();break;
      case'export':exportData();break;
      case'legacy': {
        if(conflict||sending){toast('Resuelve primero los cambios pendientes.');return;}
        try {const old=JSON.parse(localStorage.getItem(KEY));if(!valid(old))throw Error();
          if(!confirm('¿Agregar los cursos locales a esta cuenta? Los cursos existentes se conservarán.'))return;
          for(const item of old.courses){if(!db.courses.some(c=>c.id===item.id))db.courses.push(copy(item));}
          save();render();
        }catch{toast('No se pudo leer el registro local.');}break;
      }
      case'retry':if(!conflict)void flush();break;
      case'logout':
        if(dirty||sending){toast('Guarda los cambios pendientes o descarga un respaldo antes de cerrar sesión.');return;}
        if(client){const result=await client.auth.signOut();if(result.error){toast('No se pudo cerrar sesión.');return;}}
        user=null;ready=false;db={version:1,courses:[]};courseId=null;sessionId=null;error='';render();break;
      case'reload':
        if(dirty){exportData();if(!confirm('Se descargó una copia de tus cambios. ¿Cargar la versión de la nube? Los cambios pendientes seguirán en ese respaldo.'))return;localStorage.removeItem(pendingKey());dirty=false;}
        await loadCloud();break;
      case'import': {
        if(conflict||sending){toast('Resuelve primero los cambios pendientes.');return;}
        const input=document.createElement('input');input.type='file';input.accept='.json,application/json';
        input.onchange=async()=>{
          try{const data=JSON.parse(await input.files[0].text());if(!valid(data))throw Error();
            if(!confirm('¿Agregar los cursos del respaldo a tu cuenta? Si un curso ya existe, se importará como una copia.'))return;
            for(const item of data.courses){const c=copy(item);if(db.courses.some(x=>x.id===c.id)){c.id=uid();c.name+=' (respaldo)';}db.courses.push(c);}
            save();render();
          }catch{toast('No se pudo importar. Elige un respaldo válido de Aula al día.');}
        };input.click();break;
      }
    }
  });
  window.addEventListener('beforeunload',e=>{if(dirty||sending){e.preventDefault();e.returnValue='';}});
  window.addEventListener('online',()=>{if(dirty&&!conflict)void flush();});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden'&&dirty)void flush();});
  async function initialize(){
    render();
    if(!window.supabase){showError('No se pudo cargar la conexión. Revisa Internet y recarga la página.');return;}
    client=window.supabase.createClient(AULA_CONFIG.url,AULA_CONFIG.publishableKey);
    const result=await client.auth.getSession();
    if(result.error){showError('No se pudo recuperar la sesión. Recarga la página.');return;}
    if(result.data.session){user=result.data.session.user;await loadCloud();}else{status='Inicia sesión';render();}
    client.auth.onAuthStateChange((event,session)=>{if(event==='SIGNED_OUT'){user=null;ready=false;db={version:1,courses:[]};render();}else if(event==='TOKEN_REFRESHED'&&session)user=session.user;});
  }
  void initialize();
})();
