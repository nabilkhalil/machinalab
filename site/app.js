'use strict';
const defaults={initial:50,final:49,length:100,nose:.8,kc:1800,eff:.85,maxPower:7.5,raLimit:1.6,rate:60,noncut:30,insert:35,edges:4,life:30,batch:2000,speeds:[100,150,200],feeds:[.1,.15,.2],liveSpeed:150,liveFeed:.15,scenario:'BASE',weights:[30,25,15,30],student:'',group:'',problem:'',assumptions:'',feedRa:'',speedMrr:'',powerNotes:'',costLife:'',observations:'',recommendation:'',reflection:''};
// Student analysis prompts, following the workbook's STUDENT WORK sheet (rows 6-13).
// Keys recommendation/reflection/observations predate Stage 2, so notes saved earlier carry over.
const prompts=[
  ['problem','Problem statement','Describe the part, material, batch size and the quality, power and cost constraints.'],
  ['assumptions','Model assumptions','List the simplifications in the model (ideal roughness, constant kc, fixed tool life…) and why they matter.'],
  ['feedRa','Effect of feed on Ra','Using the nine trials: how does Ra change as feed increases? Does cutting speed change Ra in this model? Why?'],
  ['speedMrr','Effect of speed on MRR','How does MRR change with cutting speed and feed? Quote values from the trials.'],
  ['powerNotes','Cutting power interpretation','Compare input power with the machine limit. Which trial needs most power? Is power a limiting constraint here?'],
  ['costLife','Cost and tool life interpretation','Use the cost analysis table: how do machine time, tool cost and tool life affect cost per part?'],
  ['recommendation','Recommended trial and reasons','State your recommended trial, show it is feasible, and justify it with scores, cost and trade-offs.'],
  ['reflection','Limitations / validation plan','Which assumptions limit confidence in your result? What physical tests would validate it?'],
  ['observations','Other observations (optional)','Anything else you noticed while experimenting.']
];
// Saved work is untrusted (it may be corrupted, or edited by another page on the same github.io
// origin), so every field is checked against the parameter schema before use (js/validate.js).
const APP_VERSION='1.1.0';
// Versioned, namespaced storage. Work saved before Stage 4 (flat object under the old key) is still read.
const STORAGE_KEY='machinalab:mmt15603:v2',LEGACY_STORAGE_KEY='machinalab-v1';
function readStored(){
  try{
    const current=localStorage.getItem(STORAGE_KEY);
    if(current){const data=JSON.parse(current);return data&&data.schemaVersion===2?data.state:{}}
    return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY)||'{}');
  }catch{return {}}
}
let state=MachinaLab.sanitise(readStored()),page='dashboard',storageFailed=false;
let check={errors:[],warnings:[]};
const $=s=>document.querySelector(s),fmt=(n,d=2)=>Number.isFinite(n)?Number(n).toLocaleString('en-MY',{minimumFractionDigits:d,maximumFractionDigits:d}):'—';
// Storage can be unavailable (private browsing, full quota). Keep working and tell the student.
function save(){try{localStorage.setItem(STORAGE_KEY,JSON.stringify({schemaVersion:2,state}));if(storageFailed){storageFailed=false;renderNotice()}}catch{if(!storageFailed){storageFailed=true;renderNotice()}}}
const effRa=()=>state.scenario==='A'?.8:state.raLimit,batch=()=>state.scenario==='B'?3500:state.batch,life=()=>state.scenario==='C'?state.life*.6:state.life,depth=()=>(state.initial-state.final)/2,diameter=()=>(state.initial+state.final)/2;
function calc(v,f){const ap=depth(),rpm=1000*v/(Math.PI*diameter()),mrr=1000*v*f*ap,ra=1000*f*f/(32*state.nose),force=state.kc*ap*f,cutPower=force*v/60000,inputPower=cutPower/state.eff,cutTime=60*state.length/(f*rpm),cycle=cutTime+state.noncut,toolCost=cutTime/60/life()*(state.insert/state.edges),cost=cycle/3600*state.rate+toolCost;
  // Workbook COST ANALYSIS: cost/part at fixed tool lives (15, 30, 60 min/edge), independent of change request C.
  const costAtLife=T=>cycle/3600*state.rate+cutTime/60/T*(state.insert/state.edges);
  return{v,f,ap,rpm,mrr,ra,force,cutPower,inputPower,cutTime,cycle,cost,toolCost,batchCost:cost*batch(),batchHours:cycle*batch()/3600,costLife15:costAtLife(15),costLife30:costAtLife(30),costLife60:costAtLife(60),feasible:ra<=effRa()+1e-9&&inputPower<=state.maxPower+1e-9}}
