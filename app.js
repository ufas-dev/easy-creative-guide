(function(){
  const slides=[...document.querySelectorAll('.slide')];
  const ids=slides.map(s=>s.id.slice(2));
  const navPages=[...document.querySelectorAll('.nav-page')];
  const navParts=[...document.querySelectorAll('.nav-part')];
  let cur=-1;

  function show(i,push=true){
    i=Math.max(0,Math.min(slides.length-1,i));
    if(i===cur)return;
    slides.forEach((s,k)=>s.classList.toggle('cur',k===i));
    navPages.forEach(a=>a.classList.toggle('cur',a.dataset.id===ids[i]));
    const part=slides[i].dataset.part;
    navParts.forEach(p=>p.classList.toggle('open',p.dataset.part===part));
    const a=navPages.find(a=>a.dataset.id===ids[i]); if(a) a.scrollIntoView({block:'nearest'});
    cur=i; if(push) location.hash=ids[i];
    const d=slides[i].querySelector('.dpane.on .demo')||slides[i].querySelector('.demo'); if(d&&d._init) d._init();
  }
  function fromHash(){const h=decodeURIComponent(location.hash.slice(1));const i=ids.indexOf(h);show(i<0?0:i,false);}
  window.addEventListener('hashchange',fromHash);
  navParts.forEach(p=>p.addEventListener('click',()=>{const first=p.nextElementSibling.querySelector('.nav-page');if(first)location.hash=first.dataset.id;}));

  /* ---------- demo (step-through + zoom) ---------- */
  document.querySelectorAll('.demo').forEach(demo=>{
    const raw=JSON.parse(demo.dataset.frames);              // [{img,w,h,rect,hl,caption,step,sub,zoom}]
    const mode=demo.dataset.mode;                           // 'frame' | 'region'
    // 全画面を先に見せ、対象が小さい／縦長で見えない時だけ次の1手で寄る
    // 寄る領域（対象を中心に、画面の半分以上）
    const regionFor=(f,r)=>{const mw=Math.max(r.w,f.w*0.5),mh=Math.max(r.h,Math.min(f.h*0.5,mw*0.62)); /* 縦長画像でも画面比率ぐらいに寄る */let x=r.x+r.w/2-mw/2,y=r.y+r.h/2-mh/2;x=Math.max(0,Math.min(f.w-mw,x));y=Math.max(0,Math.min(f.h-mh,y));return {x,y,w:mw,h:mh};};
    const inside=(r,g)=>r.x>=g.x-2&&r.y>=g.y-2&&r.x+r.w<=g.x+g.w+2&&r.y+r.h<=g.y+g.h+2;
    const hits=(r,g)=>r.x<g.x+g.w&&r.x+r.w>g.x&&r.y<g.y+g.h&&r.y+r.h>g.y;
    // 方針: 画面が変わらない限り、同じエリアでの「寄る／戻す」は1回に収める
    //  - 寄っている間: 次の対象がその領域内なら固定、重なるなら少しずらす（パン）、離れていれば全画面に戻す
    //  - 全画面の間: 直前に赤枠で示した場所の近くなら寄らずに全画面のまま
    const frames=[]; let prevImg=null, prevZoom=null, prevFullRect=null;
    raw.forEach(f=>{
      if(!f.rect){frames.push({...f,phase:'full'});prevImg=f.img;prevZoom=null;prevFullRect=null;return;}
      const need=f.zoom||mode==='region'||Math.min(f.rect.w,f.rect.h)<Math.max(f.w,f.h)*0.035;
      const region=f.zoom?{x:f.rect.x,y:f.rect.y,w:f.rect.w,h:f.rect.h}:regionFor(f,f.rect);   
      if(prevZoom&&!f.newpage){
        if(inside(f.rect,prevZoom)){frames.push({...f,phase:'zoom',region:prevZoom});prevImg=f.img;return;}
        if(need||hits(f.rect,prevZoom)){frames.push({...f,phase:'zoom',region});prevZoom=region;prevImg=f.img;return;}   // 同じ画面内は寄ったまま移動
        frames.push({...f,phase:'full'});prevZoom=null;prevFullRect=f.rect;prevImg=f.img;return;
      }
      if(f.newpage){frames.push({...f,phase:'full'});prevZoom=null;prevFullRect=null;if(!need){prevFullRect=f.rect;prevImg=f.img;return;}frames.push({...f,phase:'zoom',region});prevZoom=region;prevImg=f.img;return;}
      if(!need){frames.push({...f,phase:'full'});prevFullRect=f.rect;prevImg=f.img;return;}
      if(!f.zoom&&prevFullRect&&f.img===prevImg&&inside(f.rect,regionFor(f,prevFullRect))){frames.push({...f,phase:'full'});prevImg=f.img;return;}
      if(f.img!==prevImg&&!f.keep) frames.push({...f,phase:'full'});
      frames.push({...f,phase:'zoom',region}); prevZoom=region; prevFullRect=null; prevImg=f.img;
    });
    const screen=demo.querySelector('.screen'), vp=demo.querySelector('.vp'), fr=demo.querySelector('.fr'), img=fr.querySelector('img'), hl=demo.querySelector('.hl');
    const cap=demo.querySelector('.cap'), prog=demo.querySelector('.prog i'), mini=demo.querySelector('.mini i'), zl=demo.querySelector('.zl');
    const sts=[...demo.querySelectorAll('.st')];
    let k=-1, uz=1, ux=0, uy=0, base={s:1,tx:0,ty:0};
    function apply(){
      const W=vp.clientWidth,H=vp.clientHeight,cx=W/2,cy=H/2,{s,tx,ty}=base;
      fr.style.transform=`translate(${ux}px,${uy}px) translate(${cx}px,${cy}px) scale(${uz}) translate(${-cx}px,${-cy}px) translate(${tx}px,${ty}px) scale(${s})`;
      const S=s*uz; hl.style.borderWidth=(3/S)+'px'; hl.style.borderRadius=(6/S)+'px';
      if(zl){zl.textContent=Math.round(uz*100)+'%'; demo.classList.toggle('zoomed',uz>1.001);}
    }
    function layout(){
      const f=frames[k]; const W=vp.clientWidth,H=vp.clientHeight; if(!W)return;
      if(img.dataset.src!==f.img){img.src=f.img;img.dataset.src=f.img;}
      fr.style.width=f.w+'px';fr.style.height=f.h+'px';fr.style.position='absolute';fr.style.left='0';fr.style.top='0';
      let s,tx,ty;
      if(f.phase==='zoom'&&f.rect){
        // 寄る時も画面の半分程度は映す（対象が小さくても文脈が分かるように）
        const r=f.region||regionFor(f,f.rect),pad=28;
        s=Math.min((W-pad*2)/r.w,(H-pad*2)/r.h,Math.max(1.6,Math.min(W/f.w,H/f.h)*2.2));
        tx=(W-r.w*s)/2-r.x*s; ty=(H-r.h*s)/2-r.y*s;
        if(f.w*s<=W){tx=(W-f.w*s)/2;}
        if(f.h*s<=H){ty=(H-f.h*s)/2;}
      }else{
        s=Math.min(W/f.w,H/f.h); tx=(W-f.w*s)/2; ty=(H-f.h*s)/2;
      }
      base={s,tx,ty}; apply();
      const hr=f.hl||(f.phase==='zoom'&&f.zoom?null:f.rect);
      if(hr){const r=hr;hl.classList.remove('off');hl.style.left=r.x+'px';hl.style.top=r.y+'px';hl.style.width=r.w+'px';hl.style.height=r.h+'px';}
      else hl.classList.add('off');
      const da=fr.querySelector('.dropanim'); if(da){ if(f.anim==='drop'&&f.rect){const r=f.rect; da.classList.remove('off'); da.style.left=r.x+'px'; da.style.top=r.y+'px'; da.style.width=r.w+'px'; da.style.height=r.h+'px'; da.style.setProperty('--s',1/((base.s||1)*uz)); da.classList.remove('run'); void da.offsetWidth; da.classList.add('run');} else da.classList.add('off'); }
      if(cap){cap.textContent=f.caption||'';cap.style.display=f.caption?'block':'none';}
      if(prog)prog.style.width=((k+1)/frames.length*100)+'%';
      if(mini&&f.rect){const r=f.rect;mini.style.left=(r.x/f.w*100)+'%';mini.style.top=(r.y/f.h*100)+'%';mini.style.width=(r.w/f.w*100)+'%';mini.style.height=(r.h/f.h*100)+'%';}
      sts.forEach((st,i)=>{st.classList.toggle('cur',i===f.step);st.classList.toggle('done',i<f.step);
        const dots=st.querySelectorAll('.dots i');dots.forEach((d,j)=>{d.classList.toggle('on',i===f.step&&j===f.sub);d.classList.toggle('done',i<f.step||(i===f.step&&j<f.sub));});});
      const stEl=sts[f.step]; if(stEl) stEl.scrollIntoView({block:'nearest',behavior:'smooth'});
    }
    function go(n){n=Math.max(0,Math.min(frames.length-1,n));if(n===k)return false;k=n;uz=1;ux=0;uy=0;layout();return true;}
    /* zoom: 画面上の点 (px,py) を固定して倍率を nz にする */
    function zoomTo(nz,px,py){
      nz=Math.max(1,Math.min(6,nz)); const W=vp.clientWidth,H=vp.clientHeight,cx=W/2,cy=H/2;
      if(px==null){px=cx;py=cy;}
      const ratio=nz/uz; ux=px-cx-ratio*(px-ux-cx); uy=py-cy-ratio*(py-uy-cy); uz=nz;
      if(uz<=1.001){uz=1;ux=0;uy=0;}
      fr.style.transition='transform .18s ease'; apply();
    }
    demo._init=()=>{if(k<0)k=0;requestAnimationFrame(layout);};
    demo._next=()=>go(k+1>=frames.length?0:k+1); demo._prev=()=>go(k-1);   // 最後のコマの次は最初に戻る
    demo._zoomIn=()=>zoomTo(uz*1.4); demo._zoomOut=()=>zoomTo(uz/1.4); demo._zoomReset=()=>zoomTo(1);
    let acc=0,lock=0;
    screen.addEventListener('wheel',e=>{
      e.preventDefault();
      const r=vp.getBoundingClientRect(), px=e.clientX-r.left, py=e.clientY-r.top;
      if(e.ctrlKey||e.metaKey){ zoomTo(uz*(e.deltaY<0?1.12:1/1.12),px,py); return; }
      if(uz>1.001){ ux-=e.deltaX; uy-=e.deltaY; fr.style.transition='none'; apply(); return; }
      const now=Date.now();if(now<lock)return;acc+=e.deltaY;if(Math.abs(acc)>40){acc>0?demo._next():demo._prev();acc=0;lock=now+450;}
    },{passive:false});
    /* drag to pan (zoomed) / click to advance (not zoomed) */
    let drag=null,moved=false;
    screen.addEventListener('pointerdown',e=>{if(e.target.closest('.ztools'))return;drag={x:e.clientX-ux,y:e.clientY-uy};moved=false;screen.setPointerCapture(e.pointerId);});
    screen.addEventListener('pointermove',e=>{if(!drag||uz<=1.001)return;const nx=e.clientX-drag.x,ny=e.clientY-drag.y;if(Math.abs(nx-ux)+Math.abs(ny-uy)>2)moved=true;ux=nx;uy=ny;fr.style.transition='none';apply();});
    screen.addEventListener('pointerup',e=>{const was=drag;drag=null;if(!was||e.target.closest('.ztools'))return;if(!moved&&uz<=1.001)demo._next();});
    screen.addEventListener('dblclick',e=>{if(e.target.closest('.ztools'))return;const r=vp.getBoundingClientRect();zoomTo(uz>1.001?1:2.5,e.clientX-r.left,e.clientY-r.top);});
    const zt=demo.querySelector('.ztools'); if(zt){zt.querySelector('.zi').addEventListener('click',demo._zoomIn);zt.querySelector('.zo').addEventListener('click',demo._zoomOut);zt.querySelector('.zr').addEventListener('click',demo._zoomReset);}
    sts.forEach((st,i)=>st.addEventListener('click',()=>{const n=frames.findIndex(f=>f.step===i);if(n>=0)go(n);}));
    // 拡大中は寄り倍率の上限を少し上げる

    new ResizeObserver(()=>{if(k>=0)layout();}).observe(vp);
  });

  /* ---------- demo tabs（テスト対象の切替） ---------- */
  document.querySelectorAll('.tabdemo').forEach(t=>{
    const bs=[...t.querySelectorAll('.dtabs button')],ps=[...t.querySelectorAll('.dpane')];
    bs.forEach((b,i)=>b.addEventListener('click',()=>{bs.forEach((x,k)=>x.classList.toggle('on',k===i));ps.forEach((x,k)=>x.classList.toggle('on',k===i));const d=ps[i].querySelector('.demo');if(d&&d._init)d._init();}));
  });

  /* ---------- compare slider ---------- */
  document.querySelectorAll('.cmp').forEach(c=>{
    const set=x=>{const r=c.getBoundingClientRect();c.style.setProperty('--x',Math.max(0,Math.min(100,(x-r.left)/r.width*100))+'%');};
    let down=false;
    c.addEventListener('pointerdown',e=>{down=true;set(e.clientX);c.setPointerCapture(e.pointerId);});
    c.addEventListener('pointermove',e=>{if(down)set(e.clientX);});
    c.addEventListener('pointerup',()=>down=false);c.addEventListener('pointercancel',()=>down=false);
  });

  /* ---------- LP viewer tabs ---------- */
  document.querySelectorAll('.lpv').forEach(v=>{
    const bs=[...v.querySelectorAll('.tabs button')],ims=[...v.querySelectorAll('.lp-scroll > .lppane')],sc=v.querySelector('.lp-scroll');
    bs.forEach((b,i)=>b.addEventListener('click',()=>{bs.forEach((x,j)=>x.classList.toggle('on',i===j));ims.forEach((x,j)=>x.classList.toggle('on',i===j));sc.scrollTop=0;}));
  });

  /* ---------- lightbox ---------- */
  const lb=document.getElementById('lb'),lbi=lb.querySelector('img');let z=1,px=0,py=0,drag=null;
  function lbLayout(){lbi.style.transform=`translate(${px}px,${py}px) scale(${z})`;}
  document.querySelectorAll('img.zoomable').forEach(im=>im.addEventListener('click',e=>{e.stopPropagation();lbi.src=im.dataset.full||im.src;lb.classList.add('on');
    lbi.onload=()=>{z=Math.min(innerWidth/lbi.naturalWidth,innerHeight/lbi.naturalHeight,1);px=(innerWidth-lbi.naturalWidth*z)/2;py=(innerHeight-lbi.naturalHeight*z)/2;lbLayout();};}));
  lb.querySelector('.x').addEventListener('click',()=>lb.classList.remove('on'));
  lb.addEventListener('wheel',e=>{e.preventDefault();const f=e.deltaY<0?1.15:1/1.15;const nz=Math.max(.2,Math.min(6,z*f));px=e.clientX-(e.clientX-px)*nz/z;py=e.clientY-(e.clientY-py)*nz/z;z=nz;lbLayout();},{passive:false});
  lb.addEventListener('pointerdown',e=>{drag={x:e.clientX-px,y:e.clientY-py};lb.setPointerCapture(e.pointerId);});
  lb.addEventListener('pointermove',e=>{if(drag){px=e.clientX-drag.x;py=e.clientY-drag.y;lbLayout();}});
  lb.addEventListener('pointerup',()=>drag=null);
  lb.addEventListener('dblclick',()=>lb.classList.remove('on'));

  /* ---------- keys ---------- */
  document.addEventListener('keydown',e=>{
    if(lb.classList.contains('on')){if(e.key==='Escape')lb.classList.remove('on');return;}
    const d=slides[cur]&&(slides[cur].querySelector('.dpane.on .demo')||slides[cur].querySelector('.demo'));
    if(e.key==='ArrowRight'||e.key==='PageDown')show(cur+1);
    else if(e.key==='ArrowLeft'||e.key==='PageUp')show(cur-1);
    else if(e.key==='ArrowDown'||e.key===' '){if(d){e.preventDefault();d._next();}else show(cur+1);}
    else if(e.key==='ArrowUp'){if(d){e.preventDefault();d._prev();}else show(cur-1);}
    else if(d&&(e.key==='+'||e.key==='=')){d._zoomIn();}
    else if(d&&e.key==='-'){d._zoomOut();}
    else if(d&&e.key==='0'){d._zoomReset();}
    else if(e.key==='f'||e.key==='F'){document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen();}
    else if(/^[0-9]$/.test(e.key)){const p=navParts.find(p=>p.dataset.part===e.key);if(p)p.click();}
  });
  fromHash();
})();
