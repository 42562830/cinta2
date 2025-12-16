
        // --- DATA & CONFIG ---
        const LEVELS = [
            { name: "PRINCIPIANTE", spdBase: 5, spdHigh: 8, incMax: 3 },
            { name: "INTERMEDIO", spdBase: 7, spdHigh: 11, incMax: 6 },
            { name: "AVANZADO", spdBase: 9, spdHigh: 15, incMax: 10 }
        ];

        const BADGES = [
            { id: 'first', icon: '👟', name: 'Primer Paso', cond: (s) => s.sessions >= 1 },
            { id: 'fire', icon: '🔥', name: 'Racha 3 Días', cond: (s) => s.streak >= 3 },
            { id: 'marathon', icon: '🏅', name: '42km Club', cond: (s) => s.totalKm >= 42 },
            { id: 'flash', icon: '⚡', name: 'Velocista', cond: (s) => s.topSpeed >= 12 },
            { id: 'early', icon: '🌅', name: 'Madrugador', cond: (s, last) => last && new Date(last.date).getHours() < 9 }
        ];

        // --- DATABASE & LOGIC ---
        const db = {
            key: 'technorunner_pro_db',
            state: {
                user: null, // {name, age, weight, levelIdx}
                stats: { xp:0, level:1, totalKm:0, totalCal:0, sessions:0, streak:0, lastDate:null, topSpeed:0 },
                badges: [],
                history: [],
                week: { id:0, days:[] }
            },
            load: function() {
                const s = localStorage.getItem(this.key);
                if(s) try { this.state = JSON.parse(s); } catch(e) { localStorage.removeItem(this.key); }
                return !!this.state.user;
            },
            save: function() {
                localStorage.setItem(this.key, JSON.stringify(this.state));
            },
            addSession: function(s) {
                this.state.history.unshift(s);
                // Update Stats
                const st = this.state.stats;
                st.totalKm += s.dist; st.totalCal += s.cal; st.sessions++;
                if(s.maxSpd > st.topSpeed) st.topSpeed = s.maxSpd;
                
                // XP Logic (1km = 100XP)
                const gain = Math.floor((s.dist * 100) + (s.cal * 0.5));
                st.xp += gain;
                while(st.xp >= st.level*1000) { st.xp -= st.level*1000; st.level++; }

                // Streak
                const today = new Date().toDateString();
                if(st.lastDate) {
                    const yest = new Date(Date.now() - 86400000).toDateString();
                    if(st.lastDate === yest) st.streak++;
                    else if(st.lastDate !== today) st.streak = 1;
                } else st.streak = 1;
                st.lastDate = today;

                // Update Week Plan
                const dIdx = (new Date().getDay() + 6) % 7;
                if(this.state.week.days[dIdx]) this.state.week.days[dIdx].done = true;

                // Check Badges
                BADGES.forEach(b => {
                    if(!this.state.badges.includes(b.id) && b.cond(st, s)) {
                        this.state.badges.push(b.id);
                        alert(`¡INSIGNIA DESBLOQUEADA: ${b.name}!`);
                    }
                });

                this.save();
                return gain;
            }
        };

        const planner = {
            generate: function(lvlIdx) {
                // Generar semana si no existe o es nueva
                const wId = getWeekNum(new Date());
                if(db.state.week.id === wId && db.state.week.days.length > 0) return;

                const types = ['HIIT', 'REST', 'ENDURANCE', 'HILLS', 'REST', 'ENDURANCE', 'REST']; // Simple Logic
                const days = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
                const newDays = days.map((d, i) => ({
                    day: d, type: types[i], done: false, dur: 30 + (lvlIdx*5)
                }));
                db.state.week = { id: wId, days: newDays };
                db.save();
            },
            render: function() {
                const c = document.getElementById('week-grid');
                c.innerHTML = '';
                const todayIdx = (new Date().getDay() + 6) % 7;
                const d = db.state.week.days;
                
                d.forEach((day, i) => {
                    const el = document.createElement('div');
                    el.className = `day-col ${i===todayIdx ? 'active' : ''}`;
                    let cls = 'day-dot';
                    if(day.done) cls += ' done';
                    else if(day.type !== 'REST' && i===todayIdx) cls += ' target';
                    
                    el.innerHTML = `<div style="font-size:0.7rem; font-weight:700;">${day.day}</div><div class="${cls}"></div>`;
                    c.appendChild(el);

                    if(i===todayIdx) {
                        document.getElementById('plan-today-type').innerText = day.type === 'REST' ? 'DESCANSO' : day.type;
                        document.getElementById('plan-today-dur').innerText = day.type === 'REST' ? 'Recuperación' : `${day.dur} min`;
                        const btn = document.getElementById('btn-do-today');
                        if(day.type === 'REST' || day.done) btn.style.display = 'none';
                        else {
                            btn.style.display = 'block';
                            btn.onclick = () => { ui.cat=day.type; ui.var='classic'; document.getElementById('rng-dur').value=day.dur; app.start(); };
                        }
                    }
                });
            }
        };

        function getWeekNum(d) {
            d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
            d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay()||7));
            var yearStart = new Date(Date.UTC(d.getUTCFullYear(),0,1));
            return Math.ceil((((d - yearStart) / 86400000) + 1)/7);
        }

        // --- UI CONTROLLER ---
        const ui = {
            cat: 'HIIT', var: 'classic',
            selectCat: function(c) {
                this.cat = c;
                document.querySelectorAll('.opt-card').forEach(e=>e.classList.remove('active'));
                document.getElementById('card-'+c.toLowerCase()).classList.add('active');
                document.querySelectorAll('.variant-scroll').forEach(e=>e.style.display='none');
                document.getElementById('vars-'+c).style.display='flex';
            },
            selectVar: function(v, el, ev) {
                if(ev) ev.stopPropagation();
                this.var = v;
                el.parentNode.querySelectorAll('.pill').forEach(p=>p.classList.remove('active'));
                el.classList.add('active');
            },
            updateSliders: function() {
                const lvl = document.getElementById('rng-lvl').value;
                document.getElementById('disp-dur').innerText = document.getElementById('rng-dur').value + " min";
                document.getElementById('disp-lvl').innerText = LEVELS[lvl].name;
            },
            toast: function(msg){
                let t = document.getElementById('toast');
                if(!t){ t = document.createElement('div'); t.id='toast'; document.body.appendChild(t); }
                t.textContent = msg;
                t.classList.add('show');
                clearTimeout(t._to);
                t._to = setTimeout(()=>t.classList.remove('show'), 1400);
            },
            showScreen: function(id){
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                const el = document.getElementById(id);
                if(el) el.classList.add('active');
            },
            openCatalog: async function(){ await app.renderCatalog(); ui.showScreen('catalog-view'); },
            openTest: function(){
                const r = document.getElementById('test-result');
                if(r) r.style.display='none';
                ui.showScreen('test-view');
            },

            goToTab: function(t) {
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
                
                if(t==='setup') { document.getElementById('setup-view').classList.add('active'); document.querySelectorAll('.tab-btn')[0].classList.add('active'); }
                if(t==='history') { 
                    app.renderHist(); document.getElementById('history-view').classList.add('active'); document.querySelectorAll('.tab-btn')[1].classList.add('active'); 
                }
                if(t==='profile') { 
                    app.renderProf(); document.getElementById('profile-view').classList.add('active'); document.querySelectorAll('.tab-btn')[2].classList.add('active'); 
                }
            },
            switchScreen: function(id) {
                document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
                document.getElementById(id).classList.add('active');
                if(id==='workout-view' || id==='onboarding-view') document.getElementById('main-nav').style.display='none';
                else document.getElementById('main-nav').style.display='flex';
            }
        };

        // --- GENERATOR & APP LOGIC ---
        