const trials=()=>state.speeds.flatMap((v,i)=>state.feeds.map((f,j)=>({...calc(v,f),id:i*3+j+1})));const live=()=>calc(state.liveSpeed,state.liveFeed);
// ---- Validation display -------------------------------------------------------------
// Results are only computed and shown when the machining inputs are valid; the ranking
// additionally needs valid decision weights.
const modelOk=()=>MachinaLab.modelErrors(check).length===0;
const weightsOk=()=>MachinaLab.weightErrors(check).length===0;
const domId=key=>key.replace(/\./g,'-');
// Page holding each input, so notice links can take the student to the field.
const fieldPage=key=>/^(speeds|feeds)/.test(key)?'experiments':/^(rate|noncut|insert|edges|life|batch|weights|scenario)/.test(key)?'cost':'simulator';
function messageFor(key){return check.errors.find(e=>e.key===key)||check.warnings.find(w=>w.key===key)}
function fieldMessage(key){const m=messageFor(key);if(!m)return '';const isError=check.errors.includes(m);return `<div class="field-msg ${isError?'error':'warn'}" id="msg-${domId(key)}">${esc(m.message)}</div>`}
function invalidAttrs(key){const m=messageFor(key);if(!m)return '';return `${check.errors.includes(m)?'aria-invalid="true" ':''}aria-describedby="msg-${domId(key)}"`}
function blocked(what='results'){return `<div class="card blocked"><strong>No ${what} yet.</strong> Fix the highlighted inputs listed at the top of the page to see ${what}.</div>`}
function field(label,key,step='any'){return `<div class="field"><label for="${key}">${label}</label><input id="${key}" type="number" step="${step}" data-key="${key}" value="${esc(state[key]??'')}" ${invalidAttrs(key)}>${fieldMessage(key)}</div>`}
function metric(label,value,unit,hint=''){return `<div class="card"><div class="metric-label">${label}</div><div class="metric-value">${value} <span class="metric-unit">${unit}</span></div><div class="metric-hint">${hint}</div></div>`}
function status(r){return `<span class="status ${r.feasible?'ok':'bad'}">${r.feasible?'FEASIBLE':'NOT FEASIBLE'}</span>`}
function hero(title,desc){return `<div class="hero"><div><span class="pill">STUDENT-CENTRED VIRTUAL LAB</span><h2>${title}</h2><p>${desc}</p></div><div class="symbol">⚙</div></div>`}
function overview(){let t=trials(),feasible=t.filter(x=>x.feasible);return hero('Explore machining. Interpret evidence. Make engineering decisions.','An interactive CNC turning assessment for AISI 1045 steel. Adjust parameters, run virtual experiments, and justify your recommendation.')+`<div class="grid">${metric('Virtual trials','9','conditions')}${metric('Feasible conditions',modelOk()?feasible.length:'—','of 9',modelOk()?'':'Fix the highlighted inputs')}${metric('Surface roughness limit',fmt(effRa()),'µm')}${metric('Batch quantity',fmt(batch(),0),'parts')}</div><div class="grid two"><section class="card"><h2>Learning workflow</h2><div class="step"><strong>01 · Configure</strong><br>Review material, tool, machine, and cost assumptions.</div><div class="step"><strong>02 · Simulate</strong><br>Change cutting speed and feed and interpret instant predictions.</div><div class="step"><strong>03 · Compare</strong><br>Evaluate nine trials and plot engineering responses.</div><div class="step"><strong>04 · Decide</strong><br>Assess feasibility, production cost, and weighted scores.</div><div class="step"><strong>05 · Report</strong><br>Document findings, export CSV, and print your report.</div></section><section class="card"><h2>Industrial challenge</h2><p class="muted">A manufacturer must finish-turn 2,000 steel shafts from Ø50 to Ø49 mm across a 100 mm cutting length. Surface roughness must satisfy Ra ≤ 1.6 µm and machine input power must remain within 7.5 kW.</p><div class="callout">Your task: select a suitable cutting condition considering surface quality, material removal rate, power, cycle time, and manufacturing cost. All results are simplified theoretical predictions.</div><p class="muted">Industrial change request: <strong>${state.scenario==='BASE'?'Base scenario':state.scenario==='A'?'A · Ra ≤ 0.8 µm':state.scenario==='B'?'B · Batch 3,500':'C · Tool life −40%'}</strong></p><button class="primary" data-goto="simulator">Open live simulator →</button></section></div>`}
function simulator(){const r=live();return `<div class="grid two"><section class="card"><h2>Interactive cutting parameters</h2><p class="muted">Edit the two blue input fields. Results update automatically.</p><div class="form-grid">${field('Cutting speed Vc (m/min)','liveSpeed',10)}${field('Feed f (mm/rev)','liveFeed',.01)}</div><h3 style="margin-top:23px">Workpiece & tool settings</h3><div class="form-grid">${field('Initial diameter (mm)','initial',.1)}${field('Final diameter (mm)','final',.1)}${field('Machining length (mm)','length',1)}${field('Nose radius (mm)','nose',.1)}</div><p class="muted">Radial depth of cut = (initial diameter − final diameter) / 2. Changing diameters changes the stock allowance.</p><h3>Material & machine assumptions</h3><div class="form-grid">${field('Specific cutting force kc (N/mm²)','kc',10)}${field('Drive efficiency (0–1)','eff',.01)}${field('Max machine input power (kW)','maxPower',.1)}${field('Ra limit (µm)','raLimit',.1)}</div></section><section>${modelOk()?`<div class="grid two">${metric('Theoretical Ra',fmt(r.ra,3),'µm',r.ra<=effRa()?'Meets roughness limit':'Exceeds roughness limit')}${metric('Material removal rate',fmt(r.mrr/1000),'cm³/min')}${metric('Cutting force',fmt(r.force,1),'N')}${metric('Input power',fmt(r.inputPower,3),'kW')}${metric('Spindle speed',fmt(r.rpm,0),'rpm')}${metric('Cutting time',fmt(r.cutTime,1),'s')}${metric('Cost per part','RM '+fmt(r.cost,2),'')}${metric('Cutting power',fmt(r.cutPower,3),'kW')}</div><div class="card"><h2>Feasibility check</h2>${status(r)}<p class="muted">Surface roughness: ${fmt(r.ra,3)} / ${fmt(effRa(),2)} µm<br>Machine input power: ${fmt(r.inputPower,3)} / ${fmt(state.maxPower,2)} kW</p><div class="callout">Model assumptions: constant specific cutting force, ideal feed-mark roughness, constant mean diameter, fixed tool life. These predictions do not establish real machining performance.</div></div>`:blocked('predictions')}</section></div>`}
function tableRows(t){return t.map(r=>`<tr><td><strong>${r.id}</strong></td><td>${fmt(r.v,0)}</td><td>${fmt(r.f,2)}</td><td>${fmt(r.rpm,0)}</td><td>${fmt(r.mrr/1000,2)}</td><td>${fmt(r.ra,3)}</td><td>${fmt(r.force,1)}</td><td>${fmt(r.inputPower,3)}</td><td>${fmt(r.cutTime,1)}</td><td>RM ${fmt(r.cost,2)}</td><td>${status(r)}</td></tr>`).join('')}
function experiments(){return `<div class="card section"><div class="row"><div><h2>Nine virtual machining experiments</h2><p class="muted">3 × 3 factorial matrix. Change level values below to repeat the experiments.</p></div><button class="small-btn" id="resetLevels">Reset levels</button></div><div class="form-grid">${['speeds','feeds'].map(arr=>state[arr].map((v,i)=>{const key=`${arr}.${i}`,label=arr==='speeds'?`Speed level ${i+1} (m/min)`:`Feed level ${i+1} (mm/rev)`;return `<div class="field"><label for="${domId(key)}">${label}</label><input id="${domId(key)}" type="number" step="${arr==='speeds'?10:.01}" data-array="${arr}" data-index="${i}" value="${esc(v??'')}" ${invalidAttrs(key)}>${fieldMessage(key)}</div>`}).join('')).join('')}</div></div>${modelOk()?`<section class="card"><div class="row"><h2>Predicted machining results</h2><span class="pill">${trials().filter(t=>t.feasible).length} feasible</span></div><div class="table-wrap"><table><thead><tr><th>Trial</th><th>Vc m/min</th><th>f mm/rev</th><th>RPM</th><th>MRR cm³/min</th><th>Ra µm</th><th>Fc N</th><th>Input kW</th><th>Cut s</th><th>Cost / part</th><th>Status</th></tr></thead><tbody>${tableRows(trials())}</tbody></table></div><p class="muted">The nine-trial matrix uses the same workpiece, material, and machine assumptions as the live simulator.</p></section>`:blocked()}`}
function chart(title,key,unit,color){const t=trials(),max=Math.max(...t.map(x=>x[key]),1),w=620,h=220,left=55,top=18,bottom=38,right=20,iw=w-left-right,ih=h-top-bottom;return `<div class="card"><h3>${title}</h3><svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="${title}">${[0,.25,.5,.75,1].map(v=>`<line x1="${left}" y1="${top+ih*(1-v)}" x2="${w-right}" y2="${top+ih*(1-v)}" stroke="#e6edf2"/><text x="${left-8}" y="${top+ih*(1-v)+4}" text-anchor="end" font-size="10" fill="#78909e">${fmt(max*v,key==='ra'?2:1)}</text>`).join('')}${t.map((r,i)=>{let bw=iw/12,x=left+(i+.5)*iw/9-bw/2,bh=Math.max(0,ih*r[key]/max);return `<rect x="${x}" y="${top+ih-bh}" width="${bw}" height="${bh}" rx="3" fill="${color}" opacity=".9"><title>Trial ${r.id}: ${fmt(r[key],3)} ${unit}</title></rect><text x="${left+(i+.5)*iw/9}" y="${h-17}" text-anchor="middle" font-size="10" fill="#647f8f">${r.id}</text>`}).join('')}<text x="${w/2}" y="${h-2}" text-anchor="middle" font-size="10" fill="#647f8f">Trial number</text></svg><div class="legend">Unit: ${unit}<span class="hover-hint"> · Hover over bars for exact values</span></div></div>`}
function analysis(){if(!modelOk())return blocked('charts');return `<div class="callout section">All charts update when input parameters or experimental levels change. Interpret the cause of each trend and identify assumptions which influence predictions.</div><div class="grid two">${chart('Ideal surface roughness','ra','µm','#0b8f9b')}${chart('Material removal rate','mrr','mm³/min','#2667a0')}${chart('Machine input power','inputPower','kW','#bd7c35')}${chart('Machining time','cutTime','seconds','#8066a7')}${chart('Cutting force','force','N','#328b78')}${chart('Cost per part','cost','RM','#b4666a')}</div>`}
// Decision scores (0-100, higher is better), as in the workbook's DECISION MATRIX sheet.
// Normalised across all nine trials, including infeasible ones (DECISION MATRIX!J12).
// See docs/MODEL_CHANGELOG.md, 2026-10-15, for the engineering basis.
function scores(){
  const t=trials(),min=k=>Math.min(...t.map(r=>r[k])),max=k=>Math.max(...t.map(r=>r[k]));
  // Ra: min-max scale, lower is better (B5:B13).
  const raScore=x=>max('ra')===min('ra')?100:100*(max('ra')-x)/(max('ra')-min('ra'));
  // Productivity: percentage of the highest MRR (C5:C13).
  const mrrScore=x=>100*x/max('mrr');
  // Power and cost: lowest value as a percentage of this trial's value (D5:D13, E5:E13).
  const lowestAsPercent=(k,x)=>100*min(k)/x;
  return t.map(r=>{
    const values=[raScore(r.ra),mrrScore(r.mrr),lowestAsPercent('inputPower',r.inputPower),lowestAsPercent('cost',r.cost)];
    return{...r,values,score:r.feasible?values.reduce((a,v,i)=>a+v*state.weights[i]/100,0):null};
  }).sort((a,b)=>(b.score??-1)-(a.score??-1));
}
function costPage(){const ranked=modelOk()&&weightsOk(),s=ranked?scores():[],best=s.find(x=>x.feasible);const bestMetric=ranked?metric('Best feasible trial',best?'#'+best.id:'None','',best?'Score '+fmt(best.score,1)+'/100':'Review constraints'):metric('Best feasible trial','—','','Fix the highlighted inputs');return `<div class="grid">${metric('Production batch',fmt(batch(),0),'units')}${metric('Tool life',fmt(life(),1),'min/edge')}${metric('Machine rate','RM '+fmt(state.rate,0),'/hour')}${bestMetric}</div><div class="grid two"><div class="card"><h2>Production & tool assumptions</h2><div class="form-grid">${field('Machine rate (RM/hour)','rate',1)}${field('Non-cutting time (s)','noncut',1)}${field('Insert cost (RM)','insert',1)}${field('Usable cutting edges','edges',1)}${field('Tool life (min/edge)','life',1)}${field('Batch size (parts)','batch',1)}</div></div><div class="card"><h2>Industrial change request</h2><div class="field"><label for="scenario">Select scenario</label><select id="scenario" data-key="scenario"><option value="BASE" ${state.scenario==='BASE'?'selected':''}>BASE · Original specification</option><option value="A" ${state.scenario==='A'?'selected':''}>A · Ra limit 0.8 µm</option><option value="B" ${state.scenario==='B'?'selected':''}>B · 3,500 components</option><option value="C" ${state.scenario==='C'?'selected':''}>C · Tool life reduced 40%</option></select></div><p class="muted">Effective roughness limit: ${fmt(effRa(),2)} µm<br>Effective batch: ${fmt(batch(),0)} parts<br>Effective tool life: ${fmt(life(),1)} min/edge</p><div class="callout">First filter out non-feasible conditions. Then compare feasible trials using weighted scoring. Scores are relative to the nine simulated trials.</div></div></div>${modelOk()?costAnalysis():blocked('cost analysis')}<section class="card section"><h2>Decision criteria weights</h2><p class="muted">Total must equal 100%. A lower Ra, power, and cost are preferred; higher MRR is preferred.</p><p class="muted"><strong>How scores are calculated (0–100, higher is better):</strong> Ra scores 100 for the smoothest trial and 0 for the roughest. Productivity is the trial's MRR as a percentage of the highest MRR. Power and cost score 100 for the lowest value; other trials score the lowest value as a percentage of theirs (e.g. a trial costing 25% more than the cheapest scores 80).</p><div class="weights">${MachinaLab.params.weights.labels.map((label,i)=>{const key=`weights.${i}`;return `<div class="field"><label for="${domId(key)}">${label} (%)</label><input id="${domId(key)}" type="number" min="0" max="100" step="5" data-weight="${i}" value="${esc(state.weights[i]??'')}" ${invalidAttrs(key)}>${fieldMessage(key)}</div>`}).join('')}</div><p class="muted" id="weightsTotal">Current total: ${esc(fmt(state.weights.reduce((a,b)=>a+(b??0),0),0))}%</p>${fieldMessage('weights')}</section>${ranked?`<section class="card"><h2>Ranked trial decision matrix</h2><div class="table-wrap"><table><thead><tr><th>Rank</th><th>Trial</th><th>Vc</th><th>Feed</th><th>Ra score</th><th>MRR score</th><th>Power score</th><th>Cost score</th><th>Weighted</th><th>Eligibility</th></tr></thead><tbody>${s.map((r,i)=>`<tr><td>${r.feasible?s.filter(x=>x.feasible).indexOf(r)+1:'—'}</td><td>${r.id}</td><td>${esc(r.v)}</td><td>${fmt(r.f,2)}</td>${r.values.map(v=>`<td>${fmt(v,1)}</td>`).join('')}<td><strong>${r.score===null?'—':fmt(r.score,2)}</strong></td><td>${status(r)}</td></tr>`).join('')}</tbody></table></div></section>`:blocked('ranking')}`}
// Workbook COST ANALYSIS sheet: batch totals and tool-life sensitivity per trial.
// inReport: plain table for the printed report (no card, heading or id, so ids stay unique).
function costAnalysis(inReport=false){
  const rows=trials().map(r=>`<tr><td><strong>${r.id}</strong></td><td>RM ${fmt(r.cost,2)}</td><td>RM ${fmt(r.toolCost,3)}</td><td>RM ${fmt(r.batchCost,0)}</td><td>${fmt(r.batchHours,1)}</td><td>RM ${fmt(r.costLife15,2)}</td><td>RM ${fmt(r.costLife30,2)}</td><td>RM ${fmt(r.costLife60,2)}</td></tr>`).join('');
  const open=inReport?'<div>':'<section class="card section" id="costAnalysis"><h2>Production cost and tool-life sensitivity</h2>',close=inReport?'</div>':'</section>';
  return `${open}<p class="muted">Batch figures use the effective batch of ${fmt(batch(),0)} parts and tool life of ${fmt(life(),1)} min/edge. Tool cost per part is the share of an insert edge used by one part.</p><div class="table-wrap"><table><thead><tr><th>Trial</th><th>Cost / part</th><th>Tool cost / part</th><th>Batch cost</th><th>Batch cycle hours</th><th>Cost / part · T = 15 min</th><th>T = 30 min</th><th>T = 60 min</th></tr></thead><tbody>${rows}</tbody></table></div><p class="muted">The 15, 30 and 60 min tool-life columns are fixed what-if values, not measurements, and are not changed by change request C.</p>${close}`;
}
function esc(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function pbl(){
  const answers=prompts.map(([key,label,hint])=>`<div class="field"><label for="pbl-${key}">${label}</label><textarea id="pbl-${key}" data-text="${key}" placeholder="${esc(hint)}">${esc(state[key])}</textarea></div>`).join('');
  return `<div class="grid two"><section class="card"><h2>Student analysis</h2><p class="muted">Complete each section in your own words. Quote values from the simulator and tables as evidence.</p><div class="form-grid"><div class="field"><label for="pbl-student">Student name</label><input id="pbl-student" data-text="student" value="${esc(state.student)}" placeholder="Your name"></div><div class="field"><label for="pbl-group">Group / members</label><input id="pbl-group" data-text="group" value="${esc(state.group)}" placeholder="Group number and member names"></div></div><div class="stack">${answers}</div>${progressPanel()}</section><section class="card"><h2>PBL learning tasks</h2>${['Define the manufacturing problem and technical constraints.','Review machining theory and cite relevant references.','Explain the analytical model, assumptions, and units.','Complete and verify the nine virtual machining trials.','Interpret at least five machining performance graphs.','Evaluate manufacturing cost and tool-life sensitivity.','Rank feasible machining conditions using the decision matrix.','Respond to the industrial change request.','Prepare your technical report and defend your recommendation.'].map((x,i)=>`<div class="step"><strong>Task ${i+1}</strong><br>${x}</div>`).join('')}</section></div>`}
// Save/open a progress file so students can move between lab PCs and home without accounts.
let progressMessage=null;
function progressPanel(){
  const msg=progressMessage?`<p class="progress-msg ${progressMessage.ok?'ok':'bad'}" role="status">${esc(progressMessage.text)}</p>`:'';
  return `<div class="progress-box"><h3>Move your work to another computer</h3><p class="muted">Your work saves automatically, but only in this browser on this computer. To continue elsewhere, save a progress file (for example to a USB drive or cloud folder) and open it on the other computer.</p><div class="row-actions"><button type="button" class="secondary" id="saveProgress">↓ Save progress file</button><button type="button" class="secondary" id="openProgressBtn">↑ Open progress file</button><input type="file" id="openProgress" accept=".json,application/json" hidden></div>${msg}</div>`;
}
function models(){return `<div class="grid two">${[['Spindle speed','N = 1000 × Vc / (π × Dmean)','rev/min · constant mean diameter'],['Material removal rate','MRR = 1000 × Vc × f × ap','mm³/min · approximate turning relationship'],['Ideal roughness','Ra = 1000 × f² / (32 × rε)','µm · feed-mark geometry only'],['Cutting force','Fc = kc × ap × f','N · constant specific cutting force'],['Cutting power','Pc = Fc × Vc / 60000','kW'],['Machine input power','Pinput = Pc / η','kW · constant drive efficiency'],['Cutting time','tcut = 60 × L / (f × N)','seconds · no approach or retract'],['Cycle time','tcycle = tcut + tnoncut','seconds'],['Cost per component','C = tcycle/3600 × rate + tcut/60/T × insert/edges','RM · tool life T in minutes'],['Tool cost per component','Ctool = tcut/60/T × insert/edges','RM · share of one insert edge used per part'],['Batch cycle time','tbatch = tcycle × batch / 3600','hours · excludes setup and tool changes'],['Decision scores','Ra: 100 × (Ramax − Ra)/(Ramax − Ramin) · MRR: 100 × MRR/MRRmax · Power: 100 × Pmin/P · Cost: 100 × Cmin/C','0–100 across all nine trials · weighted total for feasible trials only']].map(([title,formula,note])=>`<section class="card"><h3>${title}</h3><div class="formula">${formula}</div><p class="muted">${note}</p></section>`).join('')}</div><div class="card"><h2>Model limitations and validation</h2><p class="muted">This web app translates the provided Excel workbook into a transparent educational analytical simulator. Results are deterministic predictions, not experimental measurements. The model excludes temperature, vibration, progressive tool wear, chip morphology, tool geometry effects beyond nose radius, and measured surface integrity. Tool life is an independent scenario assumption rather than a cutting-speed-dependent Taylor equation. The cutting-force coefficient is constant and should be supported by a material/tool reference. For real machining decisions, validate assumptions against tooling data and physical trials.</p><div class="callout">Depth of cut is fixed by the workpiece diameters. Changing the depth requires a matching change in stock allowance or machining strategy.</div></div>`}
const views={dashboard:overview,simulator,experiments,analysis,cost:costPage,pbl,models};const titles={dashboard:'Machinability Overview',simulator:'Live Turning Simulator',experiments:'Virtual Experimental Laboratory',analysis:'Machinability Data Analysis',cost:'Cost & Decision Analysis',pbl:'PBL Student Workbook',models:'Engineering Models & Assumptions'};
// Notice banner: input errors and warnings with a button that takes the student to the field.
function renderNotice(){
  const n=$('#notice');
  const items=[...check.errors.map(e=>({...e,type:'error'})),...check.warnings.map(w=>({...w,type:'warn'}))];
  if(storageFailed)items.push({key:'',type:'error',message:'Your work could not be saved in this browser (private browsing or storage full). Export a CSV before closing this page.'});
  n.hidden=items.length===0;
  if(!items.length){n.innerHTML='';return}
  const hasError=items.some(i=>i.type==='error');
  n.className='notice'+(hasError?'':' warn');
  const fixButton=key=>key?` <button type="button" class="link-btn" data-fix="${esc(key)}">Show me</button>`:'';
  n.innerHTML=`<strong>${hasError?'Please fix these inputs:':'Please check these inputs:'}</strong><ul>${items.map(i=>`<li>${esc(i.message)}${fixButton(i.key)}</li>`).join('')}</ul>`;
}
function render(){
  check=MachinaLab.validate(state);
  // Remember the focused control (and caret) so re-rendering does not throw the student out of a field.
  const active=document.activeElement,focusId=active&&$('#view').contains(active)?active.id:'';
  let caret=null;try{caret=[active.selectionStart,active.selectionEnd]}catch{}
  renderNotice();
  $('#pageTitle').textContent=titles[page];
  $('#view').innerHTML=views[page]();
  document.querySelectorAll('#nav button').forEach(b=>b.classList.toggle('active',b.dataset.page===page));
  const again=focusId&&document.getElementById(focusId);
  if(again){again.focus({preventScroll:true});if(caret&&caret[0]!=null)try{again.setSelectionRange(caret[0],caret[1])}catch{}}
}
// Re-render after the browser has finished moving focus (e.g. Tab), so the newly focused field is restored.
const renderSoon=()=>setTimeout(render,0);
function download(text,filename,type){
  const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');
  a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),1000);
}
const effective=()=>({raLimit:effRa(),maxPower:state.maxPower,batch:batch(),life:life()});
// Results for export and the report: null when inputs are invalid; ranking null when weights are invalid.
function exportResults(){
  if(!modelOk())return null;
  return{trials:trials(),live:live(),ranking:weightsOk()?scores():null};
}
function csv(){
  const now=new Date();
  const text=MachinaLab.exporter.buildCsv({state,effective:effective(),results:exportResults(),problems:MachinaLab.modelErrors(check).map(e=>e.message),prompts,appVersion:APP_VERSION,exportedAt:now});
  download(text,MachinaLab.exporter.exportFilename(state,now,'csv'),'text/csv;charset=utf-8');
}
function saveProgress(){
  const now=new Date();
  download(MachinaLab.exporter.buildProgressFile(state,now,APP_VERSION),MachinaLab.exporter.exportFilename(state,now,'json'),'application/json');
  progressMessage={ok:true,text:'Progress file saved. Keep it somewhere you can reach from the other computer.'};
  render();
}
async function openProgress(file){
  if(!file)return;
  let result;
  if(file.size>MachinaLab.exporter.PROGRESS_MAX_BYTES)result={ok:false,message:'This file is too large to be a MachinaLab progress file.'};
  else{try{result=MachinaLab.exporter.parseProgressFile(await file.text())}catch{result={ok:false,message:'The file could not be read.'}}}
  if(!result.ok){progressMessage={ok:false,text:result.message};render();return}
  if(!window.confirm('Replace the work currently in this browser with the work in this file?'))return;
  state=result.state;save();
  progressMessage={ok:true,text:`Progress file opened${result.savedAt?` (saved ${result.savedAt})`:''}.`};
  render();
}
// ---- Print report: a dedicated A4 view, hidden on screen, built just before printing. ----
function reportInputs(){
  const rows=MachinaLab.params.numeric.map(p=>`<tr><td>${esc(p.label)}</td><td>${esc(p.symbol)}</td><td>${esc(state[p.key]??'—')}</td><td>${esc(p.unit)}</td></tr>`).join('');
  const levels=`<tr><td>Speed levels</td><td>Vc</td><td>${state.speeds.map(v=>esc(v??'—')).join(', ')}</td><td>m/min</td></tr><tr><td>Feed levels</td><td>f</td><td>${state.feeds.map(v=>esc(v??'—')).join(', ')}</td><td>mm/rev</td></tr><tr><td>Decision weights</td><td>w</td><td>${MachinaLab.params.weights.labels.map((l,i)=>`${esc(l)} ${esc(state.weights[i]??'—')}`).join(', ')}</td><td>%</td></tr>`;
  return `<table class="report-table"><thead><tr><th>Parameter</th><th>Symbol</th><th>Value</th><th>Unit</th></tr></thead><tbody>${rows}${levels}</tbody></table>`;
}
function reportRanking(){
  const s=scores(),feasible=s.filter(r=>r.feasible);
  return `<table class="report-table"><thead><tr><th>Rank</th><th>Trial</th><th>Vc</th><th>f</th><th>Ra score</th><th>MRR score</th><th>Power score</th><th>Cost score</th><th>Weighted</th></tr></thead><tbody>${s.map(r=>`<tr><td>${r.feasible?feasible.indexOf(r)+1:'—'}</td><td>${r.id}</td><td>${esc(r.v)}</td><td>${fmt(r.f,2)}</td>${r.values.map(v=>`<td>${fmt(v,1)}</td>`).join('')}<td>${r.score===null?'not feasible':fmt(r.score,2)}</td></tr>`).join('')}</tbody></table>`;
}
function reportView(){
  const ex=MachinaLab.exporter,now=new Date(),results=exportResults();
  const answers=prompts.map(([key,label])=>`<div class="report-answer"><h4>${esc(label)}</h4><p>${state[key]?esc(state[key]):'<em>(not answered)</em>'}</p></div>`).join('');
  let body;
  if(results){
    const best=results.ranking&&results.ranking.find(r=>r.feasible);
    body=`<section class="report-section"><h2>2. Nine-trial results</h2><p class="report-note">${results.trials.filter(t=>t.feasible).length} of 9 trials feasible (Ra ≤ ${fmt(effRa(),2)} µm and input power ≤ ${fmt(state.maxPower,2)} kW).${best?` Best feasible trial by weighted score: <strong>trial ${best.id}</strong> (${fmt(best.score,2)}/100).`:''}</p><table class="report-table"><thead><tr><th>Trial</th><th>Vc m/min</th><th>f mm/rev</th><th>N rpm</th><th>MRR cm³/min</th><th>Ra µm</th><th>Fc N</th><th>Pin kW</th><th>tcut s</th><th>Cost RM</th><th>Status</th></tr></thead><tbody>${tableRows(results.trials)}</tbody></table></section>
<section class="report-section report-charts"><h2>3. Key responses</h2><div class="report-chart-grid">${chart('Ideal surface roughness','ra','µm','#0b8f9b')}${chart('Machine input power','inputPower','kW','#bd7c35')}${chart('Cost per part','cost','RM','#b4666a')}</div></section>
<section class="report-section"><h2>4. Production cost and tool-life sensitivity</h2>${costAnalysis(true)}</section>
<section class="report-section"><h2>5. Decision matrix</h2>${results.ranking?reportRanking():'<p class="report-note">Not included: decision weights must total 100 %.</p>'}</section>`;
  }else{
    body=`<section class="report-section"><h2>2–5. Results</h2><p class="report-note"><strong>Results not included:</strong> some inputs are invalid.</p><ul>${MachinaLab.modelErrors(check).map(e=>`<li>${esc(e.message)}</li>`).join('')}</ul></section>`;
  }
  return `<header class="report-head"><div><p class="report-eyebrow">MMT15603 Assessment of Machinability · MachinaLab virtual machining laboratory</p><h1>Finish-turning parameter study: AISI 1045</h1></div><table class="report-meta"><tr><th>Student</th><td>${esc(state.student)||'—'}</td></tr><tr><th>Group / members</th><td>${esc(state.group)||'—'}</td></tr><tr><th>Date</th><td>${esc(ex.isoWithOffset(now).slice(0,16).replace('T',' '))}</td></tr><tr><th>Change request</th><td>${esc(state.scenario)} · ${esc(ex.SCENARIOS[state.scenario]||'')}</td></tr></table></header>
<section class="report-section"><h2>1. Inputs and assumptions</h2>${reportInputs()}</section>${body}
<section class="report-section"><h2>6. Student analysis</h2>${answers}</section>
<footer class="report-foot">All values are analytical model predictions (ideal roughness, constant specific cutting force, fixed tool life), not measurements. Generated by MachinaLab ${APP_VERSION}.</footer>`;
}
function renderReport(){check=MachinaLab.validate(state);$('#report').innerHTML=reportView()}
// An emptied number box is stored as null (shown as empty, reported as "Enter a number").
const numberValue=el=>el.value.trim()===''?null:Number(el.value);
document.addEventListener('click',e=>{
  const nav=e.target.closest('[data-page],[data-goto]');
  if(nav){page=nav.dataset.page||nav.dataset.goto;render();window.scrollTo(0,0)}
  const fix=e.target.closest('[data-fix]');
  if(fix){const key=fix.dataset.fix;page=fieldPage(key);render();const target=document.getElementById(key==='weights'?'weights-0':domId(key));if(target){target.focus();target.scrollIntoView({block:'center'})}}
  if(e.target.closest('#exportBtn'))csv();
  if(e.target.closest('#printBtn')){renderReport();window.print()}
  if(e.target.closest('#saveProgress'))saveProgress();
  if(e.target.closest('#openProgressBtn'))$('#openProgress').click();
  if(e.target.closest('#resetLevels')){state.speeds=[...defaults.speeds];state.feeds=[...defaults.feeds];save();render()}
});
document.addEventListener('change',e=>{
  const el=e.target;
  if(el.id==='openProgress'){openProgress(el.files&&el.files[0]);el.value='';return}
  if(el.dataset.key){state[el.dataset.key]=el.dataset.key==='scenario'?el.value:numberValue(el);save();renderSoon()}
  else if(el.dataset.array){state[el.dataset.array][Number(el.dataset.index)]=numberValue(el);save();renderSoon()}
  else if(el.dataset.weight!==undefined){state.weights[Number(el.dataset.weight)]=numberValue(el);save();renderSoon()}
  else if(el.dataset.text){state[el.dataset.text]=el.value;save()}
});
// Ctrl+P / browser menu printing also gets the full report.
window.addEventListener('beforeprint',renderReport);
document.addEventListener('input',e=>{if(e.target.dataset.text){state[e.target.dataset.text]=e.target.value;save()}});
render();
