import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
test('Blank settings work with direct and hosted require() launchers',async()=>{
 for(const [mode,loader] of [['','direct'],['production','direct'],['production','require']]){
  const dir=await mkdtemp(path.join(os.tmpdir(),'prestige-empty-')),port=30000+Math.floor(Math.random()*10000),origin='http://127.0.0.1:'+port;
  const args=loader==='require'?['--input-type=commonjs','-e',"require('./server.js')"]:['server.js'];
  const child=spawn(process.execPath,args,{env:{...process.env,PORT:String(port),NODE_ENV:mode,APP_SECRET:'',SETUP_TOKEN:'',DB_HOST:'',DB_NAME:'',DB_USER:'',DB_PASSWORD:'',DB_DRIVER:'',SQLITE_PATH:path.join(dir,'unused.sqlite'),AUTOMATION_WEBHOOK_URL:'',AUTOMATION_WEBHOOK_SECRET:'',AUTOMATION_CALLBACK_SECRET:''}});
  try{
   await new Promise((resolve,reject)=>{let output='';child.stdout.on('data',c=>{output+=c;if(output.includes('listening on port'))resolve();});child.once('exit',()=>reject(Error('Server did not start')));setTimeout(()=>reject(Error('Startup timeout')),10000).unref();});
   assert.equal((await fetch(origin+'/')).status,200);
   assert.equal((await fetch(origin+'/assets/app.js')).status,200);
   const bootstrap=await (await fetch(origin+'/api?action=bootstrap')).json();
   assert.equal(bootstrap.configured,false);assert.equal(bootstrap.installed,false);assert.equal(bootstrap.automation,false);assert.equal(bootstrap.user,null);
   const register=await fetch(origin+'/api?action=register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Visitor',email:'visitor@example.test',password:'Visitor-password-123'})});assert.equal(register.status,503);
   const {stat}=await import('node:fs/promises');await assert.rejects(stat(path.join(dir,'unused.sqlite')),e=>e.code==='ENOENT');
  }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
 }
});
test('Node client and agency workflow',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'prestige-node-')),port=19000+Math.floor(Math.random()*10000),origin='http://127.0.0.1:'+port;
 const child=spawn(process.execPath,['server.js'],{env:{...process.env,PORT:String(port),NODE_ENV:'test',DB_DRIVER:'sqlite',SQLITE_PATH:path.join(dir,'db.sqlite'),SETUP_TOKEN:'s'.repeat(40)}});
 let errors='';child.stderr.on('data',c=>errors+=c);
 try{await new Promise((resolve,reject)=>{child.stdout.once('data',resolve);child.once('exit',()=>reject(Error(errors)));setTimeout(()=>reject(Error('Startup timeout '+errors)),10000).unref();});
 const session=()=>({cookie:'',csrf:''});
 async function call(s,action,data){const r=await fetch(origin+'/api?action='+action,{method:data?'POST':'GET',headers:{'Content-Type':'application/json',Cookie:s.cookie,'X-CSRF-Token':s.csrf},body:data?JSON.stringify(data):undefined});if(r.headers.get('set-cookie'))s.cookie=r.headers.get('set-cookie').split(';')[0];const body=await r.json();if(body.csrf)s.csrf=body.csrf;return {status:r.status,...body};}
 const admin=session();await call(admin,'bootstrap');assert.equal((await call(admin,'setup',{token:'s'.repeat(40),name:'Owner',email:'owner@example.test',password:'Owner-password-123'})).user.role,'admin');assert.equal((await call(admin,'setup',{})).status,409);
 const a=session(),b=session();for(const [s,n]of [[a,'a'],[b,'b']]){await call(s,'bootstrap');assert.equal((await call(s,'register',{name:n,email:n+'@example.test',password:'Client-password-123',role:'admin'})).user.role,'client');}
 const brand=await call(a,'brand',{name:'Brand A'});assert.ok(brand.id);assert.equal((await call(b,'brand',{id:brand.id,name:'Stolen'})).status,404);
 const job=await call(a,'job',{brand_id:brand.id,type:'design',title:'Campaign',brief:'Creative brief',format:'4:5'});assert.equal(job.status,'awaiting_connection');assert.equal((await call(b,'workspace')).jobs.length,0);assert.equal((await call(b,'job_update',{id:job.id,operation:'approve'})).status,404);
 assert.equal((await call(a,'job_update',{id:job.id,operation:'deliver'})).status,403);
 assert.equal((await call(admin,'job_update',{id:job.id,operation:'deliver',summary:'Delivery',canva_url:'https://www.canva.com/design/test/edit'})).ok,true);
 assert.equal((await call(a,'workspace')).jobs[0].status,'review');assert.equal((await call(a,'job_update',{id:job.id,operation:'approve'})).ok,true);assert.equal((await call(a,'job_update',{id:job.id,operation:'revision',revision:'Brighter please'})).ok,true);
 assert.equal((await call(b,'enquiry',{name:'Lead',email:'lead@example.test',company:'Business',service:'Design',message:'Quote please'})).ok,true);assert.equal((await call(admin,'workspace')).enquiries.length,1);assert.equal((await call(b,'workspace')).enquiries.length,0);
 const csrf=a.csrf;a.csrf='invalid';assert.equal((await call(a,'brand',{name:'Bad'})).status,403);a.csrf=csrf;
 await call(a,'logout',{});assert.equal((await call(a,'workspace')).status,401);assert.ok((await call(a,'login',{email:'a@example.test',password:'Client-password-123'})).user);
 assert.equal((await fetch(origin+'/server.js')).status,404);assert.equal((await fetch(origin+'/.env')).status,404);assert.equal((await fetch(origin+'/')).status,200);assert.equal((await fetch(origin+'/assets/site.css')).status,200);
 }finally{child.kill();await new Promise(r=>child.once('exit',r));await rm(dir,{recursive:true,force:true});}
});
