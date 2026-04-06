import type { Project, Asset } from '../types'

type ProgressCallback = (pct: number, msg: string) => void

function mimeFromFilename(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
    gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
    mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav',
    flac: 'audio/flac', m4a: 'audio/mp4'
  }
  return map[ext] ?? 'application/octet-stream'
}

export async function generateHtmlExport(
  project: Project,
  onProgress: ProgressCallback
): Promise<string> {
  // Build asset map: assetId → data URI
  const assetMap: Record<string, string> = {}
  const assets = project.assets.filter(a => a.path)

  for (let i = 0; i < assets.length; i++) {
    const asset = assets[i]
    onProgress(Math.round((i / Math.max(assets.length, 1)) * 80), `Encoding ${asset.name}…`)
    const b64 = await window.electronAPI?.readFileBase64(asset.path)
    if (b64) {
      const mime = mimeFromFilename(asset.filename)
      assetMap[asset.id] = `data:${mime};base64,${b64}`
    }
  }

  onProgress(85, 'Assembling HTML…')

  const storyData = JSON.stringify({
    nodes: project.nodes,
    edges: project.edges,
    characters: project.characters,
    variables: project.variables,
    assetMap
  })

  const html = buildHtml(project.name, storyData)
  onProgress(100, 'Done')
  return html
}

