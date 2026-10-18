import {spawn} from 'node:child_process';
import {setTimeout} from 'node:timers/promises';
const url='http://127.0.0.1:5177/';
const server=spawn(process.execPath,['node_modules/vite/bin/vite.js','--host','127.0.0.1','--port','5177','--strictPort'],{stdio:'pipe',windowsHide:true});
let exited=false;server.on('exit',()=>{exited=true;});
try {
  let ready=false;
  for(let i=0;i<75;i++) {
    if(exited)throw new Error('Benchmark server exited; check port 5177.');
    try {if((await fetch(url)).ok){ready=true;break;}}catch{}
    await setTimeout(200);
  }
  if(!ready)throw new Error('Benchmark server did not become ready.');
  process.env.BENCHMARK_URL=url;
  await import('./benchmark-compression.mjs');
} finally {server.kill();}
