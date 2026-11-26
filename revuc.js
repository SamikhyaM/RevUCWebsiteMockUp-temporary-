/* RevUC scripts. Part 1 draws the original painted city and drives its interactions.
   Part 2 adds the FAQ storefront, forms and font-pairing switcher. */
(function(){
/* SWIPE = touch screens and narrow windows drive by swiping left; wide mouse screens drive by scrolling down */
var COARSE=matchMedia('(pointer:coarse)').matches,SWIPE=COARSE||innerWidth<760;
if(SWIPE)document.documentElement.classList.add('swipe');
if(!COARSE)matchMedia('(max-width:759px)').addEventListener('change',function(){location.reload()});   // crossing the breakpoint switches modes
var $=function(i){return document.getElementById(i)};
/* ========== SETTINGS ==========
   Everything is drawn in "units" on a canvas that is 180 units tall (VH).
   GY = ground line under the buildings, RD = top of the road, WL = total world length. */
var VH=180,GY=138,RD=148,WL=3800,RS=3;
var cv=document.getElementById('cv'),g=cv.getContext('2d'),track=document.getElementById('track'),
    hero=document.getElementById('hero'),hint=document.getElementById('hint'),
    sched=document.getElementById('sched'),spon=document.getElementById('spon'),subw=document.getElementById('subway'),about=document.getElementById('about'),stage=document.getElementById('stage'),where=document.getElementById('where'),whereTxt=document.getElementById('whereTxt'),prog=document.getElementById('prog');
var W,H,VW,U,OFF=0,DPR,camMax,camS=0,SX,PX,BX,AX,seed=5,FAR=[],MID=[],gaps=[],cars=[],BR={},t=0,pr=0,vel=0,S={},LM={},grain;

/* ====================================================================
   IMAGE SWAP POINTS  (put your own artwork here)
   --------------------------------------------------------------------
   Everything on screen is painted by code at startup. To use an image
   instead, set the matching entry below to a URL. Leave null to keep the
   painted version. Each image is auto-fitted: it is scaled to the layer's
   height and repeated sideways, so a wide panorama that tiles works best.
   (Tiles, sprites and the paper grain are stretched to their exact size.)

   In a published artifact, remote URLs are blocked: use a data: URL
   ('data:image/png;base64,....'). On your own site, use normal paths
   such as 'img/far.png'.

   LAYER ORDER (back to front)      parallax   export size (3 px per unit)
     1  sky       sunset bands, clouds     2%   any width x 540 px
     2  sun       sun disc + halo          3%   240 x 240 px
     3  far       far skyline + towers    10%   any width x 540 px
     4  midfar    Union Terminal          22%   any width x 540 px
     5  mid       street buildings, Fountain Square, UC, 1819 Hub   55%   any width x 540 px
     6  bridge    Roebling Bridge        100%   3060 x 540 px (world strip)
     7  walk      sidewalk + lamps       100%   1080 x 150 px (tile, repeats every 360 units)
     8  road      asphalt                100%   1080 x 96 px  (tile, repeats every 360 units)
     9  cars      7 sprites, facing right       102 x 60 px each (index 6 = player's car)
    10  glow      soft light sprite (lamps, windows)   102 x 102 px
    11  grain     paper texture over everything   any square, repeats
   ==================================================================== */
var IMAGES={sky:null,sun:null,far:null,midfar:null,mid:null,bridge:null,walk:null,road:null,
            cars:[null,null,null,null,null,null,null],glow:null,grain:null};
/* Effects that are drawn by code at fixed spots (flashing windows, tower glows, fountain spray).
   They switch off automatically when you replace the layer they sit on, so they don't float in the wrong place. */
var FX={windows:true,glow:true,spray:true};
/* Q = scroll progress (0 to 1) at which each landmark is centered on screen */
var Q={carew:.08,fifth:.14,gat:.18,pnc:.22,scripps:.26,ws:.30,fs:.09,sch:.24,about:.29,br:.34,trk:.6,ut:.66,faq:.72,uc:.80,sub:.86};
function rnd(){seed=(seed*16807)%2147483647;return seed/2147483647}
function hh(a,b){var n=Math.sin(a*12.9898+b*78.233)*43758.5453;return n-Math.floor(n)}
function mod(a,n){return((a%n)+n)%n}
function cl(v){return v<0?0:v>255?255:v|0}
function jit(col,k){if(col.charAt(0)!=='#')return col;var n=parseInt(col.slice(1),16),d=(rnd()-.5)*k;return'rgb('+cl((n>>16)+d)+','+cl((n>>8&255)+d)+','+cl((n&255)+d)+')'}
function dk(col,k){var n=parseInt(col.slice(1),16);return'rgb('+cl((n>>16)-k)+','+cl((n>>8&255)-k)+','+cl((n&255)-k)+')'}
function mk(w,h){var c=document.createElement('canvas');c.width=Math.ceil(w*RS);c.height=Math.ceil(h*RS);var x=c.getContext('2d');x.scale(RS,RS);return{c:c,x:x}}

/* ========== BRUSH HELPERS (the painted look) ========== */
function poly(c,x,y,w,h,col,wb,a){var J=function(){return(rnd()-.5)*2*wb},i;c.globalAlpha=a==null?1:a;c.fillStyle=col;c.beginPath();c.moveTo(x+J(),y+J());
  for(i=x;i<x+w;i+=3)c.lineTo(i,y+J());for(i=y;i<y+h;i+=3)c.lineTo(x+w+J(),i);for(i=x+w;i>x;i-=3)c.lineTo(i,y+h+J());for(i=y+h;i>y;i-=3)c.lineTo(x+J(),i);c.closePath();c.fill();c.globalAlpha=1}
function strokes(c,x,y,w,h,col,n,len,a,th){c.globalAlpha=a;for(var i=0;i<n;i++){var l=len*(.5+rnd());c.fillStyle=jit(col,50);c.fillRect(x+rnd()*Math.max(1,w-l),y+rnd()*h,l,th*(.6+rnd()))}c.globalAlpha=1}
function wall(c,x,y,w,h,col){poly(c,x,y,w,h,col,.7);strokes(c,x,y,w,h,col,w*h/10,9,.35,1.3);strokes(c,x,y,w,h,dk(col,45),w*h/38,5,.3,.7)}
function leaf(c,x,y,r,col,a){c.save();c.translate(x,y);c.rotate(rnd()*3.14);c.globalAlpha=a;c.fillStyle=col;c.beginPath();c.ellipse(0,0,r,r*.55,0,0,6.283);c.fill();c.restore();c.globalAlpha=1}
function foliage(c,x,y,w,h,cols,fl,sp){var n=w*h/4|0,i,a,r;
  for(i=0;i<n;i++){a=rnd()*6.283;r=Math.sqrt(rnd());leaf(c,x+w/2+Math.cos(a)*r*w/2,y+h/2+Math.sin(a)*r*h/2,1.1+rnd()*1.6,jit(cols[rnd()*cols.length|0],44),.93)}
  for(i=0;i<n/6;i++){a=rnd()*6.283;r=Math.sqrt(rnd());leaf(c,x+w/2+Math.cos(a)*r*w/2,y+h/2+Math.sin(a)*r*h/2,.6+rnd()*.5,(sp||'#1c2a24'),.55)}
  if(fl)for(i=0;i<n/5;i++){a=rnd()*6.283;r=Math.sqrt(rnd());c.fillStyle=fl[rnd()*fl.length|0];c.beginPath();c.arc(x+w/2+Math.cos(a)*r*w/2,y+h/2+Math.sin(a)*r*h/2,.7+rnd()*.5,0,6.283);c.fill()}}
function circ(c,cx,cy,r,col,a){c.globalAlpha=a;c.fillStyle=col;c.beginPath();for(var i=0;i<18;i++){var an=i/18*6.283,rr=r*(1+(rnd()-.5)*.07);c.lineTo(cx+Math.cos(an)*rr,cy+Math.sin(an)*rr)}c.closePath();c.fill();c.globalAlpha=1}

/* Ginkgo street tree: brown trunk that forks, round canopy of yellow fan-shaped leaves.
   x = trunk center, base = ground y, h = total height in units. Reuse it in any layer you paint. */
var GINK=['#f7c531','#ffd84a','#f0a81e','#ffe27a','#e8941a'];
function ginkgo(c,x,base,h){var w=h*.66;
  poly(c,x-1.6,base-h*.5,3.2,h*.5,'#5a3a22',.3);
  c.strokeStyle='#5a3a22';c.lineWidth=1.1;c.beginPath();c.moveTo(x,base-h*.45);c.lineTo(x-w*.28,base-h*.7);c.moveTo(x,base-h*.45);c.lineTo(x+w*.28,base-h*.7);c.stroke();
  foliage(c,x-w/2,base-h,w,h*.66,GINK,['#fff0b8','#ffe27a'],'#8a5a12')}

/* ========== BUILD: lay out the world (positions only, no drawing) ========== */
function build(){
  seed=5;camMax=WL-VW;var x=-10,L=camMax*.1+VW+60,i;FAR=[];
  // generic far skyline filler
  while(x<L){var w=9+(rnd()*12|0),h=22+(rnd()*48|0),b={x:x,w:w,h:h,win:[]};
    for(var wy=GY-h+4;wy<GY-30;wy+=5)for(var wx=2;wx<w-2;wx+=4)if(rnd()<.16)b.win.push(wx,wy,rnd()*9|0);
    FAR.push(b);x+=w+(rnd()*3|0)}
  // named downtown towers sit on the far layer (moves at 10% of the car's speed)
  ['carew','fifth','gat','pnc','scripps','ws'].forEach(function(n){LM[n]=Q[n]*camMax*.1+VW*.5});
  LM.ut=Q.ut*camMax*.22+VW*.5;                      // Union Terminal: mid-far layer (22%)
  // Roebling Bridge: a full-speed foreground strip; tower 1 reaches the car at scroll Q.br
  var t1=Q.br*camMax+VW*(.12+.5*Q.br)+22;
  BR={x0:t1-130,w:1020,t1:130,t2:890};
  // mid layer (55% speed): gaps where no regular buildings are drawn
  var cfs=Q.fs*camMax*.55+VW*.5,cut=Q.ut*camMax*.55+VW*.5;LM.fs=cfs;
  gaps=[[cfs-80,cfs+80],[.55*(BR.x0-VW)-10,.55*(BR.x0+BR.w)+VW+10],[cut-VW*.58,cut+VW*.58]];   // fountain, bridge, terminal
  var specs=[{c:Q.uc*camMax*.55+VW*.5,w:170,sp:'uc'},{c:camMax*.55+VW*.74,w:176,sp:'hub'}],si=0;
  var pal=[['#1f5f78','#13404f'],['#2c6e8a','#1b4a5e'],['#1a5267','#0f3342'],['#245a72','#143c4e'],['#1a5267','#0f3342'],['#2a6078','#173f52'],['#1c5870','#103a4a'],['#b5503a','#7e2f22'],['#e08a3a','#a85a1f']];   // mostly logo-teal blues, a couple of warm accents
  MID=[];x=-20;L=camMax*.55+VW+80;
  while(x<L){gaps.forEach(function(gp){if(x>gp[0]-30&&x<gp[1])x=gp[1]});
    if(si<2&&x>=specs[si].c-specs[si].w/2-20){          // UC campus + 1819 Innovation Hub
      var s=specs[si++],hub=s.sp==='hub',m={x:Math.max(x,s.c-s.w/2),w:s.w,h:hub?108:112,sp:s.sp,c:hub?'#d8b987':'#9a3a2e',d:hub?'#a88a58':'#5a1f1a',aw:'#fff',bar:false,lit:hub,vine:false,tank:false,ww:hub?32:6,wh:8,lr:hub?[98,30,40,30]:null,win:[]};
      if(hub){for(var ry=12;ry<=64;ry+=26)for(var rx=6;rx<100;rx+=35){var q=rnd();m.win.push(rx,ry,q<.55?1:(q<.75?2:0),rnd()*9|0)}}
      else{[6,22,38,112,152].forEach(function(dx){[66,78].forEach(function(dy){var q=rnd();m.win.push(dx,dy,q<.5?1:(q<.7?2:0),rnd()*9|0)})})}
      MID.push(m);x=m.x+m.w+4;continue}
    var w2=38+(rnd()*28|0),h2=46+(rnd()*44|0),c=pal[rnd()*pal.length|0],m2={x:x,w:w2,h:h2,c:c[0],d:c[1],aw:rnd()>.5?'#f0e2c4':'#f2a03a',bar:rnd()<.12,lit:rnd()<.6,vine:rnd()<.55,tank:rnd()<.25,ww:6,wh:8,lr:[3,17,w2-6,17],win:[]};
    for(var wy2=6;wy2<h2-30;wy2+=14)for(var wx2=5;wx2<w2-8;wx2+=11){var r=rnd();m2.win.push(wx2,wy2,r<.45?1:(r<.62?2:0),rnd()*9|0)}
    MID.push(m2);x+=w2+(rnd()*2|0)}
  cars=[];for(i=0;i<7;i++)cars.push({x0:rnd()*400,v:16+rnd()*22,k:i%6,y:i%2?157:161});
  // world x of the three big signs (sponsors hangs over the middle of the bridge)
  SX=Q.sch*camMax+VW*(.12+.5*Q.sch)+30;PX=BR.x0+510;BX=Q.sub*camMax+VW*(.12+.5*Q.sub)+30;AX=Q.about*camMax+VW*(.12+.5*Q.about)+30}

/* ========== PAINT: pre-render every layer once into offscreen canvases ========== */
var SKY=['#1d6275','#35808c','#c98f70','#f2824a','#f27230','#f58334','#f79439','#f9a83e','#fcc454','#ffdf8a'];   // thin teal dusk at the top, then logo orange -> yellow glow
function tier(c,cx,y,w,h,col,plain){poly(c,cx-w/2,y-h,w,h,col,.5);strokes(c,cx-w/2,y-h,w,h,col,w*h/9,8,.3,1);strokes(c,cx-w/2,y-h,w,h,'#7fb0c0',w*h/50,6,.25,.8);if(!plain)strokes(c,cx-w/2+1,y-h+2,w-2,h-3,'#ffd9a0',w*h/45,1.2,.55,1.2)}
function cap(c,cx,y,w,h,col){c.fillStyle=col;c.beginPath();c.moveTo(cx-w/2,y);c.lineTo(cx,y-h);c.lineTo(cx+w/2,y);c.fill()}
function fountain(c,cx){   // Fountain Square: Tyler Davidson fountain ("Genius of Water")
  poly(c,cx-72,GY-4,144,4,'#d8b898',.5);strokes(c,cx-72,GY-4,144,4,'#d8c0cc',40,6,.4,.8);
  c.fillStyle='#7a8a9a';c.beginPath();c.ellipse(cx,GY-5,34,6,0,0,6.283);c.fill();
  c.fillStyle='#5fb0d0';c.beginPath();c.ellipse(cx,GY-7,30,4,0,0,6.283);c.fill();strokes(c,cx-26,GY-10,52,5,'#bfe8ff',14,5,.5,.8);
  poly(c,cx-10,GY-14,20,8,'#6a7a6a',.3);poly(c,cx-6,GY-42,12,30,'#5f8a70',.4);poly(c,cx-8,GY-44,16,3,'#4f7a60',.3);
  poly(c,cx-3,GY-57,6,14,'#6a9a80',.3);circ(c,cx,GY-60,3,'#6a9a80',1);poly(c,cx-17,GY-54,34,2.4,'#6a9a80',.3);
  ginkgo(c,cx-62,GY,56);ginkgo(c,cx+62,GY,56)}
function ucBody(c,b){var cx=b.x+b.w/2,i;   // UC campus: brick wings + clock tower
  wall(c,b.x,GY-52,62,52,'#a8452f');wall(c,b.x+b.w-62,GY-52,62,52,'#a8452f');wall(c,cx-14,GY-112,28,112,'#9a3a2e');
  poly(c,b.x-1,GY-54,64,3,b.d,.3);poly(c,b.x+b.w-63,GY-54,64,3,b.d,.3);
  for(i=0;i<4;i++)poly(c,b.x+8+i*13,GY-22,3,22,'#f0e6d4',.3);poly(c,b.x+4,GY-26,52,3,'#f0e6d4',.3);
  poly(c,cx-8,GY-80,16,12,'#0f2b38',.3);circ(c,cx,GY-96,6.5,'#f6f1e7',1);
  c.strokeStyle='#0f2b38';c.lineWidth=.7;c.beginPath();c.moveTo(cx,GY-96);c.lineTo(cx,GY-100);c.moveTo(cx,GY-96);c.lineTo(cx+3,GY-95);c.stroke();
  c.fillStyle='#12384a';c.beginPath();c.moveTo(cx-16,GY-112);c.lineTo(cx,GY-136);c.lineTo(cx+16,GY-112);c.fill();
  poly(c,b.x+b.w-46,GY-46,22,18,'#c4202e',.3);c.fillStyle='#fff';c.font='bold 11px Georgia,serif';c.fillText('UC',b.x+b.w-41,GY-33);
  poly(c,b.x-26,GY-5,b.w+52,5,'#5b8a52',.6);
  ginkgo(c,b.x-12,GY,58);ginkgo(c,b.x+b.w+14,GY,58)}
function hubBody(c,b){   // 1819 Innovation Hub, drawn from the photo: buff-brick wing with ribbon windows + curved glass corner
  var x=b.x,top=GY-108,i,j;
  wall(c,x,top,112,108,'#d8b987');strokes(c,x,top,112,108,'#b99a68',60,12,.35,.7);          // buff brick wing
  for(i=0;i<3;i++)poly(c,x,top+22+i*27,112,2,'#a88a58',.3,.7);                              // floor bands
  poly(c,x-3,top-2,116,3,'#3a4650',.3);                                                      // roof edge
  wall(c,x-10,top+30,10,78,'#4a5662');for(i=0;i<8;i++)poly(c,x-9,top+34+i*9,8,1.2,'#2f3a44',.2);   // louvered utility tower
  poly(c,x+112,top-2,64,110,'#3f7f98',.5);strokes(c,x+112,top-2,64,110,'#8fc4d4',40,8,.35,1.1);    // curved glass corner
  strokes(c,x+112,top+30,64,70,'#f5a05a',16,10,.28,1.4);                                    // sunset reflected in the glass
  for(i=0;i<=64;i+=8)poly(c,x+112+i,top-2,1.2,110,'#1f4a5a',.1,.9);                          // mullions
  for(j=0;j<110;j+=13)poly(c,x+112,top-2+j,64,1,'#1f4a5a',.1,.9);
  poly(c,x+110,top-2,4,110,'#3a4650',.2);poly(c,x+172,top-2,4,110,'#3a4650',.2);             // steel corner columns
  poly(c,x,GY-34,b.w,4,'#2c3a44',.3);poly(c,x,GY-30,98,30,'#1b2a34',.4);                      // canopy + dark ground floor
  poly(c,x+98,GY-30,40,30,'#c9a56a',.3);poly(c,x+117,GY-30,1.2,30,'#2c3a44',.1);             // glass doors, warm light inside
  poly(c,x+114,GY-60,48,22,'#1b2a34',.3);                                                    // dark panel behind the 1819 mark
  c.fillStyle='#fff';c.font='bold 17px Arial,sans-serif';c.fillText('1819',x+118,GY-43);
  c.font='bold 8px Arial,sans-serif';c.fillText('INNOVATION HUB',x+5,GY-20);
  c.font='bold 4px Arial,sans-serif';c.fillText('WHERE NEXT HAPPENS',x+6,GY-14);
  poly(c,x+88,GY-46,4,46,'#f3f3ee',.1);poly(c,x+89,GY-42,2,30,'#7aa8b8',.1);                  // white wayfinding post
  poly(c,x-14,GY-4,b.w+36,4,'#6b8f3a',.5);                                                   // lawn
  foliage(c,x-16,GY-15,26,13,['#9ab23a','#c8b43c','#6b8f3a'],null);foliage(c,x+140,GY-15,40,13,['#9ab23a','#c8b43c','#6b8f3a'],null);
  poly(c,x+160,GY-30,3,30,'#1b2a34',.1);poly(c,x+159,GY-30,5,14,'#2f7fd0',.1);              // blue help-phone pole
  ginkgo(c,x-26,GY,56);ginkgo(c,x+b.w+20,GY,56)}

function paint(){
  seed=77;var i,j,k,c,s;
  // sky: banded gradient with horizontal brush streaks and clouds
  
  // ◄ IMAGE SWAP: IMAGES.sky replaces this layer
  s=mk(VW+100,VH);c=s.x;S.sky=s.c;
  for(i=0;i<10;i++)poly(c,-4,i*14-2,VW+108,17,SKY[i],1.4);
  for(i=0;i<9;i++){strokes(c,0,(i+1)*14-3,VW+100,6,SKY[i+1],(VW+100)/3,28,.55,2.2);strokes(c,0,(i+1)*14-4,VW+100,6,SKY[i],(VW+100)/5,24,.4,2)}
  for(i=0;i<24;i++){var cy2=8+rnd()*104,up=cy2<46;poly(c,rnd()*(VW+40),cy2,40+rnd()*110,1.6+rnd()*3,up?'#6fb0b8':(rnd()>.5?'#ffe9c0':'#e2622a'),1.2,up?.24:.36)}   // long wispy cloud streaks
  // sun and soft glow sprites
  
  // ◄ IMAGE SWAP: IMAGES.sun replaces this layer
  s=mk(80,80);c=s.x;S.sun=s.c;circ(c,40,40,37,'#ffd27a',.12);circ(c,40,40,28,'#ffd27a',.18);circ(c,40,40,18,'#fff0b8',1);strokes(c,24,28,32,24,'#ffe9a0',10,10,.4,1.2);
  
  // ◄ IMAGE SWAP: IMAGES.glow replaces this layer
  s=mk(34,34);c=s.x;S.glow=s.c;var gr=c.createRadialGradient(17,17,0,17,17,17);gr.addColorStop(0,'rgba(255,214,130,.95)');gr.addColorStop(1,'rgba(255,170,90,0)');c.fillStyle=gr;c.fillRect(0,0,34,34);
  // far layer: filler skyline + the named downtown towers
  
  // ◄ IMAGE SWAP: IMAGES.far replaces this layer
  s=mk(camMax*.1+VW+60,VH);c=s.x;S.far=s.c;var TC='#245c74';
  FAR.forEach(function(b){poly(c,b.x,GY-b.h,b.w,b.h,jit('#2f6078',24),.9);strokes(c,b.x,GY-b.h,b.w,b.h,'#9cc3cf',b.w*b.h/30,6,.22,1)});
  tier(c,LM.carew,GY,24,52,TC);tier(c,LM.carew,GY-52,18,20,TC);tier(c,LM.carew,GY-72,12,16,TC);tier(c,LM.carew,GY-88,7,14,TC);tier(c,LM.carew,GY-102,2.4,11,TC);   // Carew Tower (stepped)
  tier(c,LM.fifth,GY,28,58,'#3a7690');c.fillStyle='#3a7690';c.beginPath();c.moveTo(LM.fifth-14,GY-58);c.lineTo(LM.fifth+14,GY-58);c.lineTo(LM.fifth+14,GY-73);c.fill();   // Fifth Third Center (slanted top)
  tier(c,LM.gat,GY,20,84,TC);   // Great American Tower + tiara crown
  [[-9,10],[0,17],[9,10]].forEach(function(sp){c.fillStyle=TC;c.beginPath();c.moveTo(LM.gat+sp[0]-2.4,GY-84);c.lineTo(LM.gat+sp[0],GY-84-sp[1]);c.lineTo(LM.gat+sp[0]+2.4,GY-84);c.fill()});
  tier(c,LM.pnc,GY,18,74,'#3a7690');cap(c,LM.pnc,GY-74,18,14,'#3a7690');   // PNC Tower (pyramid cap)
  tier(c,LM.scripps,GY,22,64,TC);tier(c,LM.scripps,GY-64,16,12,TC);cap(c,LM.scripps,GY-76,16,10,TC);   // Scripps Center
  tier(c,LM.ws,GY,26,82,'#3a7690');tier(c,LM.ws,GY-82,16,10,'#3a7690');tier(c,LM.ws,GY-92,8,8,'#3a7690');tier(c,LM.ws,GY-100,2,8,'#3a7690');   // Western & Southern
  var hz=c.createLinearGradient(0,GY-110,0,GY);hz.addColorStop(0,'rgba(255,190,100,0)');hz.addColorStop(1,'rgba(255,190,100,.36)');c.fillStyle=hz;c.fillRect(0,0,camMax*.1+VW+60,VH);
  // Union Terminal (half dome) on the mid-far layer
  
  // ◄ IMAGE SWAP: IMAGES.midfar replaces this layer
  s=mk(camMax*.22+VW+60,VH);c=s.x;S.b=s.c;
  var ux=LM.ut;poly(c,ux-47,GY-16,94,16,'#2f6a80',.5);poly(c,ux-31,GY-24,62,9,'#2f6a80',.4);
  for(i=30;i>=20;i-=2){c.fillStyle=i%4?'#3a7690':'#2f6a80';c.beginPath();c.arc(ux,GY-24,i,Math.PI,0);c.closePath();c.fill()}
  c.fillStyle='#103846';c.beginPath();c.arc(ux,GY-24,19,Math.PI,0);c.closePath();c.fill();strokes(c,ux-30,GY-50,60,26,'#7fb0c0',30,8,.25,.9);
  c.fillStyle=hz;c.fillRect(0,0,camMax*.22+VW+60,VH);
  // mid layer: street buildings, Fountain Square, campus lawn, UC, 1819 Hub
  
  // ◄ IMAGE SWAP: IMAGES.mid replaces this layer
  s=mk(camMax*.55+VW+80,VH);c=s.x;S.mid=s.c;
  fountain(c,LM.fs);
  poly(c,gaps[2][0],GY-6,gaps[2][1]-gaps[2][0],6,'#5b8a52',.7);for(i=0;i<8;i++)foliage(c,gaps[2][0]+rnd()*(gaps[2][1]-gaps[2][0]-16),GY-12,16,12,['#5f8f3a','#9ab23a','#3f6f3a'],['#ffb347','#fff0b8']);
  var trees=[];
  MID.forEach(function(b){var top=GY-b.h;if(!b.sp&&rnd()<.38)trees.push(b.x+b.w+rnd()*4-2,50+rnd()*18);
    if(b.sp==='uc')ucBody(c,b);else if(b.sp==='hub')hubBody(c,b);
    else{wall(c,b.x,top,b.w,b.h,b.c);poly(c,b.x-1,top-1,b.w+2,3,b.d,.4);
      if(b.tank){poly(c,b.x+b.w*.3,top-9,9,9,b.d,.5);poly(c,b.x+b.w*.3-1,top-11,11,3,'#5a3a2a',.4)}}
    for(k=0;k<b.win.length;k+=4){var wx=b.x+b.win[k],wy=top+b.win[k+1];   // painted window + highlight
      poly(c,wx-1.2,wy-1.2,b.ww+2.4,b.wh+2.4,'#0f2b38',.35);poly(c,wx,wy,b.ww,b.wh,'#2f6f8a',.25);
      c.globalAlpha=.5;c.strokeStyle='#cfe8ff';c.lineWidth=.7;c.beginPath();c.moveTo(wx+1,wy+b.wh-1);c.lineTo(wx+b.ww*.65,wy+1);c.stroke();c.globalAlpha=1;poly(c,wx-1.5,wy+b.wh+1,b.ww+3,1.5,'#f0e2c4',.3)}
    if(!b.sp){   // vines + shopfront (awning, glass, door, planter)
      if(b.vine)foliage(c,b.x+rnd()*(b.w-14),top+6+rnd()*10,12+rnd()*8,b.h*.45,['#5f8f3a','#9ab23a','#3f6f3a'],null);
      poly(c,b.x,GY-23,b.w,23,dk(b.c,30),.5);
      for(j=0;j<b.w;j+=4)poly(c,b.x+j,GY-23,4,5,(j/4|0)%2?b.aw:'#0f3342',.35);
      poly(c,b.x+3,GY-17,b.w-6,17,'#16394a',.4);strokes(c,b.x+3,GY-17,b.w-6,17,'#5a8ab0',6,6,.3,1);
      poly(c,b.x+b.w/2-3,GY-14,6,14,'#6a3a2a',.3);
      foliage(c,b.x+b.w-12,GY-10,10,10,['#5f8f3a','#c8b43c'],['#ffb347','#ffd27a'])}
    if(!b.sp){c.strokeStyle='rgba(11,36,48,.55)';c.lineWidth=.7;c.strokeRect(b.x,top,b.w,b.h)}});
  for(i=0;i<trees.length;i+=2)ginkgo(c,trees[i],GY,trees[i+1]);
  // Roebling Bridge: stone towers, blue suspension cables, railing and river (full-speed strip)
  
  // ◄ IMAGE SWAP: IMAGES.bridge replaces this layer
  s=mk(BR.w,VH);c=s.x;S.br=s.c;var cy,u,xx;
  poly(c,0,112,BR.w,36,'#1f5f78',.8);strokes(c,0,112,BR.w,36,'#5fa0b8',BR.w*.9,8,.3,1);strokes(c,0,112,BR.w,36,'#ff9a6a',BR.w*.2,6,.3,.9);strokes(c,0,112,BR.w,8,'#ffd27a',BR.w*.1,10,.25,.8);
  [BR.t1,BR.t2].forEach(function(tx){tier(c,tx,148,32,124,'#b98f6a',true);
    c.fillStyle='#0f2b38';c.beginPath();c.moveTo(tx-8,148);c.lineTo(tx-8,112);c.quadraticCurveTo(tx-8,100,tx,92);c.quadraticCurveTo(tx+8,100,tx+8,112);c.lineTo(tx+8,148);c.fill();
    [66,46].forEach(function(ay){c.beginPath();c.moveTo(tx-3,ay+10);c.lineTo(tx-3,ay+3);c.quadraticCurveTo(tx-3,ay-2,tx,ay-4);c.quadraticCurveTo(tx+3,ay-2,tx+3,ay+3);c.lineTo(tx+3,ay+10);c.fill()});
    poly(c,tx-18,22,36,4,'#8a6a4a',.3)});
  poly(c,0,138,BR.w,3,'#3f6fd0',.3);poly(c,0,141,BR.w,8,'#1b5367',.5);poly(c,0,133,BR.w,1.8,'#3f6fd0',.3);
  for(xx=0;xx<BR.w;xx+=8)poly(c,xx,134,1.6,8,'#0f3342',.2);
  c.strokeStyle='#3f6fd0';c.lineWidth=1.8;c.beginPath();c.moveTo(0,138);c.lineTo(BR.t1,30);c.moveTo(BR.t2,30);c.lineTo(BR.w,138);c.stroke();
  c.beginPath();c.moveTo(BR.t1,30);c.quadraticCurveTo((BR.t1+BR.t2)/2,186,BR.t2,30);c.stroke();   // main cable, sags to y=108
  c.strokeStyle='rgba(63,111,208,.85)';c.lineWidth=.5;
  for(xx=BR.t1+8;xx<BR.t2;xx+=7){u=(xx-BR.t1)/(BR.t2-BR.t1);cy=30*(1-u)*(1-u)+372*u*(1-u)+30*u*u;c.beginPath();c.moveTo(xx,cy);c.lineTo(xx,138);c.stroke()}
  for(xx=10;xx<BR.t1-6;xx+=12){cy=138-108*xx/BR.t1;c.beginPath();c.moveTo(xx,cy);c.lineTo(xx,138);c.stroke();c.beginPath();c.moveTo(BR.w-xx,cy);c.lineTo(BR.w-xx,138);c.stroke()}
  // sidewalk tile (lamps + planters) and road tile, both repeat every 360 units
  
  // ◄ IMAGE SWAP: IMAGES.walk replaces this layer
  s=mk(360,RD-(GY-40));c=s.x;S.walk=s.c;
  poly(c,-2,40,364,10,'#d4a27c',.5);
  for(i=-14;i<364;i+=14){poly(c,i,41,13,5.2,jit('#e0b992',34),.9,.8);poly(c,i+7,46.5,13,3.4,jit('#c08f6a',34),.9,.8)}
  poly(c,-2,48,364,2.2,'#1b5367',.4);
  [18,92,150,236,296,346].forEach(function(px){var w=22+rnd()*8,h=12+rnd()*6;foliage(c,px-w/2,40-h*.8,w,h,['#6b8f3a','#9ab23a','#4a7a3a','#c8b43c'],['#ffd27a','#ffb347','#ff9a3a','#fff0b8'])});
  ginkgo(c,122,41,40);ginkgo(c,262,41,40);strokes(c,0,41,360,9,'#f7c531',70,2.6,.55,.9);   // street ginkgos + fallen leaves
  [60,180,300].forEach(function(lx){poly(c,lx-1,8,2.4,32,'#0f2b38',.2);poly(c,lx-1,7,9,2.2,'#0f2b38',.2);poly(c,lx+5,8,5,2.6,'#0f2b38',.2)});
  
  // ◄ IMAGE SWAP: IMAGES.road replaces this layer
  s=mk(360,VH-RD);c=s.x;S.road=s.c;
  poly(c,-2,0,364,32,'#1f4458',.6);strokes(c,0,0,360,32,'#33647c',200,12,.28,1.4);strokes(c,0,0,360,32,'#0d2230',160,10,.3,1.2);
  poly(c,-2,13.6,364,.9,'#f7b538',.25);poly(c,-2,15.6,364,.9,'#f7b538',.25);poly(c,-2,0,364,1.8,'#0d2230',.3,.6);
  // car sprites (6 traffic colors + the red player car)   ◄ IMAGE SWAP: IMAGES.cars[0..6] (6 = player)
  S.car=['#2f7fd0','#f7b538','#3aa56a','#4aa3c0','#e8e0d0','#9fd0e0','#f27230'].map(function(col){
    var cs=mk(34,20),q=cs.x;poly(q,2,8.5,31,6.5,col,.5);poly(q,9,2.5,16,7,col,.5);
    poly(q,10.5,3.8,6,4.6,'#bfe3ff',.3,.85);poly(q,17.5,3.8,6,4.6,'#bfe3ff',.3,.85);
    strokes(q,2,8.5,31,6.5,col,16,6,.4,1);poly(q,2,12.7,31,1.6,'#000',.3,.25);
    poly(q,31,9.5,3,2.2,'#fff0b8',.3);poly(q,1,9.5,1.6,2.2,'#ff4a4a',.2);
    q.strokeStyle='rgba(11,36,48,.65)';q.lineWidth=.6;q.strokeRect(2,8.5,31,6.5);q.strokeRect(9,2.5,16,7);return cs.c});
  // paper grain overlay
  var gc=document.createElement('canvas');gc.width=gc.height=180;var gx=gc.getContext('2d');
  for(i=0;i<2600;i++){gx.globalAlpha=.25+rnd()*.35;gx.fillStyle=rnd()>.5?'#fff3e2':'#0f2b38';var z=1+rnd()*1.6;gx.fillRect(rnd()*180,rnd()*180,z,z)}
  grain=g.createPattern(gc,'repeat')}   // ◄ IMAGE SWAP: IMAGES.grain replaces the paper texture (see applyImages)


/* ========== IMAGE LOADING: swaps painted layers for your images (see IMAGES at the top) ========== */
var IMG={};   // cache of loaded images, so a window resize doesn't reload them
function loadImg(src){return new Promise(function(ok,no){var im=new Image();im.onload=function(){ok(im)};im.onerror=no;im.src=src})}
/* Draw an image onto a fresh layer canvas of w x h units. 'tile' repeats it sideways at full height; 'stretch' fills exactly. */
function fitImg(im,w,h,stretch){var s=mk(w,h);
  if(stretch)s.x.drawImage(im,0,0,w,h);
  else{var iw=Math.max(1,im.width*h/im.height);for(var x=0;x<w;x+=iw)s.x.drawImage(im,x,0,iw,h)}
  return s.c}
function applyImages(){
  var slots={   // key: [where it goes, width in units, height in units, stretch?]
    sky:['sky',VW+100,VH],sun:['sun',80,80,1],far:['far',camMax*.1+VW+60,VH],midfar:['b',camMax*.22+VW+60,VH],
    mid:['mid',camMax*.55+VW+80,VH],bridge:['br',BR.w,VH],walk:['walk',360,RD-(GY-40),1],road:['road',360,VH-RD,1],glow:['glow',34,34,1]};
  Object.keys(slots).forEach(function(k){var src=IMAGES[k];if(!src)return;var d=slots[k];
    (IMG[k]?Promise.resolve(IMG[k]):loadImg(src).then(function(im){return IMG[k]=im})).then(function(im){
      S[d[0]]=fitImg(im,d[1],d[2],d[3]);
      if(k==='mid')FX.windows=FX.spray=false;      // painted windows/fountain no longer exist
      if(k==='far'||k==='midfar')FX.glow=false}).catch(function(){})});
  IMAGES.cars.forEach(function(src,i){if(!src)return;(IMG['car'+i]?Promise.resolve(IMG['car'+i]):loadImg(src).then(function(im){return IMG['car'+i]=im})).then(function(im){S.car[i]=fitImg(im,34,20,1)}).catch(function(){})});
  if(IMAGES.grain)loadImg(IMAGES.grain).then(function(im){grain=g.createPattern(im,'repeat')}).catch(function(){});
}

/* ========== DRAW: per-frame work (cars, lights, parallax) ========== */
function drawCar(x,y,d,spr,sc,spin,beam){
  g.save();g.translate(x,y);g.scale(d*sc,sc);
  g.globalAlpha=.35;g.fillStyle='#0c0618';g.beginPath();g.ellipse(0,.5,18,2.2,0,0,6.283);g.fill();g.globalAlpha=1;
  g.drawImage(spr,-17,-18,34,20);
  [-9,8].forEach(function(wx){g.fillStyle='#1c1228';g.beginPath();g.arc(wx,-3,3,0,6.283);g.fill();g.fillStyle='#d8c8e8';g.beginPath();g.arc(wx,-3,1.4,0,6.283);g.fill();
    g.strokeStyle='#1c1228';g.lineWidth=.5;g.beginPath();g.moveTo(wx+Math.cos(spin)*1.4,-3+Math.sin(spin)*1.4);g.lineTo(wx-Math.cos(spin)*1.4,-3-Math.sin(spin)*1.4);g.stroke()});
  if(beam){g.globalCompositeOperation='lighter';g.fillStyle='rgba(255,220,140,.14)';g.beginPath();g.moveTo(17,-9);g.lineTo(48,-15);g.lineTo(48,-2);g.closePath();g.fill();g.globalCompositeOperation='source-over'}
  g.restore()}
function layer(img,f){g.drawImage(img,camS*f*RS,0,VW*RS,VH*RS,0,0,VW,VH)}   // draw the visible slice of a parallax strip

function frame(now){
  t=now/1000;
  if(SWIPE&&!drag){if(Math.abs(inert)>.02){vcam=clampC(vcam+inert);inert*=.94}else inert=0}   // coast after a flick
  var tp=SWIPE?(camMax?vcam/camMax:0):Math.min(1,Math.max(0,scrollY/Math.max(1,track.offsetHeight-H)));
  var old=camS;camS+=(tp*camMax-camS)*(drag?.4:.16);vel=camS-old;pr=camS/camMax;       // smoothed camera
  var i,k,b,sx;
  // sky, sun, far skyline (+ twinkling windows, tower glows, beacons)
  g.clearRect(0,0,VW,VH);
  g.drawImage(S.sky,-camS*.02,0,VW+100,VH);if(OFF>1)sband.style.transform='translateX('+(-camS*.02*U).toFixed(2)+'px)';       // LAYER 1  sky   ◄ IMAGES.sky
  g.drawImage(S.sun,VW*.62-camS*.03-40,48,80,80);   // LAYER 2  sun   ◄ IMAGES.sun
  layer(S.far,.1);                                  // LAYER 3  far skyline (10% speed)   ◄ IMAGES.far
  g.globalAlpha=.6;g.fillStyle='#ffd9a0';
  for(i=0;FX.glow&&i<FAR.length;i++){b=FAR[i];sx=b.x-camS*.1;if(sx>VW||sx+b.w<0)continue;
    for(k=0;k<b.win.length;k+=3)if(((t*1.2+b.win[k+2])|0)%7!==0)g.fillRect(sx+b.win[k],b.win[k+1],1,1.7)}
  g.globalAlpha=1;
  var gx=LM.gat-camS*.1,cx=LM.carew-camS*.1,ux=LM.ut-camS*.22;
  if(FX.glow){g.globalCompositeOperation='lighter';
  g.globalAlpha=.3+.15*Math.sin(t*2);g.drawImage(S.glow,gx-17,GY-84-28,34,34);
  g.globalAlpha=.25+.1*Math.sin(t*2+1);g.drawImage(S.glow,ux-17,GY-60,34,34);g.globalAlpha=1;g.globalCompositeOperation='source-over';
  g.fillStyle='#ff3b3b';if(((t*1.3)|0)%2){g.beginPath();g.arc(gx,GY-104,1,0,6.283);g.fill()}if(((t*1.2)|0)%2){g.beginPath();g.arc(cx,GY-114,1,0,6.283);g.fill()}}
  layer(S.b,.22);                                   // LAYER 4  Union Terminal (22% speed)   ◄ IMAGES.midfar
  layer(S.mid,.55);                                 // LAYER 5  street buildings (55% speed)   ◄ IMAGES.mid
  // flashing windows, lit shopfronts and the neon BAR sign
  for(i=0;FX.windows&&i<MID.length;i++){b=MID[i];sx=b.x-camS*.55;if(sx>VW||sx+b.w<0)continue;var top=GY-b.h;
    for(k=0;k<b.win.length;k+=4){var ty=b.win[k+2],on=ty===1||(ty===2&&((t*1.5+b.win[k+3])|0)%6<1);
      if(on){var wx=sx+b.win[k],wy=top+b.win[k+1];g.globalAlpha=.9;g.fillStyle='#ffd27a';g.fillRect(wx,wy,b.ww,b.wh);g.globalAlpha=.16;g.fillStyle='#ffb35c';g.fillRect(wx-2,wy-2,b.ww+4,b.wh+4)}}
    g.globalAlpha=1;
    if(b.lit&&b.lr){g.globalAlpha=.3;g.fillStyle='#ffb35c';g.fillRect(sx+b.lr[0],GY-b.lr[1],b.lr[2],b.lr[3]);g.globalAlpha=1}
    if(b.bar){var bo=((t*2)|0)%2;g.fillStyle=bo?'#ffb347':'#5a3a1a';g.fillRect(sx+b.w/2-8,GY-30,16,5);if(bo){g.globalAlpha=.4;g.globalCompositeOperation='lighter';g.drawImage(S.glow,sx+b.w/2-17,GY-42,34,34);g.globalAlpha=1;g.globalCompositeOperation='source-over'}}}
  // Fountain Square water spray
  var fx=LM.fs-camS*.55;
  if(FX.spray&&fx>-60&&fx<VW+60){g.fillStyle='#d8f0ff';g.globalAlpha=.85;
    for(var sd=-1;sd<=1;sd+=2)for(k=0;k<9;k++){var u=(t*.9+k/9)%1;g.beginPath();g.arc(fx+sd*(15+u*17),GY-50-18*u+61*u*u,.7,0,6.283);g.fill()}
    g.globalAlpha=1}
  // Roebling Bridge (foreground) + river sparkle
  var bsx=BR.x0-camS,onBr=bsx<VW&&bsx+BR.w>0;
  if(onBr){g.drawImage(S.br,bsx,0,BR.w,VH);   // LAYER 6  Roebling Bridge, full speed   ◄ IMAGES.bridge
    g.fillStyle='#ff9a6a';g.globalAlpha=.6;
    for(i=0;i<40;i++){var fx2=bsx+hh(i,1)*BR.w;if(fx2>-4&&fx2<VW&&((t*2+i)|0)%3)g.fillRect(fx2,116+hh(i,2)*20,3+hh(i,3)*3,.8)}g.globalAlpha=1}
  // sidewalk tiles (skipped on the bridge) with lamps and string lights
  var x0=-mod(camS,360);
  g.save();if(onBr){g.beginPath();g.rect(0,0,Math.max(0,bsx),VH);g.rect(Math.min(VW,bsx+BR.w),0,VW,VH);g.clip()}
  for(i=0;i<VW/360+2;i++)g.drawImage(S.walk,x0+i*360-.3,GY-40,360.6,RD-(GY-40));   // LAYER 7  sidewalk tile   ◄ IMAGES.walk
  g.restore();
  var sp=120,first=Math.floor(camS/sp)-1,bp=['#fff3c4','#ffd966','#ffb347','#ffe9a8','#ffffff']   // warm whites, yellows and ambers;
  for(i=first;i<first+VW/sp+3;i++){var lw=i*sp+60,lx=lw-camS,nx=lx+sp;
    if(lw+sp>BR.x0&&lw<BR.x0+BR.w)continue;
    for(var n=0;n<=28;n++){var uu=n/28,bx=lx+7+(nx-lx)*uu,by=GY-30+9*(1-(2*uu-1)*(2*uu-1));
      if(((t*3|0)+n+i)%3){g.fillStyle=bp[mod(n+i,bp.length)];g.beginPath();g.arc(bx,by,.9,0,6.283);g.fill()}}
    g.globalCompositeOperation='lighter';g.globalAlpha=.6+.15*Math.sin(t*3+i);g.drawImage(S.glow,lx+7-17,GY-27-17,34,34);g.globalAlpha=1;g.globalCompositeOperation='source-over'}
  drawPeople();   // LAYER 7b  people walking on the sidewalk (soft, blurred silhouettes)
  // road, lane dashes, oncoming traffic, then the player's car
  for(i=0;i<VW/360+2;i++)g.drawImage(S.road,x0+i*360-.3,RD,360.6,VH-RD);   // LAYER 8  road tile   ◄ IMAGES.road
  g.globalAlpha=.5;g.fillStyle='#efe2f4';for(i=-1;i<VW/28+2;i++)g.fillRect(i*28-mod(camS,28),171,14,1.1);g.globalAlpha=1;
  for(i=0;i<cars.length;i++){var cr=cars[i];drawCar(mod(cr.x0-cr.v*t-camS,VW+160)-80,cr.y+1,-1,S.car[cr.k],.9,t*8,true)}
  var px=VW*.12+pr*VW*.5+22,bob=Math.abs(vel)>.3?Math.sin(t*22)*.4:0;
  drawCar(px,179+bob,1,S.car[6],1.25,camS*.14,true);   // LAYER 9  player car sprite   ◄ IMAGES.cars[6]
  // warm sunset wash + paper grain
  g.globalAlpha=.07;g.fillStyle='#ff7a3d';g.fillRect(0,0,VW,VH);g.globalAlpha=1;
  g.save();g.setTransform(1,0,0,1,0,0);g.globalAlpha=.2;g.fillStyle=grain;g.fillRect(0,0,cv.width,cv.height);g.restore();
  // roadside signs: placed in the world, scaled to the size measured in fitSigns()
  place(sched,SX,px,.12);place(about,AX,px,.08);place(trk,TKX,px,.08);place(faq,FQX,px,.08);place(spon,PX,px,.04);if(!mapIn)place(subw,BX,px,0);
  hero.style.opacity=Math.max(0,1-tp*9);hero.style.pointerEvents=tp>.1?'none':'auto';
  hint.style.opacity=Math.max(0,1-tp*12);
  var wh=WHERE[0];for(i=0;i<WHERE.length;i++)if(pr>=WHERE[i][0])wh=WHERE[i];
  if(whereTxt.textContent!==wh[1])whereTxt.textContent=wh[1];
  var wo=whereOn()?Math.min(1,Math.max(0,(tp-.06)*14)):0;where.style.opacity=wo;where.classList.toggle('on',wo>.5);prog.style.width=(pr*100)+'%';
  requestAnimationFrame(frame)}

/* ========== SIGNS: measured once per resize so they always fit the screen ========== */
function place(el,wx,px,zm){var s=wx-camS,x=s*U,half=el._w*el._fit*.6;
  if(x<-half||x>W+half){if(el.style.display!=='none')el.style.display='none';return}
  if(el.style.display!=='block')el.style.display='block';
  var z=1+zm*Math.max(0,1-Math.abs(s-(px+13))/(VW*.3));                  // grow a little as the car passes
  el.style.transform='translate('+x+'px,'+el._ay+'px) scale('+Math.min(el._fit*z,el._max)+')'}
var WHERE=[[0,'Downtown Cincinnati'],[.09,'Fountain Square'],[.2,'Schedule'],[.27,'About us'],[.33,'Roebling Suspension Bridge'],[.5,'Our sponsors'],[.57,'Tracks'],[.64,'Union Terminal'],[.69,'FAQ'],[.76,'University of Cincinnati'],[.84,'Explore Rev UC'],[.95,'1819 Innovation Hub']];
var STARS='radial-gradient(70px 22px at 20% 30%,rgba(160,215,220,.3),transparent),radial-gradient(90px 24px at 74% 50%,rgba(160,215,220,.24),transparent),radial-gradient(60px 18px at 46% 76%,rgba(160,215,220,.2),transparent),#1d6275';
var vcam=0,inert=0,drag=null,dragged=0,SPD=1.25,mapIn=false,trk=$('tracks'),faq=$('faq'),TKX=0,FQX=0,lastHB=-1;
var hdr=document.querySelector('header'),capEl=$('cap'),nodes=document.querySelectorAll('#subway .node'),svgMap=document.querySelector('#subway svg');
var SIGNS=[{el:sched,ay:GY+6,id:'schedule'},{el:about,ay:GY+6,id:'about'},{el:trk,ay:GY+6,id:'tracks'},{el:faq,ay:GY+6,id:'faq'},{el:spon,ay:118,id:'sponsors',nopole:1,cap:1},{el:subw,ay:GY+6,id:'map'}];
function clampC(v){return Math.max(0,Math.min(camMax||0,v))}
function whereOn(){return OFF>110}                                         // only where there is empty sky above the scene
/* map labels: keep them about 13px on screen whatever the map's size */
function mapText(px){var fs=Math.max(15,Math.min(36,13*800/Math.max(1,px)));
  nodes.forEach(function(n){var c=n.querySelector('circle'),tx=n.querySelector('text'),cy=+c.getAttribute('cy');
    tx.setAttribute('font-size',fs.toFixed(1));tx.setAttribute('x',c.getAttribute('cx'));
    tx.setAttribute('y',(n.dataset.p==='b'?cy+20+fs*.75:cy-24).toFixed(0))})}
function fitSigns(){var narrow=W<600;stage.classList.toggle('narrow',narrow);
  var top=hdr.offsetHeight+(whereOn()?where.offsetHeight+18:10),mx=Math.min(1.4,Math.max(1,U/3.8,narrow?1:W/680));
  var availMap=OFF+(GY+6)*U-top,short=availMap<380;subw.classList.toggle('short',short);   // short screens: compact map sign, details open on tap
  stage.style.setProperty('--spw',Math.round(narrow?W*.92:Math.min(W*.8,720))+'px');
  stage.style.setProperty('--mw',Math.round(Math.max(260,Math.min(860,W*.94,(availMap-(short?70:150))/.525+30)))+'px');
  subw.classList.toggle('mnarrow',parseFloat(stage.style.getPropertyValue('--mw'))<560);
  SIGNS.forEach(function(s){var el=s.el;if(el===subw&&mapIn)return;
    var avail=OFF+s.ay*U-top;el._ay=OFF+s.ay*U;
    el.style.display='block';el.style.transform='none';el.style.setProperty('--pole','0px');
    if(!s.nopole){var h0=el.offsetHeight;el.style.setProperty('--pole',Math.round(Math.max(26,Math.min(170,(avail-h0)*.6)))+'px')}
    var w=el.offsetWidth,h=el.offsetHeight,lim=Math.min((s.cap?W*.86:W*.96)/w,avail/h);
    el._w=w;el._fit=Math.max(.5,Math.min(mx,lim));el._max=Math.max(el._fit,Math.min(mx*1.25,lim));
    if(el===subw)mapText(svgMap.getBoundingClientRect().width*el._fit);
    el.style.display='none'})}

/* ========== PEOPLE: blurred silhouettes strolling both ways along the sidewalk ==========
   Theme-teal bodies with a faint sunset rim light. They live in the world (so they slide past as you drive),
   walk at their own pace, and wrap around the screen so the street never empties. */
var PPL=[],pc=document.createElement('canvas'),pg=pc.getContext('2d'),PR=1.7,pT=0,
    RM=matchMedia('(prefers-reduced-motion: reduce)').matches,
    PBODY=['#0f2b38','#13404f','#1b4a5e','#173f52','#245c74','#102f3d'],PACC=['#f27230','#f2a03a','#c4501a'];
function initPeople(){var n=Math.round(VW/24),i;PPL=[];
  for(i=0;i<n;i++)PPL.push({wx:camS+Math.random()*(VW+48)-24,dir:Math.random()<.5?-1:1,v:3.2+Math.random()*3.2,s:.8+Math.random()*.32,
    back:i%2===0,ph:Math.random()*6.283,col:PBODY[i%PBODY.length],acc:Math.random()<.3?PACC[i%3]:null,bag:Math.random()<.35,kid:Math.random()<.12,jer:jersey()});
  PPL.sort(function(a,b){return(a.back?0:1)-(b.back?0:1)});
  /* game-day groups tossing a football: one on the landing view, one near Union Terminal, one by UC */
  PLAY=[[VW*.7,0],[Q.ut*camMax+VW*.36,1],[Q.uc*camMax+VW*.66,2]].map(function(q,i){return{x:q[0],sp:15+i*3,T:1.35+i*.15,o:i*.7,
    a:{s:1,dir:1,col:PBODY[i],jer:JER[i%2],stand:1},b:{s:q[1]===2?.74:1,dir:-1,col:PBODY[i+2],jer:JER[(i+1)%2],cap:i===1,stand:1,kid:0}}});
  pc.width=Math.ceil(VW*PR);pc.height=Math.ceil(38*PR)}
var JER=[['#f27230','#15191d'],['#c62f2a','#f4efe6']],PLAY=[];   // fan colours: orange with black, red with white
function jersey(){var r=Math.random();return r<.17?JER[0]:r<.32?JER[1]:null}   // drawn small on purpose: scaling it up is what makes them soft
function person(c,x,y,p,rim){var s=p.s*(p.kid?.72:1),sw=(RM||p.stand)?0:Math.sin(p.ph),bob=(RM||p.stand)?0:Math.abs(Math.cos(p.ph))*.35*s,d=p.dir,o=rim?-.45:0,J=rim?null:p.jer;
  x+=o;y-=bob;c.strokeStyle=c.fillStyle=rim?'rgba(255,154,90,.55)':p.col;c.lineCap='round';
  var st=p.stand?1.5*s:0;c.lineWidth=1.55*s;c.beginPath();c.moveTo(x,y-6*s);c.lineTo(x+sw*2.7*s+st,y);c.moveTo(x,y-6*s);c.lineTo(x-sw*2.7*s-st,y);c.stroke();          // legs
  if(J&&J[1]==='#15191d')c.strokeStyle=J[1];                                                                                                       // dark sleeves on the orange shirts
  c.lineWidth=1.15*s;c.beginPath();c.moveTo(x,y-10.2*s);c.lineTo(x-sw*2.2*s+d*.3,y-6.4*s);c.moveTo(x,y-10.2*s);
  if(p.up)c.lineTo(x+d*2.3*s,y-14.6*s);else c.lineTo(x+sw*2.2*s+d*.3,y-6.4*s);c.stroke();c.strokeStyle=c.fillStyle;                        // arms (one raised to throw or catch)
  if(J)c.fillStyle=J[0];c.beginPath();c.ellipse(x+d*.25*s,y-8.5*s,1.9*s,3.1*s,d*.08,0,6.283);c.fill();                                     // body (jersey colour when they wear one)
  if(J){c.fillStyle=J[1];c.beginPath();c.ellipse(x+d*.25*s,y-10.9*s,1.6*s,.6*s,0,0,6.283);c.fill();c.globalAlpha=.8;c.fillRect(x+d*.25*s-1.7*s,y-8.2*s,3.4*s,.45*s);c.globalAlpha=1;c.fillStyle=p.col}
  c.beginPath();c.arc(x+d*.45*s,y-12.7*s,1.55*s,0,6.283);c.fill();                                                                          // head
  if(p.cap&&J){c.fillStyle=J[0];c.beginPath();c.arc(x+d*.45*s,y-12.9*s,1.6*s,Math.PI,0);c.fill();c.fillRect(x+d*.45*s,y-13.1*s,d*2.4*s,.55*s);c.fillStyle=p.col}   // ball cap
  if(p.bag&&!rim){c.beginPath();c.ellipse(x-d*1.9*s,y-8.6*s,1.1*s,1.7*s,0,0,6.283);c.fill()}                                               // backpack
  if(p.acc&&!rim){c.fillStyle=p.acc;c.globalAlpha=.55;c.beginPath();c.ellipse(x+d*.25*s,y-10.6*s,1.7*s,.7*s,0,0,6.283);c.fill();c.globalAlpha=1}}  // scarf
function drawPeople(){var dt=Math.min(.05,Math.max(0,t-pT)),i,p,sx;pT=t;if(!PPL.length)return;
  pg.setTransform(1,0,0,1,0,0);pg.clearRect(0,0,pc.width,pc.height);pg.setTransform(PR,0,0,PR,0,-112*PR);
  for(i=0;i<PPL.length;i++){p=PPL[i];if(!RM){p.wx+=p.dir*p.v*dt;p.ph+=p.v*dt*1.15}
    sx=p.wx-camS;if(sx<-24){p.wx+=VW+48;sx+=VW+48}else if(sx>VW+24){p.wx-=VW+48;sx-=VW+48}
    var y=p.back?142.2:146.6;person(pg,sx,y,p,1);person(pg,sx,y,p,0)}
  for(i=0;i<PLAY.length;i++)drawPlay(PLAY[i]);
  g.save();g.globalAlpha=.86;g.imageSmoothingEnabled=true;g.imageSmoothingQuality='high';
  g.drawImage(pc,0,112,VW,38);g.globalAlpha=.3;g.drawImage(pc,-.35,111.7,VW+.7,38.6);g.restore()}   // second, slightly larger pass = soft halo

/* ========== SKY BAND: the open sky above the scene, painted with the same brush ==========
   Deep dusk teal at the top easing into the painted sky's own top colour, with soft brushed bands,
   faint cloud wisps, a few early stars and the same paper grain. Kept low-contrast so the title stays easy to read. */
var sband=$('skyband'),sbx=sband.getContext('2d');
function paintBand(){var h=OFF,i;if(h<2){sband.style.display='none';return}sband.style.display='block';
  var wu=VW+100,hu=h/U,k=U*DPR,c=sbx,n=Math.max(2,Math.ceil(hu/14)),bh=hu/n,A=[13,52,67],B=[29,98,117];
  function mix(u){u=Math.max(0,Math.min(1,u));return'#'+[0,1,2].map(function(j){var v=Math.round(A[j]+(B[j]-A[j])*u);return(v<16?'0':'')+v.toString(16)}).join('')}
  sband.width=Math.ceil(wu*k);sband.height=Math.ceil(h*DPR);sband.style.width=(wu*U)+'px';sband.style.height=h+'px';
  c.setTransform(k,0,0,k,0,0);seed=31;
  c.fillStyle=mix(0);c.fillRect(0,0,wu,hu);
  for(i=0;i<n;i++)poly(c,-4,i*bh-2,wu+8,bh+5,mix(i/(n-1)),1.4);                                                   // soft banded gradient
  for(i=0;i<n-1;i++){var y=(i+1)*bh;strokes(c,0,y-3,wu,6,mix((i+1)/(n-1)),wu/3,28,.5,2.2);strokes(c,0,y-4,wu,6,mix(i/(n-1)),wu/5,24,.35,2)}   // brushed seams
  for(i=0;i<Math.round(wu/14);i++)poly(c,rnd()*(wu+40)-20,rnd()*hu,40+rnd()*110,1.4+rnd()*2.6,rnd()>.4?'#6fb0b8':'#2f7f8f',1.2,.1+rnd()*.12);   // cloud wisps
  for(i=0;i<wu*hu/700;i++){c.globalAlpha=.2+rnd()*.45;c.fillStyle='#e6f4f2';c.beginPath();c.arc(rnd()*wu,rnd()*hu*.7,.22+rnd()*.32,0,6.283);c.fill()}c.globalAlpha=1;   // early stars
  if(grain){c.save();c.setTransform(1,0,0,1,0,0);c.globalAlpha=.2;c.fillStyle=grain;c.fillRect(0,0,sband.width,sband.height);c.restore()}}   // paper grain

/* a football tossed back and forth in an arc; whoever throws or catches has an arm up */
function drawPlay(q){var cx=q.x-camS;if(cx<-40||cx>VW+40)return;var y=146.6,ax=cx-q.sp/2,bx=cx+q.sp/2,h=y-14.6;
  var ph=RM?.5:((t+q.o)/q.T)%2,u=ph%1,fwd=ph<1,x0=fwd?ax+2.3:bx-2.3,x1=fwd?bx-2.3:ax+2.3,
      bxp=x0+(x1-x0)*u,byp=h+1-7*4*u*(1-u),ang=Math.atan2(-7*4*(1-2*u),(x1-x0));
  q.a.up=ph<.2||ph>1.8;q.b.up=ph>.8&&ph<1.2;
  person(pg,ax,y,q.a,1);person(pg,ax,y,q.a,0);person(pg,bx,y,q.b,1);person(pg,bx,y,q.b,0);
  pg.save();pg.translate(bxp,byp);pg.rotate(ang);pg.fillStyle='#8a4320';pg.beginPath();pg.ellipse(0,0,1.9,1.15,0,0,6.283);pg.fill();
  pg.strokeStyle='#f4efe6';pg.lineWidth=.4;pg.beginPath();pg.moveTo(-.7,-.45);pg.lineTo(.7,-.45);pg.stroke();pg.restore()}   // football with a lace

/* ========== SIZE: fit the painted scene to the screen ========== */
function size(){W=innerWidth;H=stage.clientHeight||innerHeight;if(W<50||H<50)return false;
  var keep=camMax?vcam/camMax:0;
  DPR=Math.min(devicePixelRatio||1,1.5);
  /* keep a clean band of sky for the title on every screen: the city fills only what is left below it (never less than half the screen) */
  var hb=hero.offsetTop+hero.offsetHeight+14,tgt=Math.max(H*.5,Math.min(H,1.2*(H-hb)));lastHB=hb;   // the top 30 units of the scene are plain painted sky, so the title may sit there
  VW=Math.min(700,Math.max(W<600?170:(H>W?190:230),VH*W/tgt));   // phones see at least 170 units of city, tablets 190–230
  var cssH=W*VH/VW;U=cssH/VH;OFF=Math.max(0,H-cssH);                                       // OFF = empty sky above the scene on tall screens
  cv.style.top=OFF+'px';cv.style.height=cssH+'px';
  cv.width=Math.round(W*DPR);cv.height=Math.round(cssH*DPR);g.setTransform(cv.width/VW,0,0,cv.height/VH,0,0);
  camMax=WL-VW;fitSigns();layoutStops();               // measure the signs for this screen first, then lay out the stops around them
  build();paint();applyImages();initPeople();
  SX=Q.sch*camMax+VW*.5;AX=Q.about*camMax+VW*.5;BX=Q.sub*camMax+VW*.5;TKX=Q.trk*camMax+VW*.5;FQX=Q.faq*camMax+VW*.5;                    // each sign sits centred on screen at its stop, so it is never cut off
  vcam=keep*camMax;camS=SWIPE?vcam:Math.min(camS,camMax);
  stage.style.background=OFF>0?'#1d6275':'';paintBand();hint.style.top=(OFF+RD*U)+'px';
  hero.classList.toggle('over',hb>OFF+30*U+4);
  var bl=$('blend');bl.style.top=OFF+'px';bl.style.height=(OFF>0?34*U:0)+'px';                                                  // title over the city: give it the glass card
  return true}
/* Stops are laid out from the real sign sizes on this screen (including their zoom as the car passes):
   Fountain Sq ← gap → Schedule ← same gap → About us, then the bridge, Tracks and FAQ move along only if a screen needs the room. */
function layoutStops(){var cm=camMax,m=14;
  about._fit=Math.min(about._fit,sched._fit);about._max=Math.min(about._max,sched._max);      // same scale, so the pair reads as a set
  var hs=sched._w*sched._max/2/U,ha=about._w*about._max/2/U,D=Math.max(80+hs+m,hs+ha+m);
  Q.sch=Q.fs+D/(.55*cm);Q.about=Q.sch+D/cm;                                                   // the fountain moves at 55% speed, signs at full speed
  var ax=Q.about*cm+VW*.5;
  Q.br=Math.max(.34,(ax+ha+m+108-.12*VW)/(cm+.5*VW));                                         // the bridge starts after About us
  var bEnd=Q.br+890/(cm+.5*VW),L=[trk,faq,subw],k,hw=function(e){return e._w*e._max/2/U};
  function chain(){Q.trk=Math.max(.6,bEnd+(hw(trk)+m)/cm);Q.faq=Math.max(.72,Q.trk+(hw(trk)+hw(faq)+m)/cm);Q.sub=Math.max(.86,Q.faq+(hw(faq)+hw(subw)+m)/cm)}
  chain();if(Q.sub>.95){k=Math.max(.5,(.95-bEnd)/(Q.sub-bEnd));L.forEach(function(e){e._fit*=k;e._max*=k});chain()}   // short screens: shrink these three a little rather than overlap
  var W_=WHERE;W_[1][0]=Q.fs-.03;W_[2][0]=(Q.fs+Q.sch)/2;W_[3][0]=(Q.sch+Q.about)/2;W_[4][0]=Math.max(W_[3][0]+.01,Q.br-.01);
  W_[5][0]=Q.br+380/(cm+VW*.5)-.04;W_[6][0]=Math.max(W_[5][0]+.02,Q.trk-.03);W_[7][0]=Math.max(.64,W_[6][0]+.03);W_[8][0]=Math.max(Q.faq-.03,W_[7][0]+.02);W_[9][0]=Math.max(.76,W_[8][0]+.02);W_[10][0]=Math.max(.84,Q.sub-.03,W_[9][0]+.02);W_[11][0]=Math.max(.95,W_[10][0]+.02);
  if(P){P.schedule=Q.sch;P.about=Q.about;P.tracks=Q.trk;P.faq=Q.faq;P.explore=Q.sub}}
var rz;addEventListener('resize',function(){clearTimeout(rz);rz=setTimeout(size,200)});
var loading=$('loading');
function start(){try{if(!size()){setTimeout(start,100);return}loading.style.display='none';requestAnimationFrame(frame)}
  catch(e){loading.textContent='Could not paint the scene: '+e.message}}
setTimeout(start,30);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(function(){if(camMax)size()});   // re-measure once the brush font arrives   // re-measure once the brush font arrives

/* ========== NAVIGATION: links, burger menu, previous / next stop ========== */
var P={start:0,about:Q.about,tracks:Q.trk,faq:Q.faq,schedule:Q.sch,explore:Q.sub};
Object.defineProperty(P,'sponsors',{enumerable:true,get:function(){return Q.br+380/(camMax+VW*.5)}});   // car at bridge midspan
function goTo(p){if(SWIPE){vcam=clampC(p*camMax);inert=0}else scrollTo({top:p*(track.offsetHeight-innerHeight),behavior:'smooth'})}
function stops(){return[0,Q.fs,Q.sch,Q.about,P.sponsors,Q.trk,Q.ut,Q.faq,Q.uc,Q.sub,1].sort(function(a,b){return a-b})}
function step(d){var cur=SWIPE?vcam/camMax:Math.min(1,Math.max(0,scrollY/Math.max(1,track.offsetHeight-H))),L=stops(),i;
  if(d>0){for(i=0;i<L.length;i++)if(L[i]>cur+.004)return goTo(L[i])}else{for(i=L.length-1;i>=0;i--)if(L[i]<cur-.004)return goTo(L[i])}}
$('prevStop').addEventListener('click',function(){step(-1)});$('nextStop').addEventListener('click',function(){step(1)});
var burger=$('burger'),nav=$('nav');
function menu(o){nav.classList.toggle('open',o);burger.setAttribute('aria-expanded',o?'true':'false')}
burger.addEventListener('click',function(e){e.stopPropagation();menu(!nav.classList.contains('open'))});
document.addEventListener('click',function(e){if(nav.classList.contains('open')&&!e.target.closest('nav,#burger'))menu(false)});
document.querySelectorAll('a[href^="#"]').forEach(function(a){a.addEventListener('click',function(e){
  var id=a.getAttribute('href').slice(1);if(!(id in P))return;e.preventDefault();menu(false);closeM();goTo(P[id])})});

/* ========== SWIPE MODE: phones, tablets and narrow windows ==========
   Swipe left (or up) drives forward, swipe right goes back. The road follows your finger, then coasts. */
if(SWIPE){
  stage.addEventListener('pointerdown',function(e){if(e.button>0||modalOn()||e.target.closest('input,button,a,#modal'))return;
    drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,t:performance.now(),id:e.pointerId,ax:0};inert=0});
  addEventListener('pointermove',function(e){if(!drag||e.pointerId!==drag.id)return;
    if(!drag.ax){var ddx=e.clientX-drag.x,ddy=e.clientY-drag.y;if(Math.abs(ddx)<8&&Math.abs(ddy)<8)return;
      drag.ax=Math.abs(ddx)>=Math.abs(ddy)?'x':'y';drag.lx=e.clientX;drag.ly=e.clientY;stage.classList.add('dragging');return}
    var d=drag.ax==='x'?drag.lx-e.clientX:drag.ly-e.clientY,now=performance.now(),dt=Math.max(8,now-drag.t),du=d/U*SPD;
    vcam=clampC(vcam+du);inert=inert*.5+du/dt*16*.5;drag.t=now;drag.lx=e.clientX;drag.ly=e.clientY});
  var up=function(e){if(!drag||e.pointerId!==drag.id)return;
    if(drag.ax){dragged=performance.now();if(performance.now()-drag.t>90)inert=0}else inert=0;
    drag=null;stage.classList.remove('dragging')};
  addEventListener('pointerup',up);addEventListener('pointercancel',up);
  stage.addEventListener('click',function(e){if(performance.now()-dragged<250){e.stopPropagation();e.preventDefault()}},true);   // a swipe is not a tap
  addEventListener('wheel',function(e){if(e.target.closest&&e.target.closest('#modal,nav'))return;e.preventDefault();
    var d=Math.abs(e.deltaX)>Math.abs(e.deltaY)?e.deltaX:e.deltaY;if(e.deltaMode===1)d*=16;vcam=clampC(vcam+d/U*1.1);inert=0},{passive:false});
  addEventListener('keydown',function(e){if(modalOn()||/INPUT|TEXTAREA/.test((document.activeElement||{}).tagName||''))return;var k=e.key;
    if(k==='ArrowRight'||k==='ArrowDown'){vcam=clampC(vcam+camMax/40);inert=0;e.preventDefault()}
    else if(k==='ArrowLeft'||k==='ArrowUp'){vcam=clampC(vcam-camMax/40);inert=0;e.preventDefault()}
    else if(k==='PageDown'||k===' '){step(1);e.preventDefault()}else if(k==='PageUp'){step(-1);e.preventDefault()}
    else if(k==='Home')goTo(0);else if(k==='End')goTo(1)})}
/* the hint arrow points the way the gesture goes */
$('hintTxt').textContent=SWIPE?(COARSE?'Swipe left to drive':'Drag left or scroll to drive'):'Scroll down to drive';
$('hintArr').textContent=SWIPE?'←':'▼';

/* ========== MAP STOPS + BIG READABLE VIEW ========== */
function pick(n){nodes.forEach(function(x){x.classList.remove('on')});n.classList.add('on');capEl.textContent=n.dataset.t}
nodes.forEach(function(n){n.addEventListener('click',function(){pick(n)});
  n.addEventListener('keydown',function(e){if(e.key==='Enter'||e.key===' '){e.preventDefault();e.stopPropagation();pick(n)}})});
if(matchMedia('(prefers-reduced-motion: reduce)').matches)$('train').style.display='none';
var modal=$('modal'),mbody=$('mbody'),mtitle=$('mtitle');
var MC={about:['About us','<p class="big">RevolutionUC is UC’s student-run hackathon. Build, learn and ship something in a weekend. All majors welcome.</p>'],
 schedule:['Schedule','<ul class="sch"><li><b>Fri, 6–8 PM</b>Check-in &amp; dinner</li><li><b>Fri, 9 PM</b>Opening &amp; team mixer</li><li><b>Sat, 10 AM–12 PM</b>Workshops</li><li><b>Sun, 11 AM</b>Demos &amp; awards</li></ul>'],
 sponsors:['Sponsors','<div class="spgrid"><div>Logo</div><div>Logo</div><div>Logo</div><div>Logo</div></div>'],
 tracks:['Tracks','<ul class="sch"><li><b>Beginner</b>First hackathon? Build with a mentor beside you.</li><li><b>Sustainability</b>Tools for a greener Cincinnati.</li><li><b>Health &amp; wellbeing</b>Apps that help people feel better.</li><li><b>Open innovation</b>Anything you can dream up and ship.</li></ul><p class="note">Sample tracks: replace with the final list.</p>'],
 faq:['FAQ','<dl><dt>Who can join?</dt><dd>Students of every major and skill level.</dd><dt>Do I need a team?</dt><dd>No. Come solo and find one at the mixer.</dd><dt>What should I bring?</dt><dd>A laptop, a charger and an idea or two.</dd><dt>Never hacked before?</dt><dd>Perfect. Workshops and mentors get you started.</dd></dl><p class="note">Sample answers: replace with the final FAQ.</p>']};
function modalOn(){return modal.classList.contains('on')}
function openM(id){
  if(id==='map'){mtitle.style.display='none';mbody.innerHTML='';subw.classList.add('inmodal');subw.style.display='block';mbody.appendChild(subw);mapIn=true}
  else{mtitle.style.display='';mtitle.textContent=MC[id][0];mbody.innerHTML=MC[id][1]}
  modal.classList.add('on');if(mapIn)mapText(svgMap.getBoundingClientRect().width);$('mclose').focus()}
function closeM(){if(!modalOn())return;modal.classList.remove('on');
  if(mapIn){subw.classList.remove('inmodal');stage.insertBefore(subw,about);mapIn=false;fitSigns()}}
SIGNS.forEach(function(s){s.el.addEventListener('click',function(){if(SWIPE&&!(s.el===subw&&mapIn))openM(s.id)})});   // touch: tap a sign to read it large
$('mclose').addEventListener('click',closeM);
modal.addEventListener('click',function(e){if(e.target===modal)closeM()});
addEventListener('keydown',function(e){if(e.key==='Escape'){closeM();menu(false)}});
})();

