import { spawn } from 'node:child_process';
import { setTimeout } from 'node:timers/promises';
const url='http://127.0.0.1:4186/FORMA-TOOL/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port','4186','--strictPort','--base=/FORMA-TOOL/'],{stdio:'pipe',windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
try {
  let ready=false;
  for(let i=0;i<75;i++) {
    if(exited)throw new Error('Production preview could not start. Port 4186 may already be in use.');
    try { const response=await fetch(url);if(response.ok){ready=true;break;} }catch{}
    await setTimeout(200);
  }
  if(!ready)throw new Error('Production preview did not become ready.');
  await import('./check-built.mjs');
} finally { server.kill(); }