// --- WORKOUT CATALOG (JSON) ---
const workoutCatalog = {
  data: null,
  async load() {
    if (this.data) return this.data;
    try {
      const res = await fetch("./data/workouts.core.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("catalog fetch failed");
      this.data = await res.json();
      return this.data;
    } catch (e) {
      this.data = null;
      return null;
    }
  },
  recentIds(N = 6) {
    return (db.state.history || []).slice(0, N).map(h => h.wid).filter(Boolean);
  },
  async pick({ cat, variant, durMin, lvlIdx }) {
    const catData = await this.load();
    if (!catData || !Array.isArray(catData.workouts)) return null;

    const history = db.state.history || [];
    const recentIds = new Set(this.recentIds(8));
    const recentStim = new Set(history.slice(0, 2).map(h => h.stim).filter(Boolean));

    // "Deload" simple: cada 10ª sesión, sugiere algo suave
    const deload = (history.length % 10) === 9;

    const within = (w) => Math.abs((w.durMin || durMin) - durMin) <= 5;
    const variantOk = (w) => (cat === "HIIT") ? (w.variant === variant) : true;

    let pool = catData.workouts.filter(w =>
      w.cat === cat &&
      variantOk(w) &&
      lvlIdx >= w.minLevel && lvlIdx <= w.maxLevel &&
      within(w)
    );

    if (!pool.length) return null;

    if (deload) {
      const soft = pool.filter(w => (w.hardness || 3) <= 2);
      if (soft.length) pool = soft;
    }

    // scoring: evita repetición de estímulo y de IDs recientes, prioriza variedad
    const scored = pool.map(w => {
      let score = Math.random(); // base aleatoria
      if (recentIds.has(w.id)) score -= 3;
      if (w.stimulus && recentStim.has(w.stimulus)) score -= 1.5;
      // diversidad por tags: penaliza si repite tag top
      const lastTags = (history[0]?.tags) ? new Set(history[0].tags) : null;
      if (lastTags && Array.isArray(w.tags)) {
        for (const t of w.tags) if (lastTags.has(t)) score -= 0.15;
      }
      // pequeño bonus si es "benchmark" ocasional
      if (w.tags && w.tags.includes("benchmark")) score += 0.15;
      return { w, score };
    }).sort((a,b)=>b.score-a.score);

    return scored[0].w;
  },
  toSegments(workout, lvl) {
    const segs = [];
    const pushSeg = (s) => {
      const spd =
        typeof s.spdFixed === "number" ? s.spdFixed :
        typeof s.spdKey === "string" ? (lvl[s.spdKey] ?? lvl.spdBase) :
        lvl.spdBase;

      const spdFinal = Math.max(2.5, spd + (s.spdOffset || 0));
      segs.push({
        type: s.type,
        name: s.name,
        dur: s.sec,
        spd: spdFinal,
        inc: s.inc || 0
      });
    };

    for (const item of workout.structure) {
      if (item.repeat && item.block) {
        for (let r = 0; r < item.repeat; r++) {
          for (const b of item.block) pushSeg(b);
        }
      } else {
        pushSeg(item);
      }
    }
    return segs;
  }
};


const generator = {
            build: function(cat, vart, dur, lvl) {
                let segs = [];
                const warm=300, cool=300;
                const work = (dur*60) - warm - cool;
                segs.push({type:'warm', name:'CALENTAMIENTO', dur:warm, spd:lvl.spdBase-2, inc:0});

                if(cat==='HIIT') {
                    if(vart==='classic') {
                        let t=0; while(t<work){ segs.push({type:'high', name:'SPRINT', dur:60, spd:lvl.spdHigh, inc:1}); segs.push({type:'low', name:'RECUPERA', dur:60, spd:lvl.spdBase, inc:0}); t+=120; }
                    } else if(vart==='tabata') {
                        let t=0; while(t<work){ for(let i=0;i<8;i++){ segs.push({type:'high', name:'TABATA', dur:20, spd:lvl.spdHigh+1, inc:1}); segs.push({type:'low', name:'PAUSA', dur:10, spd:3, inc:0}); } segs.push({type:'low', name:'DESCANSO', dur:60, spd:lvl.spdBase, inc:0}); t+=300; }
                    } else { // pyramid
                        let steps=[30,60,90,60,30], idx=0, t=0; while(t<work){ let d=steps[idx%5]; segs.push({type:'high', name:'INTENSIDAD', dur:d, spd:lvl.spdHigh, inc:1}); segs.push({type:'low', name:'RECUPERA', dur:d, spd:lvl.spdBase, inc:0}); t+=d*2; idx++; }
                    }
                } else if(cat==='HILLS') {
                    let t=0; while(t<work){ let hard=Math.random()>0.5; segs.push({type:hard?'high':'mid', name:hard?'SUBIDA':'PENDIENTE', dur:120, spd:lvl.spdBase, inc:hard?lvl.incMax:Math.floor(lvl.incMax/2)}); t+=120; }
                } else {
                    segs.push({type:'mid', name:'RITMO CONSTANTE', dur:work, spd:lvl.spdHigh-2, inc:1});
                }
                segs.push({type:'cool', name:'ENFRIAMIENTO', dur:cool, spd:4, inc:0});
                return segs;
            }
        };

        const app = {
            data: [], idx: 0, timeLeft: 0, totalTime: 0, elapsed: 0, totalDist: 0, maxSpd: 0,
            timer: null, paused: false, videoEl: null,

            init: function() {
                const hasUser = db.load();
                if(hasUser) {
                    this.loadSetup();
                } else {
                    ui.switchScreen('onboarding-view');
                }
                document.getElementById('bg-video').play().catch(e=>{});
                this.videoEl = document.getElementById('workout-video');
            },

            saveUser: function() {
                const n = document.getElementById('in-name').value || "Runner";
                const w = document.getElementById('in-weight').value || 70;
                db.state.user = { name:n, weight:w, levelIdx:0 };
                planner.generate(0);
                db.save();
                this.loadSetup();
            },

            loadSetup: function() {
                document.body.classList.add('mode-app');
                const u = db.state.user;
                document.getElementById('disp-name').innerText = u.name.toUpperCase();
                document.getElementById('nav-av').innerText = u.name.charAt(0);
                document.getElementById('nav-xp').style.width = ((db.state.stats.xp/(db.state.stats.level*1000))*100)+'%';
                
                planner.generate(u.levelIdx);
                planner.render();
                ui.switchScreen('setup-view');
            },

            renderHist: function() {
                const c = document.getElementById('hist-container');
                c.innerHTML = '';
                if(db.state.history.length===0) c.innerHTML = '<div style="text-align:center; color:#555; margin-top:20px;">Sin historial</div>';
                db.state.history.forEach(h => {
                    const d = document.createElement('div');
                    d.className = 'hist-card';
                    d.innerHTML = `<div><div style="font-size:0.75rem; color:#888;">${h.date}</div><div style="font-weight:700;">${h.type}</div></div><div style="text-align:right;"><div style="font-weight:800; font-size:1.1rem;">${h.dist.toFixed(2)} km</div><div style="font-size:0.8rem; color:#888;">${h.cal} kcal</div></div>`;
                    c.appendChild(d);
                });
            },

            renderProf: function() {
                const s = db.state.stats;
                const u = db.state.user;
                document.getElementById('prof-name').innerText = u.name.toUpperCase();
                document.getElementById('prof-av').innerText = u.name.charAt(0);
                document.getElementById('prof-lvl').innerText = s.level;
                document.getElementById('prof-xp-bar').style.width = ((s.xp/(s.level*1000))*100)+'%';
                document.getElementById('prof-xp-txt').innerText = `${s.xp} / ${s.level*1000} XP`;
                
                document.getElementById('stat-km').innerText = s.totalKm.toFixed(1);
                document.getElementById('stat-sess').innerText = s.sessions;
                document.getElementById('stat-cal').innerText = s.totalCal;
                document.getElementById('stat-streak').innerText = s.streak;

                const bc = document.getElementById('badge-container');
                bc.innerHTML = '';
                BADGES.forEach(b => {
                    const un = db.state.badges.includes(b.id);
                    const el = document.createElement('div');
                    el.className = `badge ${un?'unlocked':''}`;
                    el.innerHTML = `<div style="font-size:1.5rem; margin-bottom:5px;">${b.icon}</div><div style="font-size:0.6rem; font-weight:700;">${b.name}</div>`;
                    bc.appendChild(el);
                });
            },
            renderCatalog: async function(){
                const listEl = document.getElementById('catalog-list');
                if(!listEl) return;

                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const q = (document.getElementById('cat-search')?.value || '').trim().toLowerCase();
                const fCat = document.getElementById('cat-filter-cat')?.value || 'ALL';
                const fStim = document.getElementById('cat-filter-stim')?.value || 'ALL';
                const fDur = document.getElementById('cat-filter-dur')?.value || 'ALL';

                const durBucket = (d) => {
                  if(d <= 20) return 15;
                  if(d <= 30) return 25;
                  if(d <= 40) return 35;
                  return 45;
                };

                const lvlIdx = parseInt(document.getElementById('rng-lvl')?.value || '1', 10);
                const targetDur = parseInt(document.getElementById('rng-dur')?.value || '30', 10);

                const items = all.filter(w => {
                    if(fCat !== 'ALL' && w.cat !== fCat) return false;
                    if(fStim !== 'ALL' && (w.stimulus || '') !== fStim) return false;
                    if(fDur !== 'ALL' && durBucket(w.durMin || 0) !== parseInt(fDur,10)) return false;
                    if(!(lvlIdx >= w.minLevel && lvlIdx <= w.maxLevel)) return false;

                    if(q){
                        const blob = ((w.title||'') + ' ' + (w.tags||[]).join(' ') + ' ' + (w.stimulus||'') + ' ' + w.id).toLowerCase();
                        if(!blob.includes(q)) return false;
                    }
                    return true;
                });

                items.sort((a,b)=>{
                    const da = Math.abs((a.durMin||targetDur)-targetDur);
                    const dbb = Math.abs((b.durMin||targetDur)-targetDur);
                    if(da !== dbb) return da-dbb;
                    return (a.hardness||3)-(b.hardness||3);
                });

                if(!items.length){
                    listEl.innerHTML = '<div style="color:#888; font-weight:700; padding:12px 4px;">No hay resultados con esos filtros. Prueba a quitar alguno.</div>';
                    return;
                }

                const labelStim = (s)=>({
                  vo2:'VO2', threshold:'Umbral', aerobic:'Base', progression:'Progresivo',
                  fartlek:'Fartlek', hill_strength:'Cuestas fuerza', hill_endurance:'Cuestas resistencia',
                  hill_soft:'Cuestas suave', recovery:'Suave', benchmark:'Benchmark'
                }[s]||s||'');

                listEl.innerHTML = items.slice(0, 120).map(w=>{
                    const stim = labelStim(w.stimulus);
                    const hard = w.hardness || 3;
                    const desc = app.shortDescribe(w);
                    const chips = [
                      `<span class="chip">${w.cat} · ${w.durMin}m</span>`,
                      stim ? `<span class="chip dim">${stim}</span>` : '',
                      `<span class="chip dim">Dureza ${hard}/5</span>`
                    ].join('');
                    return `
                      <div class="workout-card">
                        <div>
                          <div class="workout-title">${w.title || w.id}</div>
                          <div class="workout-meta">${desc}</div>
                        </div>
                        <div class="chip-row">${chips}</div>
                        <div class="workout-actions">
                          <button class="btn-mini" onclick="app.previewWorkout('${w.id}')">VER</button>
                          <button class="btn-mini primary" onclick="app.selectWorkout('${w.id}')">ELEGIR</button>
                        </div>
                      </div>
                    `;
                }).join('');
            },

            shortDescribe: function(w){
                try{
                  const s = w.structure || [];
                  let parts = [];
                  for(const it of s){
                    if(it.repeat && it.block){
                      const high = it.block.find(b=>b.type==='high') || it.block[0];
                      const low = it.block.find(b=>b.type==='low') || it.block[1] || it.block[0];
                      if(high && low){
                        parts.push(`${it.repeat}×${high.sec}s/${low.sec}s`);
                      } else {
                        parts.push(`${it.repeat}×bloque`);
                      }
                    }
                  }
                  if(parts.length) return parts.slice(0,2).join(' · ') + (parts.length>2?' · …':'');
                  return (w.tags||[]).slice(0,3).join(' · ');
                }catch(e){ return ''; }
            },

            previewWorkout: async function(id){
                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const w = all.find(x=>x.id===id);
                if(!w) return;
                const stim = w.stimulus || '-';
                const txt = `${w.title||w.id} · ${w.durMin} min\n${app.shortDescribe(w)}\nEstímulo: ${stim} · Dureza ${(w.hardness||3)}/5`;
                ui.toast(txt);
            },

            selectWorkout: async function(id){
                const catData = await workoutCatalog.load();
                const all = (catData && Array.isArray(catData.workouts)) ? catData.workouts : [];
                const w = all.find(x=>x.id===id);
                if(!w) return;

                ui.selectCat(w.cat);

                if(w.cat === 'HIIT' && w.variant){
                  ui.var = w.variant;
                  document.querySelectorAll('#vars-HIIT .pill').forEach(p=>p.classList.remove('active'));
                  const map = {classic:'clásico', tabata:'tabata', pyramid:'pirámide'};
                  const target = (map[w.variant] || w.variant).toLowerCase();
                  const pill = Array.from(document.querySelectorAll('#vars-HIIT .pill')).find(p=>p.textContent.toLowerCase().includes(target));
                  if(pill) pill.classList.add('active');
                }

                const rngDur = document.getElementById('rng-dur');
                if(rngDur){ rngDur.value = w.durMin; ui.updateSliders(); }

                app.manualWorkout = w;
                ui.goToTab('setup');
                ui.toast('Entrenamiento elegido. Pulsa COMENZAR.');
            },

            startLevelTest: function(){
                const testWorkout = {
                  id: "level_test_12min",
                  cat: "ENDURANCE",
                  variant: "any",
                  title: "Test 12 min (Nivel)",
                  stimulus: "benchmark",
                  hardness: 4,
                  tags: ["benchmark"],
                  durMin: 20,
                  structure: [
                    { "type": "warm", "sec": 300, "spdOffset": -2, "inc": 0, "name": "CALENTAMIENTO" },
                    { "type": "mid",  "sec": 720, "spdKey": "spdHigh", "inc": 1, "name": "TEST 12 MIN" },
                    { "type": "cool", "sec": 300, "spdFixed": 4, "inc": 0, "name": "ENFRIAMIENTO" }
                  ],
                  minLevel: 0,
                  maxLevel: 2
                };
                this.testMode = true;
                this.manualWorkout = testWorkout;
                ui.goToTab('setup');
                this.start();
            },

            applyTestResult: function(){
                const km = this.totalDist || 0;
                let lvlIdx = 0;
                // thresholds: tweakable (12-min distance)
                if(km >= 2.7) lvlIdx = 2;
                else if(km >= 2.3) lvlIdx = 1;
                else lvlIdx = 0;

                db.state.user.levelIdx = lvlIdx;
                db.save();

                // reflect in UI slider
                const rng = document.getElementById('rng-lvl');
                if(rng){ rng.value = lvlIdx; ui.updateSliders(); }

                const name = (lvlIdx===0?'Principiante':(lvlIdx===1?'Intermedio':'Avanzado'));
                const txt = `Distancia en 12 min: ${km.toFixed(2)} km\nNivel recomendado: ${name}\n\nPuedes repetir el test cuando quieras.`;
                const box = document.getElementById('test-result');
                const t = document.getElementById('test-result-text');
                if(box && t){
                    t.textContent = txt;
                    box.style.display = 'block';
                }
                // go to test view to show result
                ui.showScreen('test-view');
                this.testMode = false;
            },


            start: async function() {
                const dur = parseInt(document.getElementById('rng-dur').value);
                const manual = this.manualWorkout || null;
                const lvlIdx = parseInt(document.getElementById('rng-lvl').value);
                const lvl = LEVELS[lvlIdx];
                let data = null;

                let picked = null;
                if (manual) {
                    picked = manual;
                    data = workoutCatalog.toSegments(picked, lvl);
                    this.currentWorkoutId = picked.id;
                    this.currentWorkoutStimulus = picked.stimulus || null;
                    this.currentWorkoutTags = picked.tags || null;
                    this.manualWorkout = null;
                } else {
                    picked = await workoutCatalog.pick({
                        cat: ui.cat,
                        variant: ui.var,
                        durMin: dur,
                        lvlIdx
                    });

                    if (picked) {
                        data = workoutCatalog.toSegments(picked, lvl);
                        this.currentWorkoutId = picked.id;
                        this.currentWorkoutStimulus = picked.stimulus || null;
                        this.currentWorkoutTags = picked.tags || null;
                    } else {
                        data = generator.build(ui.cat, ui.var, dur, lvl);
                        this.currentWorkoutId = null;
                        this.currentWorkoutStimulus = null;
                        this.currentWorkoutTags = null;
                    }
                }

this.data = data;
                this.totalTime = data.reduce((a,b)=>a+b.dur, 0);
                this.elapsed = 0; this.totalDist = 0; this.maxSpd = 0;
                
                document.body.classList.add('mode-workout');
                ui.switchScreen('workout-view');
                if(this.videoEl) { this.videoEl.currentTime=0; this.videoEl.play(); }
                
                this.renderVisuals();
                try { navigator.wakeLock.request('screen'); } catch(e){}
                this.speak(`Entrenamiento iniciado. ${data[0].name}`);
                this.loadSeg(0);
                this.timer = setInterval(()=>this.tick(), 1000);
            },

            loadSeg: function(i) {
                if(i>=this.data.length) return this.finish();
                this.idx = i;
                const s = this.data[i];
                this.timeLeft = s.dur;
                if(s.spd > this.maxSpd) this.maxSpd = s.spd;

                if(this.videoEl) this.videoEl.playbackRate = Math.max(0.5, Math.min(2, s.spd/10));

                document.getElementById('ph-title').innerText = s.name;
                document.getElementById('val-spd').innerText = s.spd.toFixed(1);
                document.getElementById('val-inc').innerText = s.inc;
                
                let col = 'var(--primary)';
                if(s.type==='high') { col='var(--accent)'; document.body.setAttribute('data-mood','sprint'); }
                else if(s.type==='mid') { col='var(--endurance)'; document.body.setAttribute('data-mood','climb'); }
                else { col='var(--cool)'; document.body.removeAttribute('data-mood'); }

                document.getElementById('ph-title').style.color = col;
                document.getElementById('ring-arc').style.stroke = col;
                document.getElementById('val-spd').style.color = col;

                const nxt = this.data[i+1];
                document.getElementById('ph-next').innerText = nxt ? `Sig: ${nxt.name}` : "FINAL";
                
                this.updateVisuals();
                if(i>0) this.speak(`Cambio. ${s.name}`);
            },

            tick: function() {
                if(this.paused) return;
                this.timeLeft--; this.elapsed++;
                this.totalDist += (this.data[this.idx].spd / 3600);
                
                document.getElementById('ph-timer').innerText = this.fmt(this.timeLeft);
                document.getElementById('total-time').innerText = this.fmt(Math.max(0, this.totalTime-this.elapsed));
                
                const tot = this.data[this.idx].dur;
                const off = 816 - ((this.timeLeft/tot)*816);
                document.getElementById('ring-arc').style.strokeDashoffset = -off;

                if(this.timeLeft<=3 && this.timeLeft>0) {
                    document.getElementById('alert-overlay').classList.add('show');
                    document.getElementById('ov-num').innerText = this.timeLeft;
                    if(navigator.vibrate) navigator.vibrate(50);
                } else {
                    document.getElementById('alert-overlay').classList.remove('show');
                }

                if(this.timeLeft<=0) this.loadSeg(this.idx+1);
            },

            renderVisuals: function() {
                const c = document.getElementById('visualizer-container');
                c.innerHTML = '';
                const max = Math.max(...this.data.map(d=>d.spd));
                this.data.forEach((d,i)=>{
                    const b = document.createElement('div');
                    b.className = 'v-bar'; b.id = 'bar-'+i; b.setAttribute('data-t', d.type);
                    b.style.height = (20 + ((d.spd/max)*80))+'%';
                    b.style.minWidth = Math.max(30, Math.min(60, d.dur))+'px';
                    c.appendChild(b);
                });
            },
            updateVisuals: function() {
                this.data.forEach((_,i)=>{
                    const b = document.getElementById('bar-'+i);
                    b.classList.remove('active');
                    if(i===this.idx) { b.classList.add('active'); b.scrollIntoView({behavior:'smooth', inline:'center'}); }
                });
            },

            togglePause: function() {
                this.paused = !this.paused;
                document.getElementById('btn-pause').innerText = this.paused ? "▶" : "II";
                if(this.videoEl) this.paused ? this.videoEl.pause() : this.videoEl.play();
            },

            skipBlock: function() { this.elapsed+=this.timeLeft; this.loadSeg(this.idx+1); },

            confirmExit: function() {
                if(confirm("¿Salir? Se perderá el progreso.")) { clearInterval(this.timer); location.reload(); }
            },

            finish: function() {
                clearInterval(this.timer);
                if(this.videoEl) this.videoEl.pause();
                document.body.classList.remove('mode-workout');
                
                const cal = Math.floor(this.totalDist * db.state.user.weight * 1.036);
                const xp = db.addSession({
                    wid: this.currentWorkoutId || null,
                    stim: this.currentWorkoutStimulus || null,
                    tags: this.currentWorkoutTags || null,
                    date: new Date().toLocaleDateString(),
                    type: ui.cat,
                    dist: this.totalDist,
                    cal: cal,
                    time: this.elapsed,
                    maxSpd: this.maxSpd
                });

                ui.switchScreen('summary-view');
                this.speak("Sesión completada");
                
                document.getElementById('sum-dist').innerText = this.totalDist.toFixed(2);
                document.getElementById('sum-cal').innerText = cal;
                document.getElementById('sum-time').innerText = this.fmt(this.elapsed);
                document.getElementById('sum-pk').innerText = this.maxSpd.toFixed(1);
                document.getElementById('sum-xp').innerText = `+${xp} XP`;
            },

            clearData: function() {
                if(confirm("¿Borrar todo?")) { localStorage.removeItem(db.key); location.reload(); }
            },

            fmt: function(s) { return `${Math.floor(s/60).toString().padStart(2,'0')}:${Math.floor(s%60).toString().padStart(2,'0')}`; },
            speak: function(t) { const u = new SpeechSynthesisUtterance(t); u.lang='es-ES'; window.speechSynthesis.speak(u); }
        };

        window.onload = () => app.init();
    

// PWA: register service worker
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('./sw.js').catch(()=>{});
}
