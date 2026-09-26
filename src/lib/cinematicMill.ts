import * as THREE from 'three';

/** A close, physically lit workshop study. Geometry and textures are local and deterministic. */
export function createCinematicMill(canvas: HTMLCanvasElement) {
  const mobile = window.innerWidth < 768;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, mobile ? 1.25 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color('#151913');
  scene.fog = new THREE.FogExp2('#151913', .045);
  const camera = new THREE.PerspectiveCamera(37, 1, .1, 40);
  const resources = new Set<{dispose(): void}>();
  const keep = <T extends {dispose(): void}>(resource: T) => { resources.add(resource); return resource; };
  let seed = 1994;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };

  function surface(kind: 'stone' | 'wood' | 'cloth' | 'plaster' | 'label', size = 512) {
    const image = document.createElement('canvas'); image.width = image.height = size;
    const ctx = image.getContext('2d')!;
    ctx.fillStyle = {stone:'#77766f',wood:'#514031',cloth:'#a38960',plaster:'#555348',label:'#ddcfad'}[kind];
    ctx.fillRect(0,0,size,size);
    if (kind === 'label') {
      ctx.strokeStyle='#464d35';ctx.lineWidth=3;ctx.strokeRect(25,25,size-50,size-50);
      ctx.textAlign='center';ctx.fillStyle='#394331';ctx.font='32px Georgia';ctx.fillText('BABAY DEE',size/2,135);
      ctx.font='16px Georgia';ctx.fillText('ATTA CHAKKI',size/2,174);
      ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(256,320);ctx.lineTo(256,215);ctx.stroke();
      for(let i=0;i<5;i++)for(const side of [-1,1]){ctx.beginPath();ctx.ellipse(256+side*12,225+i*16,13,5,side*-.65,0,Math.PI*2);ctx.fill();}
      ctx.font='20px Georgia';ctx.fillText('STONE GROUND',256,375);ctx.font='14px Georgia';ctx.fillText('PURE WHOLE WHEAT',256,411);
    } else {
      const pixels=ctx.getImageData(0,0,size,size);
      for(let y=0;y<size;y++)for(let x=0;x<size;x++){
        const i=(y*size+x)*4;
        const noise=(random()-.5)*(kind==='stone'?58:24);
        const broad=Math.sin(x*.029+Math.sin(y*.014)*2)*Math.cos(y*.041)*14+Math.sin(x*.07+y*.03)*Math.cos(y*.08-x*.02)*7;
        const grain=kind==='wood'?Math.sin(x*.19+Math.sin(y*.009)*3+Math.sin(x*.036)*5)*7+Math.sin(x*.71+y*.012+Math.cos(x*.06)*3)*4+broad*.4:kind==='cloth'?((x%6<2?-13:7)+(y%6<2?-12:7)):broad;
        pixels.data[i]+=noise+grain;pixels.data[i+1]+=noise+grain;pixels.data[i+2]+=noise+grain;
      }
      ctx.putImageData(pixels,0,0);
      if(kind==='stone'){
        for(let i=0;i<1100;i++){ctx.fillStyle=`rgba(32,29,23,${random()*.3})`;ctx.beginPath();ctx.ellipse(random()*size,random()*size,random()*2+.4,random()*1.3+.3,random()*6,0,Math.PI*2);ctx.fill();}
      }
      if(kind==='wood')for(let i=0;i<80;i++){ctx.strokeStyle=`rgba(18,12,7,${random()*.3})`;ctx.lineWidth=random()*1.6;ctx.beginPath();const x=random()*size;ctx.moveTo(x,0);ctx.bezierCurveTo(x+18,170,x-12,330,x+5,size);ctx.stroke();}
    }
    const map=keep(new THREE.CanvasTexture(image));map.colorSpace=THREE.SRGBColorSpace;map.wrapS=map.wrapT=THREE.RepeatWrapping;
    map.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy());return map;
  }
  const stoneMap=surface('stone',1024),woodMap=surface('wood'),clothMap=surface('cloth'),plasterMap=surface('plaster');
  clothMap.repeat.set(2,2);
  const material=(color:string,roughness=1,metalness=0)=>keep(new THREE.MeshStandardMaterial({color,roughness,metalness}));
  const stone=keep(new THREE.MeshStandardMaterial({map:stoneMap,bumpMap:stoneMap,bumpScale:.07,roughness:.96,color:'#d3d1c8'}));
  const wood=keep(new THREE.MeshStandardMaterial({map:woodMap,bumpMap:woodMap,bumpScale:.028,roughness:.8,color:'#b5a184'}));
  const iron=material('#34352d',.63,.75),brass=material('#8a6c3d',.5,.65),flourMat=material('#e6d9bb');
  const cloth=keep(new THREE.MeshStandardMaterial({map:clothMap,bumpMap:clothMap,bumpScale:.018,roughness:1,side:THREE.DoubleSide}));
  const mesh=(geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>{
    const object=new THREE.Mesh(keep(geometry),mat);object.position.set(x,y,z);object.castShadow=true;object.receiveShadow=true;parent.add(object);return object;
  };
  const box=(w:number,h:number,d:number,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>mesh(new THREE.BoxGeometry(w,h,d),mat,parent,x,y,z);
  const cylinder=(r:number,h:number,mat:THREE.Material,parent:THREE.Object3D,x=0,y=0,z=0)=>mesh(new THREE.CylinderGeometry(r,r,h,80),mat,parent,x,y,z);
  const ring=(r:number,t:number,mat:THREE.Material,parent:THREE.Object3D,y:number)=>{const m=mesh(new THREE.TorusGeometry(r,t,8,96),mat,parent,0,y);m.rotation.x=Math.PI/2;return m;};

  // A dark, shallow workshop set keeps the eye on the warm, tactile stone surfaces.
  scene.add(new THREE.HemisphereLight('#dae4ed','#292014',1.05));
  const key=new THREE.DirectionalLight('#fff0d4',4.3);key.position.set(-3.5,7,4);key.castShadow=true;
  key.shadow.mapSize.set(mobile?1024:2048,mobile?1024:2048);
  Object.assign(key.shadow.camera,{left:-5,right:5,top:6,bottom:-4,near:.1,far:20});key.shadow.normalBias=.025;key.shadow.bias=-.0003;key.shadow.radius=3;scene.add(key);
  const rim=new THREE.DirectionalLight('#e7b76e',2.8);rim.position.set(2.5,4,-3);scene.add(rim);
  const fill=new THREE.DirectionalLight('#b8cee0',.6);fill.position.set(2,2,5);scene.add(fill);
  const plaster=keep(new THREE.MeshStandardMaterial({map:plasterMap,bumpMap:plasterMap,bumpScale:.08,roughness:1,color:'#78786c'}));
  box(18,10,.2,plaster,scene,0,3,-4);
  // Out-of-focus spatial cues: vertical timbers and a recessed mill window.
  for(const x of [-5,-2.8,3.7,6])box(.18,7,.24,wood,scene,x,2.6,-3.8);
  box(2.1,2.8,.12,material('#0f1513'),scene,-2.7,3.1,-3.65);
  const windowGlow=keep(new THREE.MeshBasicMaterial({color:'#e4bd80',transparent:true,opacity:.35}));
  box(1.6,2.4,.04,windowGlow,scene,-2.7,3.1,-3.53);
  for(const x of [-3.55,-2.7,-1.85])box(.065,2.65,.15,wood,scene,x,3.1,-3.46);
  box(1.85,.075,.15,wood,scene,-2.7,3.1,-3.46);
  const floor=mesh(new THREE.PlaneGeometry(24,24),material('#292a23'),scene,0,-.15);floor.rotation.x=-Math.PI/2;

  const machinePaint=material('#35545b',.53,.48);
  const steel=material('#87918b',.38,.72);
  const rubber=material('#191b19',.96);
  const assembly=new THREE.Group();assembly.position.y=.65;scene.add(assembly);
  // The heavy stones sit on a welded frame; the electric drive sits below the milling deck.
  box(3.75,.12,2.7,machinePaint,assembly,.05,.61,.05);
  for(const x of [-1.5,1.55])for(const z of [-1.05,1.15]){
    box(.14,1.27,.14,machinePaint,assembly,x,-.055,z);
    box(.32,.06,.3,iron,assembly,x,-.66,z);
    cylinder(.026,.055,steel,assembly,x+.09,-.61,z+.07);
  }
  for(const z of [-1.05,1.15])box(3.2,.11,.11,machinePaint,assembly,.025,-.35,z);
  box(.12,.13,2.2,machinePaint,assembly,-.45,-.32,.05);
  // Floor-mounted induction motor: cooling fins, fan cover, terminal box and anchored feet.
  const motor=new THREE.Group();motor.position.set(-2.5,.59,.17);motor.rotation.x=Math.PI/2;scene.add(motor);
  cylinder(.285,.84,machinePaint,motor,0,0);
  for(let i=0;i<12;i++)cylinder(.325,.023,machinePaint,motor,0,-.34+i*.062);
  cylinder(.315,.1,iron,motor,0,-.49);
  cylinder(.29,.085,machinePaint,motor,0,.47);
  cylinder(.06,.36,steel,motor,0,.68);
  for(let i=0;i<12;i++){
    const a=i*Math.PI/6;
    const rib=box(.017,.015,.49,iron,motor,Math.cos(a)*.2,-.551,Math.sin(a)*.2);
    rib.rotation.y=-a;
  }
  box(.34,.28,.2,machinePaint,scene,-2.5,.98,.12);
  box(.26,.04,.17,iron,scene,-2.5,1.13,.12);
  for(const x of [-2.75,-2.25]){
    box(.13,.3,.68,machinePaint,scene,x,.19,.18);
    box(.25,.045,.76,iron,scene,x,.025,.18);
    for(const z of [-.08,.44])cylinder(.03,.035,steel,scene,x,.065,z);
  }
  // A front-facing belt reduction drives a countershaft and right-angle gearbox below the stone.
  const motorRadius=.19, drivenRadius=.43, driveY=.59, driveZ=1.06;
  function pulley(x:number,radius:number){
    const group=new THREE.Group();group.position.set(x,driveY,driveZ);scene.add(group);
    for(const z of [-.035,.035]){const disc=cylinder(radius,.025,iron,group,0,0,z);disc.rotation.x=Math.PI/2;}
    const hub=cylinder(radius*.23,.16,steel,group);hub.rotation.x=Math.PI/2;
    for(let i=0;i<6;i++){const a=i*Math.PI/3;const spoke=box(radius*1.52,.045,.045,machinePaint,group);spoke.rotation.z=a;}
    return group;
  }
  const motorPulley=pulley(-2.5,motorRadius),drivenPulley=pulley(-.45,drivenRadius);
  box(.5,.48,.54,machinePaint,scene,-.45,.59,.06);
  const countershaft=cylinder(.075,1.08,steel,scene,-.45,.59,.57);countershaft.rotation.x=Math.PI/2;
  cylinder(.105,.8,steel,scene,-.45,1.05,0);
  cylinder(.18,.12,iron,scene,-.45,.98,0);
  // Tangent belt spans meet both pulleys; animated witness marks make direction legible.
  const spacing=2.05, angle=Math.asin((drivenRadius-motorRadius)/spacing);
  const beltPoints:THREE.Vector3[]=[];
  for(let i=0;i<=40;i++){const a=Math.PI/2+angle+i/40*(Math.PI-2*angle);beltPoints.push(new THREE.Vector3(-2.5+Math.cos(a)*motorRadius,driveY+Math.sin(a)*motorRadius,driveZ));}
  for(let i=0;i<=50;i++){const a=3*Math.PI/2-angle+i/50*(Math.PI+2*angle);beltPoints.push(new THREE.Vector3(-.45+Math.cos(a)*drivenRadius,driveY+Math.sin(a)*drivenRadius,driveZ));}
  const beltCurve=new THREE.CatmullRomCurve3(beltPoints,true,'centripetal');
  const beltLength=beltCurve.getLength();
  mesh(new THREE.TubeGeometry(beltCurve,180,.027,5,true),rubber,scene);
  const beltMarks=Array.from({length:7},()=>mesh(new THREE.SphereGeometry(.019,6,4),material('#665f4b'),scene));
  // A rear safety backing and wire guard leave the mechanism visible without an exposed belt.
  const guardMaterial=keep(new THREE.MeshStandardMaterial({color:'#8e9a92',metalness:.55,roughness:.6,transparent:true,opacity:.3}));
  for(let x=-2.8;x<=.04;x+=.14)box(.009,.99,.01,guardMaterial,scene,x,.6,1.2);
  for(let y=.12;y<=1.1;y+=.14)box(2.92,.009,.01,guardMaterial,scene,-1.39,y,1.2);
  box(3.02,.04,.06,iron,scene,-1.39,1.12,1.2);
  box(3.02,.04,.06,iron,scene,-1.39,.10,1.2);
  // Electrical conduit runs to a compact wall-mounted starter with a red stop button.
  box(.34,.47,.14,machinePaint,scene,-3.05,1.49,-.95);
  for(const [y,color] of [[1.59,'#71935c'],[1.42,'#9f4535']] as const){const button=cylinder(.055,.035,material(color,.5),scene,-3.05,y,-.855);button.rotation.x=Math.PI/2;}
  const cableCurve=new THREE.CatmullRomCurve3([new THREE.Vector3(-3.05,1.25,-.95),new THREE.Vector3(-3.05,.27,-.7),new THREE.Vector3(-2.9,.2,.05),new THREE.Vector3(-2.67,.95,.12)]);
  mesh(new THREE.TubeGeometry(cableCurve,40,.022,6,false),rubber,scene);
  const mill=new THREE.Group();mill.position.set(-.45,.7,0);assembly.add(mill);
  const lowerProfile=[[.15,0],[1.2,0],[1.27,.05],[1.29,.39],[1.25,.46],[.15,.46]].map(([r,y])=>new THREE.Vector2(r,y));
  mesh(new THREE.LatheGeometry(lowerProfile,96),stone,mill);
  ring(1.28,.024,iron,mill,.13);
  ring(1.28,.028,brass,mill,.35);
  // A narrow working gap with flour residue, rather than a thick white spacer.
  cylinder(1.245,.035,flourMat,mill,0,.472);
  const rotor=new THREE.Group();rotor.position.y=.49;mill.add(rotor);
  const profile=[[.17,0],[1.21,0],[1.27,.05],[1.275,.29],[1.24,.37],[.8,.395],[.18,.39],[.17,0]].map(([r,y])=>new THREE.Vector2(r,y));
  const rotorGeometry=new THREE.LatheGeometry(profile,128,0,Math.PI*2);
  const pos=rotorGeometry.getAttribute('position');
  for(let i=0;i<pos.count;i++){const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i),a=Math.atan2(z,x);const rough=1+.002*Math.sin(a*37)+.0015*Math.cos(a*61);pos.setXYZ(i,x*rough,y,z*rough);}
  rotorGeometry.computeVertexNormals();mesh(rotorGeometry,stone,rotor);
  ring(1.279,.018,iron,rotor,.09);ring(1.273,.015,brass,rotor,.28);
  for(let i=0;i<16;i++){const a=i/16*Math.PI*2;mesh(new THREE.SphereGeometry(.028,8,6),iron,rotor,Math.cos(a)*1.285,.12,Math.sin(a)*1.285);}
  // Small inset furrows communicate the working stone's radial dressing.
  const cuts:number[]=[];
  for(let group=0;group<10;group++)for(let j=0;j<4;j++){
    const a=group*Math.PI*.2+j*.038,r=.26+j*.13;
    cuts.push(Math.cos(a)*r,.397,Math.sin(a)*r,Math.cos(a+.2)*(1.16-j*.025),.378,Math.sin(a+.2)*(1.16-j*.025));
  }
  const cutGeo=keep(new THREE.BufferGeometry());cutGeo.setAttribute('position',new THREE.Float32BufferAttribute(cuts,3));
  rotor.add(new THREE.LineSegments(cutGeo,keep(new THREE.LineBasicMaterial({color:'#443f32',transparent:true,opacity:.42}))));

  // A low hopper contains a grain bed; individual kernels fall only through its throat.
  const hopperMat=keep(new THREE.MeshStandardMaterial({roughness:.43,metalness:.65,side:THREE.DoubleSide,color:'#abb3a8'}));
  const hopper=mesh(new THREE.CylinderGeometry(.47,.095,.54,48,1,true),hopperMat,mill,0,1.25);
  ring(.472,.019,iron,mill,1.52);
  for(const x of [-.49,.49]){box(.045,1.21,.045,machinePaint,mill,x,1.0,-.22);box(.045,.06,.56,machinePaint,mill,x,1.48,0);}
  const grainMat=material('#b98b49',.82);
  const grainBed=cylinder(.43,.04,grainMat,mill,0,1.48);
  const kernelGeo=keep(new THREE.SphereGeometry(1,8,6));
  const kernelPos=kernelGeo.getAttribute('position');
  for(let i=0;i<kernelPos.count;i++){const x=kernelPos.getX(i),y=kernelPos.getY(i),z=kernelPos.getZ(i);kernelPos.setXYZ(i,x*(1-.16*Math.abs(y)),y,z*(z>.0&&Math.abs(x)<.35?.72:1));}
  kernelGeo.computeVertexNormals();
  const bedCount=mobile?110:220;
  const bed=new THREE.InstancedMesh(kernelGeo,grainMat,bedCount);keep(bed);mill.add(bed);bed.castShadow=true;
  const dummy=new THREE.Object3D();
  for(let i=0;i<bedCount;i++){const a=random()*Math.PI*2,r=Math.sqrt(random())*.41;dummy.position.set(Math.cos(a)*r,1.51+(.41-r)*.08,Math.sin(a)*r);dummy.rotation.set(random()*3,random()*6,random()*3);dummy.scale.set(.018,.032,.014);dummy.updateMatrix();bed.setMatrixAt(i,dummy.matrix);}
  const count=mobile?90:160;
  const falling=new THREE.InstancedMesh(kernelGeo,grainMat,count);keep(falling);mill.add(falling);falling.castShadow=!mobile;
  const particles=Array.from({length:count},()=>({phase:random(),angle:random()*6.28,r:random(),spin:random()*6,size:.7+random()*.6}));

  // A worn timber flour chute and a softly irregular flour mound.
  const chute=new THREE.Group();chute.position.set(.65,.81,.1);chute.rotation.z=-.11;assembly.add(chute);
  box(1.35,.055,.4,wood,chute,.52,0,0);
  for(const z of [-.215,.215])box(1.35,.12,.04,wood,chute,.52,.04,z);
  box(1.17,.012,.32,flourMat,chute,.57,.034,0);
  const bowlProfile=[[0,0],[.39,0],[.55,.11],[.61,.32],[.59,.35],[.56,.32],[.51,.14],[.35,.06],[0,.06]].map(([r,y])=>new THREE.Vector2(r,y));
  const bowl=mesh(new THREE.LatheGeometry(bowlProfile,64),wood,assembly,1.66,.685,.12);
  const moundGeo=new THREE.SphereGeometry(.49,48,20,0,Math.PI*2,0,Math.PI/2);
  const moundPos=moundGeo.getAttribute('position');
  for(let i=0;i<moundPos.count;i++){const x=moundPos.getX(i),y=moundPos.getY(i),z=moundPos.getZ(i);moundPos.setXYZ(i,x,y*.42*(1+.04*Math.sin(x*37)*Math.cos(z*28)),z);}
  moundGeo.computeVertexNormals();mesh(moundGeo,flourMat,assembly,1.66,.88,.12);

  const bagProfile=[[.05,0],[.31,.025],[.39,.2],[.37,.65],[.29,.88],[.2,1.03],[.19,1.13]].map(([r,y])=>new THREE.Vector2(r,y));
  const bagGeo=new THREE.LatheGeometry(bagProfile,64,0,Math.PI*2),bp=bagGeo.getAttribute('position');
  for(let i=0;i<bp.count;i++){const x=bp.getX(i),y=bp.getY(i),z=bp.getZ(i),a=Math.atan2(z,x);const fold=1+Math.sin(a*11+y*4)*(.025+y*.035)+Math.cos(a*19-y*2)*.015;bp.setXYZ(i,x*fold,y,z*fold*.8);}
  bagGeo.computeVertexNormals();const bag=new THREE.Group();bag.position.set(1.16,.69,-.92);bag.rotation.y=-.2;assembly.add(bag);mesh(bagGeo,cloth,bag);
  ring(.185,.017,wood,bag,1.02);
  const labelMat=keep(new THREE.MeshStandardMaterial({map:surface('label'),roughness:1}));
  mesh(new THREE.PlaneGeometry(.43,.46,4,4),labelMat,bag,0,.5,.326);
  // A handful of loose kernels and flour specks breaks perfectly clean CGI surfaces.
  const scatter=new THREE.InstancedMesh(kernelGeo,grainMat,mobile?45:90);keep(scatter);assembly.add(scatter);
  for(let i=0;i<scatter.count;i++){dummy.position.set(-1.8+random()*3.5,.7,random()*1.9-.7);dummy.scale.set(.018,.012,.031);dummy.rotation.set(0,random()*6,random());dummy.updateMatrix();scatter.setMatrixAt(i,dummy.matrix);}

  const dotCanvas=document.createElement('canvas');dotCanvas.width=dotCanvas.height=32;const dc=dotCanvas.getContext('2d')!;
  const gradient=dc.createRadialGradient(16,16,0,16,16,16);gradient.addColorStop(0,'rgba(255,255,255,1)');gradient.addColorStop(.3,'rgba(255,255,255,.5)');gradient.addColorStop(1,'rgba(255,255,255,0)');dc.fillStyle=gradient;dc.fillRect(0,0,32,32);
  const dot=keep(new THREE.CanvasTexture(dotCanvas));
  const flourCount=mobile?240:480;const flourPositions=new Float32Array(flourCount*3);
  const flourGeo=keep(new THREE.BufferGeometry());flourGeo.setAttribute('position',new THREE.BufferAttribute(flourPositions,3));
  const flourPoints=new THREE.Points(flourGeo,keep(new THREE.PointsMaterial({color:'#f9e9c4',size:.025,map:dot,transparent:true,opacity:.58,depthWrite:false,sizeAttenuation:true})));scene.add(flourPoints);
  const flourSeeds=Array.from({length:flourCount},()=>({phase:random(),x:random(),z:random(),speed:.65+random()*.4}));
  const dustCount=mobile?32:70,dustPositions=new Float32Array(dustCount*3);
  const dustGeo=keep(new THREE.BufferGeometry());dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPositions,3));
  const dust=new THREE.Points(dustGeo,keep(new THREE.PointsMaterial({color:'#e8cf9a',size:.018,map:dot,transparent:true,opacity:.22,depthWrite:false})));scene.add(dust);
  const motes=Array.from({length:dustCount},()=>({x:random()*7-3.5,y:random()*4,z:random()*5-2.5,phase:random()*6}));
  const target=new THREE.Vector3();
  return {
    resize(width:number,height:number){renderer.setSize(Math.max(1,width),Math.max(1,height),false);camera.aspect=width/Math.max(1,height);camera.updateProjectionMatrix();},
    render(progress:number,seconds=0){
      const p=THREE.MathUtils.clamp(progress,0,1),e=p*p*(3-2*p);
      // A slow dolly/orbit reveals the grain, working stones and finished flour in one continuous shot.
      // Fit the whole machine, motor and outlet to the actual canvas aspect ratio.
      const orbit=-.23+e*.35;
      const halfFov=THREE.MathUtils.degToRad(camera.fov*.5);
      const distance=Math.max(6.6,2.9/(Math.tan(halfFov)*camera.aspect));
      target.set(-.52+e*.15,1.43,0);
      camera.position.set(target.x+Math.sin(orbit)*distance,2.9+distance*.045,target.z+Math.cos(orbit)*distance);camera.lookAt(target);
      const shaftAngle=seconds*.72;
      rotor.rotation.y=shaftAngle;
      drivenPulley.rotation.z=shaftAngle;
      motorPulley.rotation.z=shaftAngle*drivenRadius/motorRadius;
      beltMarks.forEach((mark,i)=>mark.position.copy(beltCurve.getPointAt((i/beltMarks.length+shaftAngle*drivenRadius/beltLength)%1)));
      for(let i=0;i<count;i++){
        const particle=particles[i],t=(particle.phase+seconds*.8)%1;
        const spread=.034+t*.035;
        dummy.position.set(Math.cos(particle.angle)*spread*particle.r,.98-t*t*.56,Math.sin(particle.angle)*spread*particle.r);
        dummy.rotation.set(particle.spin+seconds*.8,particle.angle,particle.spin+seconds*.7);
        dummy.scale.set(.013*particle.size,.027*particle.size,.011*particle.size);dummy.updateMatrix();falling.setMatrixAt(i,dummy.matrix);
      }
      falling.instanceMatrix.needsUpdate=true;
      for(let i=0;i<flourCount;i++){
        const seed=flourSeeds[i],t=(seed.phase+seconds*seed.speed*.6)%1;
        flourPositions[i*3]=.86+Math.min(t/.78,1)*.95+(seed.x-.5)*.06;
        flourPositions[i*3+1]=1.51-t*.11-Math.pow(Math.max(0,t-.78)*3,2)*.12;
        flourPositions[i*3+2]=.1+(seed.z-.5)*.27;
      }
      flourGeo.attributes.position.needsUpdate=true;
      for(let i=0;i<dustCount;i++){const m=motes[i];dustPositions[i*3]=m.x+Math.sin(seconds*.07+m.phase)*.16;dustPositions[i*3+1]=m.y+Math.sin(seconds*.09+m.phase)*.12;dustPositions[i*3+2]=m.z;}
      dustGeo.attributes.position.needsUpdate=true;
      renderer.render(scene,camera);
    },
    dispose(){resources.forEach(resource=>resource.dispose());key.shadow.dispose();renderer.dispose();scene.clear();},
  };
}