function buildHtml(title: string, storyDataJson: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#000;color:#e8ecf4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;height:100vh;overflow:hidden;user-select:none}
#vn{position:relative;width:100vw;height:100vh;cursor:pointer;display:flex;flex-direction:column}
#bg{position:absolute;inset:0;background:linear-gradient(to bottom,#050810,#0a1020)}
#bg img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover}
#chars{position:absolute;bottom:160px;left:0;right:0;display:flex;align-items:flex-end;justify-content:space-around;padding:0 60px;pointer-events:none}
.char-slot{flex:1;display:flex;justify-content:center}
.char-slot img{max-height:60vh;object-fit:contain;transition:opacity .3s,filter .3s}
.char-placeholder{width:120px;height:300px;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:24px;font-weight:700}
#dlg{position:absolute;bottom:0;left:0;right:0;background:rgba(8,12,24,.92);border-top:1px solid #2a3448;padding:18px 60px 24px;min-height:150px;backdrop-filter:blur(4px);transition:opacity .4s}
#dlg-name{font-size:16px;font-weight:700;margin-bottom:8px}
#dlg-text{font-size:16px;line-height:1.7;max-width:800px}
#dlg-hint{position:absolute;bottom:10px;right:20px;color:#3a4a68;font-size:11px}
#choices{position:absolute;bottom:60px;left:50%;transform:translateX(-50%);display:flex;flex-direction:column;gap:12px;min-width:400px;max-width:600px}
.choice-btn{background:rgba(10,18,40,.95);border:1px solid #3a4a68;border-radius:8px;padding:14px 20px;color:#e8ecf4;font-size:15px;cursor:pointer;text-align:left;backdrop-filter:blur(4px);transition:border-color .2s,background .2s;font-family:inherit}
.choice-btn:hover{border-color:#4a80d4;background:rgba(20,40,80,.95)}
.choice-letter{color:#d4a040;font-weight:700;margin-right:10px}
#end{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(0,0,0,.7)}
#end h1{font-size:32px;font-weight:700;margin-bottom:8px}
#end p{font-size:18px;color:#9aa5bb;margin-bottom:32px}
#restart-btn{background:#1a3060;border:1px solid #4a80d4;color:#4a80d4;border-radius:8px;padding:10px 24px;font-size:14px;cursor:pointer;font-family:inherit}
#restart-btn:hover{background:#2a4070}
#hud{position:absolute;top:12px;left:12px;z-index:10}
#hud button{background:rgba(0,0,0,.6);border:1px solid #2a3448;color:#9aa5bb;padding:4px 12px;border-radius:6px;cursor:pointer;font-size:12px;font-family:inherit}
#hud button:hover{border-color:#4a80d4;color:#e8ecf4}
.fade-in{animation:fadeIn .5s ease forwards}
.slide-left{animation:slideLeft .5s ease forwards}
.slide-right{animation:slideRight .5s ease forwards}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}
@keyframes slideLeft{from{opacity:0;transform:translateX(-30px)}to{opacity:1;transform:none}}
@keyframes slideRight{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
</style>
</head>
<body>
<div id="vn">
  <div id="bg"><div id="bg-inner"></div></div>
  <div id="chars">
    <div class="char-slot" id="char-left"></div>
    <div class="char-slot" id="char-center"></div>
    <div class="char-slot" id="char-right"></div>
  </div>
  <div id="dlg" style="display:none">
    <div id="dlg-name"></div>
    <div id="dlg-text"></div>
    <div id="dlg-hint">Click or Space to continue</div>
  </div>
  <div id="choices" style="display:none"></div>
  <div id="end" style="display:none">
    <h1 id="end-title">The End</h1>
    <p id="end-sub"></p>
    <button id="restart-btn" onclick="restart()">Play Again</button>
  </div>
  <div id="hud">
    <button onclick="goBack()">◀ Back</button>
  </div>
</div>
<script>
const STORY = ${storyDataJson};

// ── Variable helpers ──────────────────────────────────────────────────────
function buildDefaultState(variables){
  const s={};variables.forEach(v=>{s[v.id]=v.defaultValue});return s;
}
function applyEffects(state,effects){
  const s={...state};
  effects.forEach(e=>{
    if(e.operation==='set')s[e.variableId]=e.value;
    else if(e.operation==='add')s[e.variableId]=(Number(s[e.variableId])||0)+Number(e.value);
    else if(e.operation==='subtract')s[e.variableId]=(Number(s[e.variableId])||0)-Number(e.value);
    else if(e.operation==='toggle')s[e.variableId]=!s[e.variableId];
  });
  return s;
}
function applyBranchEffects(state,effects,variables){
  const s={...state};
  effects.forEach(eff=>{
    eff=eff.trim();const am=eff.match(/^(\\w+)\\s*\\+\\s*(\\d+)$/),sm=eff.match(/^(\\w+)\\s*-\\s*(\\d+)$/),em=eff.match(/^(\\w+)\\s*[=:]\\s*(.+)$/);
    const findId=name=>{const v=variables.find(v=>v.name===name);return v?v.id:null};
    if(am){const id=findId(am[1]);if(id)s[id]=(Number(s[id])||0)+Number(am[2]);}
    else if(sm){const id=findId(sm[1]);if(id)s[id]=(Number(s[id])||0)-Number(sm[2]);}
    else if(em){const id=findId(em[1]);if(id){const v=em[2];s[id]=v==='true'?true:v==='false'?false:isNaN(Number(v))?v:Number(v);}}
  });
  return s;
}
function evalCond(cond,state,variables){
  if(!cond)return true;
  cond=cond.trim();
  const byName={};variables.forEach(v=>{byName[v.name]=state[v.id]??v.defaultValue});
  const pv=s=>{s=String(s).trim();if(s==='true')return true;if(s==='false')return false;if(!isNaN(Number(s)))return Number(s);return s};
  let m;
  if(m=cond.match(/^(\\w+)\\s*=\\s*(.+)$/))return byName[m[1]]==pv(m[2]);
  if(m=cond.match(/^(\\w+)\\s*>\\s*(.+)$/))return Number(byName[m[1]])>Number(m[2]);
  if(m=cond.match(/^(\\w+)\\s*<\\s*(.+)$/))return Number(byName[m[1]])<Number(m[2]);
  if(m=cond.match(/^(\\w+)\\s*!=\\s*(.+)$/))return byName[m[1]]!=pv(m[2]);
  return !!byName[cond.trim()];
}

// ── Game state ────────────────────────────────────────────────────────────
let gs={nodeId:null,lineIndex:0,varState:{},showChoices:false};
const nodeMap=Object.fromEntries(STORY.nodes.map(n=>[n.id,n]));

function getStartNode(){
  const hasIn=new Set(STORY.edges.map(e=>e.to));
  const roots=STORY.nodes.filter(n=>!hasIn.has(n.id));
  return (roots.length?roots:STORY.nodes)[0];
}

function restart(){
  const start=getStartNode();
  if(!start)return;
  gs={nodeId:start.id,lineIndex:0,varState:buildDefaultState(STORY.variables),showChoices:false};
  gs.varState=applyEffects(gs.varState,start.variables||[]);
  render(start.transition||'fade');
}

function goBack(){
  if(document.referrer)window.history.back();
}

// ── Audio ─────────────────────────────────────────────────────────────────
let bgAudio=null;
function playMusic(assetId){
  if(bgAudio){bgAudio.pause();bgAudio=null;}
  if(!assetId)return;
  const src=STORY.assetMap[assetId];
  if(!src)return;
  bgAudio=new Audio(src);bgAudio.loop=true;bgAudio.volume=0.8;
  bgAudio.play().catch(()=>{});
}

// ── Render ────────────────────────────────────────────────────────────────
function render(transition){
  const node=nodeMap[gs.nodeId];
  if(!node)return;

  const vn=document.getElementById('vn');
  vn.className=transition==='cut'?'':(transition==='slide-left'?'slide-left':transition==='slide-right'?'slide-right':'fade-in');

  // Background
  const bgInner=document.getElementById('bg-inner');
  const bgSrc=node.background?STORY.assetMap[node.background]:null;
  bgInner.innerHTML=bgSrc?'<img src="'+bgSrc+'" alt="">':'';

  // Music
  playMusic(node.music);

  // Characters
  const positions=['left','center','right'];
  const charAtPos={left:null,center:null,right:null};
  const curLine=node.dialogueLines?.[gs.lineIndex]??null;
  if(curLine?.speaker){
    const c=STORY.characters.find(c=>c.id===curLine.speaker);
    if(c)charAtPos[curLine.position||'center']=c;
  }
  node.chars?.forEach(cid=>{
    const c=STORY.characters.find(c=>c.id===cid);
    if(!c)return;
    if(!Object.values(charAtPos).includes(c)){
      for(const p of positions){if(!charAtPos[p]){charAtPos[p]=c;break;}}
    }
  });
  positions.forEach(pos=>{
    const slot=document.getElementById('char-'+pos);
    const c=charAtPos[pos];
    if(!c){slot.innerHTML='';return;}
    const isActive=curLine?.speaker===c.id;
    const poseId=isActive?curLine.characterPose:null;
    const sprite=poseId?c.sprites?.find(s=>s.id===poseId):c.sprites?.[0];
    const src=sprite?STORY.assetMap[sprite.assetId]:null;
    const opacity=isActive?1:0.6;
    const filt=isActive?'none':'brightness(0.5)';
    if(src){slot.innerHTML='<img src="'+src+'" style="max-height:60vh;object-fit:contain;opacity:'+opacity+';filter:'+filt+'" alt="'+c.name+'">';}
    else{slot.innerHTML='<div class="char-placeholder" style="background:'+c.color+'22;border:2px solid '+c.color+';color:'+c.color+';opacity:'+opacity+'">'+c.name[0]+'</div>';}
  });

  // Choices / end / dialogue
  renderDialogue(node);
}

function renderDialogue(node){
  const dlg=document.getElementById('dlg');
  const choicesEl=document.getElementById('choices');
  const endEl=document.getElementById('end');
  dlg.style.display='none';choicesEl.style.display='none';endEl.style.display='none';

  if(gs.showChoices){
    const validBranches=node.branches?.filter(b=>evalCond(b.condition,gs.varState,STORY.variables))||[];
    const outgoing=STORY.edges.filter(e=>e.from===gs.nodeId);
    const choiceEdges=outgoing.filter(e=>e.label);

    if(validBranches.length===0&&choiceEdges.length===0){
      // End screen
      endEl.style.display='flex';
      document.getElementById('end-title').textContent=
        node.type==='ending'?'The End':node.type==='death'?'Game Over':'End';
      document.getElementById('end-sub').textContent=node.title||'';
      return;
    }

    choicesEl.style.display='flex';
    choicesEl.innerHTML='';

    // Branch choices
    validBranches.forEach(b=>{
      const btn=document.createElement('button');
      btn.className='choice-btn';
      btn.innerHTML='<span class="choice-letter">'+b.option+'</span>'+escHtmlJs(b.desc);
      btn.onclick=(e)=>{e.stopPropagation();handleBranchChoice(b);};
      choicesEl.appendChild(btn);
    });
    // Edge choices
    choiceEdges.forEach(e=>{
      const btn=document.createElement('button');
      btn.className='choice-btn';
      btn.textContent=e.label;
      btn.onclick=(ev)=>{ev.stopPropagation();gotoNode(e.to,gs.varState);};
      choicesEl.appendChild(btn);
    });
    return;
  }

  const curLine=node.dialogueLines?.[gs.lineIndex]??null;
  if(curLine){
    dlg.style.display='block';
    const speaker=curLine.speaker?STORY.characters.find(c=>c.id===curLine.speaker):null;
    const nameEl=document.getElementById('dlg-name');
    if(speaker){nameEl.textContent=speaker.name;nameEl.style.color=speaker.color;}
    else{nameEl.textContent='';nameEl.style.color='';}
    document.getElementById('dlg-text').style.color=speaker?speaker.color:'#e8ecf4';
    document.getElementById('dlg-text').textContent=curLine.text;
  } else {
    document.getElementById('dlg-hint').style.display='block';
  }
}

function handleBranchChoice(branch){
  let vars=applyBranchEffects(gs.varState,branch.effects||[],STORY.variables);
  const target=branch.leads?.[0];
  if(!target)return;
  gotoNode(target,vars);
}

function gotoNode(nodeId,vars){
  const node=nodeMap[nodeId];
  if(!node)return;
  const newVars=applyEffects(vars,node.variables||[]);
  gs={nodeId,lineIndex:0,varState:newVars,showChoices:false};
  render(node.transition||'fade');
}

function advance(){
  const node=nodeMap[gs.nodeId];
  if(!node||gs.showChoices)return;
  const lines=node.dialogueLines||[];
  const next=gs.lineIndex+1;
  if(next<lines.length){gs.lineIndex=next;renderDialogue(node);return;}
  // End of lines
  const outgoing=STORY.edges.filter(e=>e.from===gs.nodeId);
  const seqEdges=outgoing.filter(e=>!e.label);
  const choiceEdges=outgoing.filter(e=>e.label);
  const validBranches=node.branches?.filter(b=>evalCond(b.condition,gs.varState,STORY.variables))||[];
  if(validBranches.length>0||choiceEdges.length>0){gs.showChoices=true;renderDialogue(node);return;}
  if(seqEdges.length===1){gotoNode(seqEdges[0].to,gs.varState);return;}
  gs.showChoices=true;renderDialogue(node);
}

function escHtmlJs(s){return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');}

// ── Input ─────────────────────────────────────────────────────────────────
document.getElementById('vn').addEventListener('click',()=>advance());
document.addEventListener('keydown',e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();advance();}});

// ── Start ─────────────────────────────────────────────────────────────────
restart();
</script>
</body>
</html>`
}

function escHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