/* ---------- newer interface additions ---------- */
(function(){
  'use strict';
  if(window.__revucAdditionsInstalled)return;
  window.__revucAdditionsInstalled=true;

  var $=function(selector,root){return (root||document).querySelector(selector)};
  var $$=function(selector,root){return Array.prototype.slice.call((root||document).querySelectorAll(selector))};

  /* Font families are loaded once from revuc.css's stylesheet link. */

  /* FONT TOGGLE: original type is the starting setting, then four alternate pairings. */
  var fontNames=[
    'Original · Caveat Brush + Chivo',
    '1 · BC Barell Extended Black / Montserrat Regular / DM Mono',
    '2 · Hagrid Text Heavy / Nunito Sans Regular / DM Mono',
    '3 · Clarity City Black / Gotham Book / DM Mono',
    '4 · Carter One Regular / Inter Regular / DM Mono'
  ];
  var fontIndex=0;
  var fontButton=document.createElement('button');
  fontButton.type='button';
  fontButton.id='revuc-font-button';
  fontButton.setAttribute('aria-label','Change website fonts');
  fontButton.setAttribute('aria-live','polite');
  fontButton.innerHTML='Aa Change fonts<small></small>';
  document.body.appendChild(fontButton);

  function setFont(){
    if(fontIndex===0)document.documentElement.removeAttribute('data-revuc-font');
    else document.documentElement.setAttribute('data-revuc-font',String(fontIndex));
    $('small',fontButton).textContent=fontNames[fontIndex];
    if(document.fonts&&document.fonts.ready){
      document.fonts.ready.then(function(){window.dispatchEvent(new Event('resize'))});
    }
    window.setTimeout(function(){window.dispatchEvent(new Event('resize'))},250);
  }
  fontButton.addEventListener('click',function(){
    fontIndex=(fontIndex+1)%fontNames.length;
    setFont();
  });
  setFont();

  /* FAQ content. Answers that depend on final event policy are deliberately worded without inventing details. */
  var FAQ=[
    ['The event','🏛️',[
      ['Where is the hackathon?','RevolutionUC takes place at the 1819 Innovation Hub on the University of Cincinnati campus. Check the event updates for the final room and check-in instructions.'],
      ['How long does RevolutionUC last?','RevolutionUC is planned as a weekend event, running Friday through Sunday. The final schedule will list check-in, hacking hours, meals, demos, and awards.'],
      ['How much does RevolutionUC cost?','Check the registration page for the confirmed ticket price and what is included. Any meal, parking, or other costs will be listed with the event details.'],
      ['When will the schedule and sponsors be released?','The schedule and sponsor announcements will be added to the website as they are confirmed. Keep an eye on the event updates before the weekend.']
    ]],
    ['Who can participate','🎟️',[
      ['Who can attend the hackathon?','Students of all majors and experience levels are welcome. You do not need to be a computer science major to participate.'],
      ['Can I attend if I’m under 18 years old?','Please contact the organizers before registering. Minors may need a parent or guardian permission form, and the team can confirm the current event policy.'],
      ['What if I don’t have much experience?','That is completely okay. Beginner-friendly workshops, mentors, and teammates can help you learn as you build.']
    ]],
    ['Teams & registration','🤝',[
      ['How do teams register?','Follow the registration instructions on the official RevolutionUC registration page. If your team is registering together, make sure everyone completes any required individual registration steps.'],
      ['What if I don’t have a team?','You can attend on your own and meet potential teammates during the opening mixer or team-forming activities.'],
      ['I am having trouble registering for the hackathon. What do I do?','Contact the RevolutionUC organizers and describe the issue. Include the email address associated with your registration, but do not send passwords or other sensitive information.']
    ]],
    ['Getting ready','🧳',[
      ['What should I bring?','Bring a laptop, charger, student ID, and anything you need to stay comfortable during the event. Check the final attendee guide for any overnight or venue-specific requirements.'],
      ['Will there be travel reimbursements?','Travel reimbursement availability and eligibility will be announced by the organizers. Please check the official event updates before booking travel.'],
      ['Is there a Code of Conduct?','All attendees are expected to help maintain a welcoming, respectful, and inclusive environment. The official Code of Conduct should be reviewed before attending.'],
      ['What if I have more questions?','Reach out to the RevolutionUC organizing team using the contact information on the official website.']
    ]]
  ];

  /* FAQ overlay */
  var faqOverlay=document.createElement('div');
  faqOverlay.className='revuc-overlay';
  faqOverlay.id='revuc-faq-overlay';
  faqOverlay.setAttribute('role','dialog');
  faqOverlay.setAttribute('aria-modal','true');
  faqOverlay.setAttribute('aria-labelledby','revuc-faq-title');
  faqOverlay.innerHTML='<section class="revuc-panel revuc-faq-panel"><button class="revuc-close" type="button" aria-label="Close frequently asked questions">✕</button><div class="revuc-faq-content"></div></section>';
  document.body.appendChild(faqOverlay);

  /* Form overlay */
  var formOverlay=document.createElement('div');
  formOverlay.className='revuc-overlay';
  formOverlay.id='revuc-form-overlay';
  formOverlay.setAttribute('role','dialog');
  formOverlay.setAttribute('aria-modal','true');
  formOverlay.setAttribute('aria-labelledby','revuc-form-title');
  formOverlay.innerHTML='<section class="revuc-panel"><button class="revuc-close" type="button" aria-label="Close form">✕</button><div class="revuc-form-content"></div></section>';
  document.body.appendChild(formOverlay);

  var activeOverlay=null,lastFocus=null;
  function openOverlay(overlay){
    lastFocus=document.activeElement;
    activeOverlay=overlay;
    overlay.classList.add('is-open');
    document.documentElement.style.overflow='hidden';
    var close=$('.revuc-close',overlay);
    if(close)close.focus();
  }
  function closeOverlay(){
    if(!activeOverlay)return;
    activeOverlay.classList.remove('is-open');
    activeOverlay=null;
    document.documentElement.style.overflow='';
    if(lastFocus&&typeof lastFocus.focus==='function')lastFocus.focus();
  }
  [faqOverlay,formOverlay].forEach(function(overlay){
    overlay.addEventListener('click',function(e){
      if(e.target===overlay||e.target.closest('.revuc-close'))closeOverlay();
    });
    overlay.addEventListener('keydown',function(e){
      if(e.key==='Escape'){e.preventDefault();closeOverlay()}
      if(e.key==='Tab'){
        var focusable=$$('button,a,input,select,textarea,summary,[tabindex]:not([tabindex="-1"])',overlay)
          .filter(function(el){return !el.disabled&&el.offsetParent!==null});
        if(!focusable.length)return;
        var first=focusable[0],last=focusable[focusable.length-1];
        if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
        else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
      }
    });
  });
  document.addEventListener('keydown',function(e){
    if(e.key==='Escape'&&activeOverlay)closeOverlay();
  });

  function openFaq(categoryIndex){
    var content=$('.revuc-faq-content',faqOverlay);
    var markup='<h2 id="revuc-faq-title">Frequently asked questions</h2><p class="revuc-lead">Step inside. Choose a question to read its answer.</p><div class="revuc-faq-cols">';
    FAQ.forEach(function(group,index){
      markup+='<section class="revuc-faq-group" id="revuc-faq-group-'+index+'"><h3>'+group[1]+' '+group[0]+'</h3>';
      group[2].forEach(function(item){
        markup+='<details><summary>'+item[0]+'</summary><p>'+item[1]+'</p></details>';
      });
      markup+='</section>';
    });
    markup+='</div>';
    content.innerHTML=markup;
    openOverlay(faqOverlay);
    var target=$('#revuc-faq-group-'+(Number.isInteger(categoryIndex)?categoryIndex:0),faqOverlay);
    if(target){
      var first=$('details',target);
      if(first)first.open=true;
      $('.revuc-panel',faqOverlay).scrollTop=0;
      window.setTimeout(function(){target.scrollIntoView({block:'start',behavior:'smooth'})},40);
    }
  }

  /* Replace the original roadside FAQ sign with the storefront. */
  var faqSign=document.getElementById('faq');
  var storefront='<div class="sf" role="group" aria-label="Frequently asked questions storefront">'+
    '<div class="sf-cornice"><div class="sf-name">FAQ &amp; Co.</div><div class="sf-sub">Questions answered · Est. 1819</div></div>'+
    '<div class="sf-awn"></div><div class="sf-body">'+
    FAQ.map(function(group,index){
      return '<button type="button" class="sf-door" data-category="'+index+'" aria-label="Open '+group[0]+' questions"><i data-e="'+group[1]+'" aria-hidden="true"></i><span>'+group[0]+'</span></button>';
    }).join('')+
    '</div><div class="sf-step"></div></div>';

  if(faqSign){
    faqSign.innerHTML=storefront;
    faqSign.addEventListener('click',function(e){
      var door=e.target.closest('.sf-door');
      if(!door)return;
      e.preventDefault();
      e.stopPropagation();
      openFaq(Number(door.getAttribute('data-category'))||0);
    },true);
  }else{
    console.warn('RevUC additions: could not find #faq to replace with the storefront.');
  }

  /* FORM CONFIGURATION
     Add a real endpoint for each form to receive submissions.
     Until then, the popup clearly directs users to the existing official form link. */
  var ENDPOINTS={hacker:'',sponsor:'',judge:''};
  var FORM_LINKS={
    hacker:'https://www.revolutionuc.com/interest',
    sponsor:'https://www.revolutionuc.com/sponsor-interest',
    judge:'https://www.revolutionuc.com/judge-mentor-interest'
  };
  var FORM_DEFS={
    hacker:{
      title:'Hacker Interest Form',
      intro:'We are glad you are interested in RevolutionUC. Share a few details and we will keep you updated when registration opens.',
      fields:[
        ['First name','text','first_name','e.g. Alex',true],
        ['Last name','text','last_name','e.g. Smith',true],
        ['Age','select','age',[['','Select your age'],['Under 18','Under 18'],['18','18'],['19','19'],['20','20'],['21','21'],['22','22'],['23','23'],['24','24'],['25','25'],['26 or older','26 or older']],true],
        ['Phone number','tel','phone','e.g. 123-456-7890',false],
        ['Email','email','email','e.g. alex@example.com',true],
        ['School','text','school','e.g. University of Cincinnati',true],
        ['Level of study','select','study_level',[['','Select a level'],['High school','High school'],['Undergraduate','Undergraduate'],['Graduate','Graduate'],['Other','Other']],true],
        ['Hackathon experience','select','experience',[['','Select an option'],['This is my first','This is my first'],['1–2 before','1–2 before'],['3 or more','3 or more']],false]
      ]
    },
    sponsor:{
      title:'Sponsor Interest Form',
      intro:'Thank you for considering RevolutionUC. Tell us a little about your organization and how you might like to get involved.',
      fields:[
        ['Organization','text','organization','e.g. Cincinnati Tech Co.',true],
        ['Contact name','text','contact_name','e.g. Alex Smith',true],
        ['Email','email','email','e.g. alex@example.com',true],
        ['Phone number','tel','phone','e.g. 123-456-7890',false],
        ['How would you like to help?','select','support_type',[['','Select an option'],['Financial sponsorship','Financial sponsorship'],['Prizes or swag','Prizes or swag'],['Workshop or talk','Workshop or talk'],['Not sure yet','Not sure yet']],true],
        ['Anything else?','textarea','message','Tell us more (optional)',false,true]
      ]
    },
    judge:{
      title:'Judge / Mentor Interest Form',
      intro:'Share your experience with student builders and tell us how you would like to participate.',
      fields:[
        ['First name','text','first_name','e.g. Alex',true],
        ['Last name','text','last_name','e.g. Smith',true],
        ['Email','email','email','e.g. alex@example.com',true],
        ['Company / organization','text','organization','e.g. Cincinnati Tech Co.',false],
        ['I would like to be a','select','participation',[['','Select an option'],['Judge','Judge'],['Mentor','Mentor'],['Either','Either']],true],
        ['Areas of expertise','text','expertise','e.g. web, ML, design, hardware',false],
        ['Availability','textarea','availability','Which times can you join? (Friday–Sunday)',false,true]
      ]
    }
  };

  function escapeAttr(value){
    return String(value).replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
  function renderField(field,index,kind){
    var label=field[0],type=field[1],name=field[2],placeholder=field[3],required=field[4],wide=field[5];
    var id='revuc-'+kind+'-'+index;
    var out='<div'+(wide?' class="revuc-wide"':'')+'><label for="'+id+'">'+label+(required?' <b>*</b>':'')+'</label>';
    if(type==='select'){
      out+='<select id="'+id+'" name="'+name+'"'+(required?' required':'')+'>';
      field[3].forEach(function(option){
        out+='<option value="'+escapeAttr(option[0])+'">'+escapeAttr(option[1])+'</option>';
      });
      out+='</select>';
    }else if(type==='textarea'){
      out+='<textarea id="'+id+'" name="'+name+'" placeholder="'+escapeAttr(placeholder)+'"'+(required?' required':'')+'></textarea>';
    }else{
      out+='<input id="'+id+'" name="'+name+'" type="'+type+'" placeholder="'+escapeAttr(placeholder)+'"'+(required?' required':'')+' autocomplete="'+(type==='email'?'email':type==='tel'?'tel':'off')+'">';
    }
    return out+'</div>';
  }

  function openForm(kind,externalHref){
    var def=FORM_DEFS[kind];
    if(!def)return;
    var href=externalHref||FORM_LINKS[kind];
    var content=$('.revuc-form-content',formOverlay);
    var html='<h2 id="revuc-form-title">'+def.title+'</h2><p class="revuc-lead">'+def.intro+'</p><div class="revuc-card"><form novalidate>';
    def.fields.forEach(function(field,index){html+=renderField(field,index,kind)});
    html+='<div class="revuc-actions"><button type="submit">Submit</button><span class="revuc-alt">Prefer the official form? <a href="'+escapeAttr(href)+'" target="_blank" rel="noopener">Open it in a new tab</a></span></div></form></div>';
    content.innerHTML=html;
    openOverlay(formOverlay);
    $('.revuc-panel',formOverlay).scrollTop=0;

    $('form',content).addEventListener('submit',function(e){
      e.preventDefault();
      var form=e.currentTarget;
      var invalid=form.querySelector(':invalid');
      if(invalid){
        invalid.focus();
        if(invalid.reportValidity)invalid.reportValidity();
        return;
      }
      var data={};
      new FormData(form).forEach(function(value,name){data[name]=value});
      data.form=kind;

      if(!ENDPOINTS[kind]){
        var notice=document.createElement('div');
        notice.className='revuc-message revuc-wide';
        notice.setAttribute('role','status');
        notice.innerHTML='<strong>This popup is a preview.</strong><br>Your answers have not been sent because this form is not connected to a submission service yet. Use the official form link above to submit your information.';
        var card=$('.revuc-card',content);
        var old= $('.revuc-message',card);
        if(old)old.remove();
        card.appendChild(notice);
        return;
      }

      var submit=$('button[type="submit"]',form);
      submit.disabled=true;
      submit.textContent='Submitting…';
      fetch(ENDPOINTS[kind],{
        method:'POST',
        headers:{'Content-Type':'application/json','Accept':'application/json'},
        body:JSON.stringify(data)
      }).then(function(response){
        if(!response.ok)throw new Error('The form service returned '+response.status);
        $('.revuc-card',content).innerHTML='<div class="revuc-message" role="status"><strong>Thank you!</strong><br>Your response has been submitted.</div>';
      }).catch(function(){
        submit.disabled=false;
        submit.textContent='Try again';
        var error=$('.revuc-message',content);
        if(!error){
          error=document.createElement('div');
          error.className='revuc-message';
          error.setAttribute('role','alert');
          $('.revuc-card',content).appendChild(error);
        }
        error.textContent='We could not submit your response. Your answers are still here; please try again or use the official form link.';
      });
    });
  }

  /* Make the three existing hero CTAs open the matching popup. */
  $$('.cta a').forEach(function(anchor){
    var href=anchor.getAttribute('href')||'';
    var kind=/sponsor/i.test(href)?'sponsor':/judge|mentor/i.test(href)?'judge':'hacker';
    anchor.addEventListener('click',function(e){
      e.preventDefault();
      openForm(kind,href);
    });
  });
})();
