'use strict';
(() => {
  const root=document.getElementById('prestige-draft'), dialog=document.getElementById('studio-dialog'), workspace=document.getElementById('workspace');
  const state={csrf:'',user:null,configured:false,installed:false,automation:false,brands:[],jobs:[],enquiries:[],page:'brands',service:'design',loading:false};
  const serviceNames={design:'Graphic design',social:'Social media',video:'Videos',ads:'Ads management'};
  const serviceIcons={design:'pen-tool',social:'messages-square',video:'clapperboard',ads:'megaphone'};
  const statusNames={awaiting_connection:'Saved for production',queued:'Queued',dispatching:'Sending to workflow',processing:'In production',review:'Ready for review',approved:'Approved',failed:'Needs attention'};
  const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const icon=n=>`<i data-lucide="${n}" aria-hidden="true"></i>`;
  const date=v=>{const d=new Date(String(v).replace(' ','T')+'Z');return isNaN(d)?'':d.toLocaleDateString(undefined,{month:'short',day:'numeric',year:'numeric'});};
  const safeLink=u=>{try{const parsed=new URL(u);return parsed.protocol==='https:'?esc(parsed.href):'';}catch{return '';}};
  const icons=()=>{if(window.lucide)window.lucide.createIcons({attrs:{width:18,height:18,'stroke-width':1.5}});};
  function toast(message){const el=document.getElementById('toast');el.textContent=message;el.hidden=false;clearTimeout(toast.timer);toast.timer=setTimeout(()=>{el.hidden=true;},4500);}
  async function api(action,data,params={}){
    const res=await fetch(`api/index.php?${new URLSearchParams({action,...params})}`,{method:data===undefined?'GET':'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','X-CSRF-Token':state.csrf},...(data===undefined?{}:{body:JSON.stringify(data)})});
    let result;try{result=await res.json();}catch{throw new Error('The server is not ready. Please complete the hosting setup.');}
    if(!res.ok)throw new Error(result.error||'Unable to complete the request.');
    return result;
  }
  function showDialog(title,subtitle,content){
    dialog.innerHTML=`<div class="app-dialog-head"><div><h2 id="dialog-title">${esc(title)}</h2>${subtitle?`<p>${esc(subtitle)}</p>`:''}</div><button type="button" class="app-close" data-close aria-label="Close dialog">${icon('x')}</button></div>${content}`;
    if(!dialog.open)dialog.showModal();icons();
  }
  function field(label,name,value='',type='text',required=true){return `<label class="app-field">${esc(label)}<input type="${type}" name="${name}" value="${esc(value)}" ${required?'required':''} ${type==='password'?'minlength="12" maxlength="200" autocomplete="new-password"':'maxlength="500"'}></label>`;}
  function textArea(label,name,value='',max=5000,required=false){return `<label class="app-field">${esc(label)}<textarea name="${name}" rows="4" maxlength="${max}" ${required?'required':''}>${esc(value)}</textarea></label>`;}
  function formError(form,message){let el=form.querySelector('[role=alert]');if(!el){el=document.createElement('p');el.className='app-error';el.setAttribute('role','alert');form.prepend(el);}el.textContent=message;}
  function bindForm(form,handler){form.addEventListener('submit',async e=>{e.preventDefault();const btn=form.querySelector('[type=submit]');btn.disabled=true;try{await handler(Object.fromEntries(new FormData(form)));}catch(error){formError(form,error.message);}finally{btn.disabled=false;}});}
  function auth(mode='login'){
    if(!state.installed){showDialog('The studio is getting ready.','Client access will be available after the hosting setup is complete.','<p class="app-hint">Please check back shortly.</p>');return;}
    const register=mode==='register';
    showDialog(register?'Your brand starts here.':'Welcome back.',register?'Create your client account and build your brand profile.':'Sign in to manage brands, requests and deliverables.',`<form class="app-form" id="auth-form">${register?field('Your name','name'):''}${field('Email address','email','','email')}<label class="app-field">Password<input name="password" type="password" required ${register?'minlength="12"':''} maxlength="200" autocomplete="${register?'new-password':'current-password'}"></label>${register?'<p class="app-hint">Use at least 12 characters. Keep this password somewhere safe.</p>':''}<button class="app-btn primary" type="submit">${register?'Create account':'Sign in'} ${icon('arrow-up-right')}</button><button class="app-link" type="button" data-auth-switch="${register?'login':'register'}">${register?'Already have an account? Sign in':'New here? Create your account'}</button>${!register?'<p class="app-hint">For password help, contact your Prestige Inmedia account manager.</p>':''}</form>`);
    bindForm(document.getElementById('auth-form'),async data=>{const r=await api(mode,data);state.user=r.user;dialog.close();location.hash='portal';await loadWorkspace();});
  }
  function contact(service=''){
    showDialog('Let’s build your brand.','Tell the studio what you have in mind. Your request goes directly to the agency dashboard.',`<form class="app-form" id="contact-form"><div class="app-two">${field('Your name','name')}${field('Email address','email','','email')}</div>${field('Business / brand name','company')}<label class="app-field">What do you need?<select name="service">${['Graphic design','Social media management','Video production','Ads management','Full agency package'].map(v=>`<option ${v===service?'selected':''}>${v}</option>`).join('')}</select></label>${textArea('Tell us about your project','message','',5000,true)}<label class="app-honeypot" aria-hidden="true">Leave empty<input name="website_extra" tabindex="-1" autocomplete="off"></label><p class="app-hint">Your details are used to respond to this enquiry.</p><button class="app-btn primary" type="submit">Send enquiry ${icon('arrow-up-right')}</button></form>`);
    bindForm(document.getElementById('contact-form'),async data=>{const r=await api('enquiry',data);showDialog('Your enquiry is in.','Prestige Inmedia has received your project details.',`<div class="app-success">Reference: ${esc(r.reference)}<br>The studio will reply using the email address you supplied.</div>`);});
  }
  function setScreen(page){
    root.querySelectorAll('[data-screen]').forEach(el=>el.hidden=el.dataset.screen!==page);
    root.querySelectorAll('.pi-link[data-page]').forEach(el=>{if(el.dataset.page===page)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');});
    root.querySelector('.pi-link[data-page=workspace]').textContent=state.user?'My workspace':'Client login';
    document.title=page==='home'?'Prestige Inmedia — Brands. Content. Impact.':'Client workspace — Prestige Inmedia';
  }
  function status(j){return `<span class="app-status ${esc(j.status)}">${esc(statusNames[j.status]||j.status)}</span>`;}
  function shell(content){
    const admin=state.user?.role==='admin';
    const nav=[['brands','fingerprint','Brand profiles'],['requests','layers-3',admin?'All requests':'My requests'],['create','sparkles','New request'],...(admin?[['enquiries','inbox','Enquiries'],['connections','workflow','Connections']]:[])];
    workspace.innerHTML=`<div class="app-shell"><aside class="app-sidebar"><div class="app-person"><b>${esc(state.user.name)}</b><small>${admin?'Agency administrator':'Client workspace'}</small></div><nav class="app-nav" aria-label="Workspace">${nav.map(([p,i,l])=>`<button type="button" data-work-page="${p}" ${state.page===p?'aria-current="page"':''}>${icon(i)}${l}</button>`).join('')}</nav><div class="app-sidebar-foot"><p class="app-hint">Every brand.<br>One creative home.</p><button type="button" class="app-link" data-logout>Sign out</button></div></aside><section class="app-main">${content}</section></div>`;icons();
  }
  const pageHead=(title,copy,action='')=>`<div class="app-page-head"><div><h1>${title}</h1><p>${copy}</p></div>${action}</div>`;
  async function loadWorkspace(){
    setScreen('workspace');
    if(!state.user){workspace.innerHTML=`<section class="app-login-splash"><span class="app-glass-icon">${icon('fingerprint')}</span><h1>Your brand’s creative home.</h1><p>Keep brand profiles, briefs, revisions and deliverables in one place.</p><div class="app-action-row" style="justify-content:center"><button class="app-btn primary" type="button" data-login>Client sign in ${icon('arrow-up-right')}</button><button class="app-btn" type="button" data-register>Create an account</button></div></section>`;icons();return;}
    try{const r=await api('workspace');Object.assign(state,r);renderWorkspace();}catch(e){shell(pageHead('Unable to load your workspace.',esc(e.message),'<button class="app-btn" data-refresh>Try again</button>'));}
  }
  function renderWorkspace(){
    if(state.page==='brands') renderBrands();
    else if(state.page==='requests') renderRequests();
    else if(state.page==='create') renderCreate();
    else if(state.page==='enquiries') renderEnquiries();
    else if(state.page==='connections') renderConnections();
  }
  function renderBrands(){
    const cards=state.brands.map(b=>`<article class="app-brand-card"><span class="app-glass-icon">${icon('fingerprint')}</span><h2>${esc(b.name)}</h2><p>${esc(b.description||'Add your products, audience and brand direction.')}</p><div class="app-color-row">${b.palette.split(/[ ,]+/).filter(c=>/^#[0-9a-f]{6}$/i.test(c)).map(c=>`<span class="app-swatch" style="background:${c}" aria-label="${c}"></span>`).join('')}</div><div class="app-meta">${esc(b.services||'Brand profile')}</div><button type="button" class="app-btn" data-edit-brand="${b.id}">Edit brand profile ${icon('arrow-up-right')}</button></article>`).join('');
    shell(pageHead('Your brands.','Build a shared source for every brand’s identity, products and voice.','<button type="button" class="app-btn primary" data-new-brand>Add a brand '+icon('plus')+'</button>')+(cards?`<div class="app-brand-grid">${cards}</div>`:`<div class="app-empty"><span class="app-glass-icon">${icon('fingerprint')}</span><h2>Start with your brand.</h2><p>Add your brand details so every creative request has the right context.</p><button class="app-btn primary" type="button" data-new-brand>Create brand profile ${icon('plus')}</button></div>`));
  }
  function editBrand(id=''){
    const b=state.brands.find(x=>x.id===id)||{};
    showDialog(id?'Refine your brand.':'Introduce your brand.','The creative workflow uses this profile as its starting point.',`<form class="app-form" id="brand-form"><input type="hidden" name="id" value="${esc(id)}">${field('Brand name','name',b.name)}${field('Website or social profile URL','website',b.website,'url',false)}${textArea('What does your brand do?','description',b.description)}${textArea('Who is your audience?','audience',b.audience,3000)}${field('Tone of voice','tone',b.tone||'Warm, clear and confident','text',false)}${field('Brand colours — comma-separated hex values','palette',b.palette||'#0840db, #b6ff00','text',false)}${field('Services needed','services',b.services||'Graphic design, Social media','text',false)}<button type="submit" class="app-btn primary">Save brand profile ${icon('check')}</button></form>`);
    bindForm(document.getElementById('brand-form'),async data=>{await api('brand',data);dialog.close();await loadWorkspace();toast('Brand profile saved.');});
  }
  function renderCreate(){
    if(!state.brands.length){shell(pageHead('Create a request.','Every great creative starts with a clear brief.')+`<div class="app-empty"><span class="app-glass-icon">${icon('fingerprint')}</span><h2>Add a brand first.</h2><p>Your brand profile gives the creative workflow the context it needs.</p><button class="app-btn primary" type="button" data-new-brand>Create brand profile ${icon('plus')}</button></div>`);return;}
    const options=Object.entries(serviceNames).map(([k,n])=>`<button class="app-service-option" type="button" data-request-service="${k}" aria-pressed="${state.service===k}">${icon(serviceIcons[k])}${n}</button>`).join('');
    shell(pageHead('Make something great.','Choose a service and tell the studio what you want to create.')+(!state.automation?'<div class="app-notice">Your request will be saved for the Prestige Inmedia team to handle. Automated production will be available once the creative workflow is connected.</div>':'<div class="app-notice">Your request will be queued for the connected creative workflow. Finished work comes back here for your review.</div>')+`<div class="app-panel"><form class="app-form" id="request-form"><div class="app-service-options">${options}</div><div class="app-two"><label class="app-field">Brand<select name="brand_id">${state.brands.map(b=>`<option value="${b.id}">${esc(b.name)}</option>`).join('')}</select></label><label class="app-field">Deliverable format<select name="format"><option>Instagram portrait · 4:5</option><option>Instagram carousel · 4:5</option><option>Story / Reel · 9:16</option><option>Square · 1:1</option><option>Content plan</option><option>Campaign plan</option><option>Custom brief</option></select></label></div>${field('Campaign / request title','title')}${textArea('Your creative brief','brief','',10000,true)}<p class="app-hint">Include your goal, offer, key product facts, deadline and links to source assets or references. Grant the agency access to any private asset links.</p><button type="submit" class="app-btn primary">Submit request ${icon('arrow-up-right')}</button></form></div>`);
    bindForm(document.getElementById('request-form'),async data=>{await api('job',{...data,type:state.service});state.page='requests';await loadWorkspace();toast('Your creative request has been saved.');});
  }
  function renderRequests(){
    const rows=state.jobs.map(j=>`<article class="app-job-row"><div><h3>${esc(j.title)}</h3><div class="app-meta"><span>${esc(j.brand_name)}</span><span>·</span><span>${esc(serviceNames[j.type])}</span><span>·</span><span>${date(j.created_at)}</span></div></div><div class="app-job-actions">${status(j)}<button type="button" class="app-btn" data-job="${j.id}">View request ${icon('arrow-up-right')}</button></div></article>`).join('');
    shell(pageHead('Your creative pipeline.','Track requests, review deliverables and keep feedback together.','<button type="button" class="app-btn" data-refresh>Refresh '+icon('refresh-cw')+'</button>')+(rows?`<div class="app-list">${rows}</div>`:`<div class="app-empty"><span class="app-glass-icon">${icon('layers-3')}</span><h2>Your next idea belongs here.</h2><p>Submit a brief to get your creative pipeline moving.</p><button class="app-btn primary" data-work-page="create">Create a request ${icon('plus')}</button></div>`));
  }
  async function viewJob(id){
    const j=state.jobs.find(x=>x.id===id);if(!j)return;const result=j.result||{};
    const canva=safeLink(result.canva_url),download=safeLink(result.download_url);
    showDialog(j.title,`${j.brand_name} · ${serviceNames[j.type]}`,`${status(j)}<p class="app-kicker" style="margin-top:21px">The brief</p><p class="app-detail">${esc(j.brief)}</p>${j.revision?`<p class="app-kicker">Revision feedback</p><p class="app-detail">${esc(j.revision)}</p>`:''}${result.summary?`<p class="app-kicker">Creative delivery</p><p class="app-detail">${esc(result.summary)}</p>`:''}${result.caption?`<p class="app-kicker">Caption</p><p class="app-detail">${esc(result.caption)}</p>`:''}<div class="app-delivery-links">${canva?`<a class="app-btn primary" href="${canva}" target="_blank" rel="noopener noreferrer">Open in Canva ${icon('external-link')}</a>`:''}${download?`<a class="app-btn" href="${download}" target="_blank" rel="noopener noreferrer">View deliverables ${icon('external-link')}</a>`:''}</div>${j.status==='review'?`<div class="app-action-row"><button class="app-btn primary" data-approve="${id}">Approve creative ${icon('check')}</button><button class="app-btn" data-revision="${id}">Request changes</button></div>`:''}${state.user.role==='admin'?`<div class="app-action-row"><button class="app-btn" data-deliver="${id}">Deliver work ${icon('package-check')}</button>${['failed','awaiting_connection'].includes(j.status)?`<button class="app-btn" data-retry="${id}">Queue for workflow ${icon('refresh-cw')}</button>`:''}</div>`:''}<div id="job-events" style="margin-top:24px"></div>`);
    try{const r=await api('events',undefined,{id});const el=document.getElementById('job-events');if(el&&dialog.open)el.innerHTML='<ul class="app-timeline">'+r.events.map(e=>`<li><small>${date(e.created_at)}</small>${esc(e.message)}</li>`).join('')+'</ul>';}catch{/* Core request details remain usable. */}
  }
  function deliverJob(id){
    const j=state.jobs.find(x=>x.id===id),r=j.result||{};
    showDialog('Deliver creative work.','Send a summary and secure links back to the client for review.',`<form id="delivery-form" class="app-form">${textArea('Delivery summary','summary',r.summary,6000,true)}${field('Editable Canva URL','canva_url',r.canva_url,'url',false)}${field('Deliverables / download URL','download_url',r.download_url,'url',false)}<button class="app-btn primary" type="submit">Send for review ${icon('send')}</button></form>`);
    bindForm(document.getElementById('delivery-form'),async data=>{await api('job_update',{...data,id,operation:'deliver'});dialog.close();await loadWorkspace();toast('Creative delivery saved for client review.');});
  }
  function reviseJob(id){
    showDialog('Let’s refine it.','Be specific about what should change.',`<form id="revision-form" class="app-form">${textArea('Your feedback','revision','',4000,true)}<button class="app-btn primary" type="submit">Submit feedback ${icon('send')}</button></form>`);
    bindForm(document.getElementById('revision-form'),async data=>{await api('job_update',{...data,id,operation:'revision'});dialog.close();await loadWorkspace();toast('Revision feedback saved.');});
  }
  function renderEnquiries(){
    const rows=state.enquiries.map(l=>`<article class="app-panel"><div class="app-page-head"><div><h2>${esc(l.company)}</h2><p>${esc(l.name)} · ${esc(l.email)}<br>${esc(l.service)} · ${date(l.created_at)}</p></div><span class="app-status">${esc(l.status)}</span></div><p class="app-detail">${esc(l.message)}</p><div class="app-action-row"><a class="app-btn" href="mailto:${esc(l.email)}">Reply by email ${icon('mail')}</a><button class="app-btn" type="button" data-lead="${l.id}" data-status="contacted">Mark contacted</button><button class="app-btn" type="button" data-lead="${l.id}" data-status="closed">Close enquiry</button></div></article>`).join('');
    shell(pageHead('New conversations.','Project enquiries from the public website arrive here.')+(rows||'<div class="app-empty"><span class="app-glass-icon">'+icon('inbox')+'</span><h2>No enquiries yet.</h2><p>Enquiries submitted on the website will appear here.</p></div>'));
  }
  function renderConnections(){shell(pageHead('Connect the creative engine.','Keep client work moving through one managed production workflow.')+`<div class="app-panel"><h2>${state.automation?'Workflow configured':'Workflow not connected'}</h2><p class="app-detail">${state.automation?'The server is configured to dispatch requests to your automation workflow. Confirm the cron job is enabled and review the request timeline for successful deliveries.':'Creative requests are stored for agency handling. Connect your automation webhook and enable the Hostinger cron job to start automatic dispatch.'}</p><p class="app-hint">The deployment guide includes the webhook contract, callback format and recommended Claude → Canva workflow. Keys and secrets are configured on the server.</p></div><div class="app-panel"><h2>Publishing and ads</h2><p class="app-detail">This release handles briefs, production requests, deliveries and approvals. Social publishing, paid ad execution and video rendering run in the connected workflow. No posts or ad spend are triggered by this website alone.</p></div>`);}
  function setup(){
    if(state.installed){toast('Setup has already been completed.');location.hash='portal';return;}
    showDialog('Set up Prestige Inmedia.','For the website owner. Enter the setup token from your private server configuration.',`<form id="setup-form" class="app-form">${field('Setup token','token','','password')}${field('Administrator name','name')}${field('Administrator email','email','','email')}${field('Administrator password','password','','password')}<button type="submit" class="app-btn primary">Create agency account ${icon('shield-check')}</button><p class="app-hint">This installer closes automatically once the administrator account exists.</p></form>`);
    bindForm(document.getElementById('setup-form'),async data=>{const r=await api('setup',data);state.user=r.user;state.installed=true;dialog.close();location.hash='portal';await loadWorkspace();});
  }
  const details={design:['Design that knows your brand.','Start with your brand, audience and goals. Turn a researched creative direction into Canva designs you can review, revise and reuse.',['Social posts','Carousels','Campaign visuals','Editable Canva files']],social:['A consistent presence, every week.','Bring strategy, captions and planning together. Review your content plan and prepare work for your publishing workflow.',['Content strategy','Captions','Content plans','Channel direction']],video:['Give your brand a moving story.','Move from a clear brief to scripts, storyboards, editing and subtitles. Use your footage or a connected production service.',['Reels','Video editing','Motion graphics','Storyboards']],ads:['Creative meets campaign performance.','Plan audience, creative variations and campaign goals. Agency management and connected tools handle paid campaign execution.',['Campaign planning','Ad creatives','Audience direction','Reporting briefs']]};
  let selectedService='design';
  function pickService(type){selectedService=type;const d=details[type];root.querySelectorAll('[data-service]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.service===type)));root.querySelector('[data-service-title]').textContent=d[0];root.querySelector('[data-service-copy]').textContent=d[1];root.querySelector('[data-service-tags]').innerHTML=d[2].map(t=>`<span class="pi-tag">${esc(t)}</span>`).join('');const box=root.querySelector('.pi-service-detail .pi-iconbox');box.innerHTML=icon(serviceIcons[type]);root.querySelector('[data-try-service]').innerHTML=`Start a ${type==='design'?'design':type==='social'?'social media':type==='video'?'video':'campaign'} request ${icon('arrow-right')}`;icons();}
  async function startRequest(service){state.service=service;state.page='create';location.hash='portal';await loadWorkspace();if(!state.user)auth('register');}
  document.addEventListener('click',async e=>{
    const button=e.target.closest('button,a');if(!button)return;
    try{
      if(button.hasAttribute('data-close'))dialog.close();
      else if(button.hasAttribute('data-login'))auth();
      else if(button.hasAttribute('data-register'))auth('register');
      else if(button.dataset.authSwitch)auth(button.dataset.authSwitch);
      else if(button.hasAttribute('data-contact'))contact();
      else if(button.dataset.page){location.hash=button.dataset.page==='home'?'home':'portal';if(button.dataset.page==='workspace'&&!state.user)auth();}
      else if(button.dataset.section)document.getElementById(button.dataset.section)?.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth'});
      else if(button.dataset.service)pickService(button.dataset.service);
      else if(button.hasAttribute('data-try-service'))await startRequest(selectedService);
      else if(button.dataset.openTool)await startRequest(button.dataset.openTool);
      else if(button.dataset.plan)contact(button.dataset.plan==='Growth Engine'?'Full agency package':button.dataset.plan==='Content Partner'?'Social media management':'Graphic design');
      else if(button.dataset.workPage){state.page=button.dataset.workPage;renderWorkspace();}
      else if(button.dataset.requestService){state.service=button.dataset.requestService;workspace.querySelectorAll('[data-request-service]').forEach(b=>b.setAttribute('aria-pressed',String(b===button)));}
      else if(button.hasAttribute('data-new-brand'))editBrand();
      else if(button.dataset.editBrand)editBrand(button.dataset.editBrand);
      else if(button.dataset.job)await viewJob(button.dataset.job);
      else if(button.dataset.deliver)deliverJob(button.dataset.deliver);
      else if(button.dataset.revision)reviseJob(button.dataset.revision);
      else if(button.dataset.approve||button.dataset.retry){await api('job_update',{id:button.dataset.approve||button.dataset.retry,operation:button.dataset.approve?'approve':'retry'});dialog.close();await loadWorkspace();toast(button.dataset.approve?'Creative approved.':'Request status updated.');}
      else if(button.dataset.lead){await api('enquiry_update',{id:button.dataset.lead,status:button.dataset.status});await loadWorkspace();toast('Enquiry updated.');}
      else if(button.hasAttribute('data-refresh'))await loadWorkspace();
      else if(button.hasAttribute('data-logout')){const r=await api('logout',{});state.csrf=r.csrf;state.user=null;state.brands=[];state.jobs=[];state.enquiries=[];location.hash='home';setScreen('home');toast('Signed out.');}
    }catch(error){toast(error.message);}
  });
  dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
  async function route(){if(location.hash==='#setup'){setup();return;}if(location.hash==='#portal'){await loadWorkspace();}else{setScreen('home');}}
  window.addEventListener('hashchange',route);
  async function init(){icons();try{const r=await api('bootstrap');Object.assign(state,r);}catch{state.configured=false;}await route();}
  init();
})();
