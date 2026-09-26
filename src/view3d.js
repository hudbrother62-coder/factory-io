import * as T from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { SVGRenderer } from 'three/addons/renderers/SVGRenderer.js';

export class FactoryView {
  constructor(canvas) {
    this.canvas = canvas;
    try { this.renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: false }); }
    catch {
      this.software = true;
      this.renderer = new SVGRenderer();
      this.renderer.setQuality('low'); this.renderer.setPrecision(2);
      this.renderer.domElement.classList.add('software-3d');
      canvas.parentElement.prepend(this.renderer.domElement);
      document.getElementById('scene-subtitle').textContent='3D COMPATIBILITY MODE';
    }
    this.renderer.setPixelRatio?.(Math.min(devicePixelRatio, 1.6));
    if(this.renderer.shadowMap){this.renderer.shadowMap.enabled = true;this.renderer.shadowMap.type = T.PCFSoftShadowMap;}
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;
    this.world = new T.Scene();
    this.world.background = new T.Color('#c3cfd4');
    this.world.fog = new T.Fog('#c3cfd4', 25, 65);
    this.camera = new T.PerspectiveCamera(40, 1, .1, 100);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    this.controls.minDistance = 3; this.controls.maxDistance = 32;
    this.controls.maxPolarAngle = Math.PI / 2.04;
    this.controls.target.set(0, .6, 0);
    this.reset();
    this.world.add(new T.HemisphereLight(0xe5f2ff, 0x70848b, 2.4));
    this.world.add(new T.AmbientLight(0xffffff,this.software?.8:.1));
    const sun = new T.DirectionalLight(0xfff4df, this.software?.9:3.2);
    sun.position.set(-6, 15, 8); sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -13, right: 13, top: 13, bottom: -13 });
    sun.shadow.bias = -.0005; this.world.add(sun);
    this.materials = new Map(); this.objects = new Map(); this.boxes = new Map();
    const floor = new T.Mesh(new T.PlaneGeometry(100,100), this.mat('#899ca4'));
    floor.renderOrder=-1000;floor.rotation.x = -Math.PI/2; floor.receiveShadow = true; this.world.add(floor);
    const grid = new T.GridHelper(60,60,0x667f8b,0x7d949f); grid.renderOrder=-999;grid.position.y = .008; this.world.add(grid);
    const environment = new T.Group(); this.world.add(environment);
    // Painted work cell perimeter and walkways.
    for (const z of [-3.7,3.7]) this.cube(environment, [12,.008,.08], [0,.012,z], '#edce69');
    for (const x of [-6,6]) this.cube(environment, [.08,.008,7.4], [x,.012,0], '#edce69');
    for (let x=-6;x<=6;x+=1) this.cube(environment,[.45,.009,.1],[x,.012,4.4],'#dbe4e6');
    for (const x of [-9,9]) for(const z of [-7,7]) {
      this.cube(environment,[.35,6,.35],[x,3,z],'#586e7a');
      this.cube(environment,[.52,.08,.52],[x,.04,z],'#405560');
      this.cube(environment,[.39,1,.39],[x,.6,z],'#d9b548');
    }
    for(const x of [-8.5,8.5]) this.cube(environment,[.18,.25,15],[x,6,0],'#566c79');
    // Distant storage rack, deliberately low-poly to keep the laptop load modest.
    for(let n=0;n<3;n++) {
      const x=-4+n*3;
      for(const dx of [-1.1,1.1]) this.cube(environment,[.08,2.5,.08],[x+dx,1.25,-6],'#346780');
      for(const y of [.25,1.35,2.45]) this.cube(environment,[2.5,.09,1],[x,y,-6],'#c77840');
      for(const dx of [-.6,.6]) this.cube(environment,[.8,.7,.75],[x+dx,.66,-6],'#b6926b');
    }
    this.ray = new T.Raycaster(); this.pointer = new T.Vector2();
    this.plane = new T.Plane(new T.Vector3(0,1,0),0);
    this.selection = new T.BoxHelper(new T.Object3D(),0xffb358); this.selection.visible=false; this.world.add(this.selection);
    this.resize();
    new ResizeObserver(()=>this.resize()).observe(canvas.parentElement);
  }
  mat(color, metalness=.25) { const key=color+metalness; if(!this.materials.has(key)) this.materials.set(key,new T.MeshStandardMaterial({color,roughness:.55,metalness})); return this.materials.get(key); }
  cube(group,size,pos,color) { const m = new T.Mesh(new T.BoxGeometry(...size),this.mat(color)); m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;group.add(m);return m; }
  cylinder(group,radius,height,pos,color,axis='y') {const m=new T.Mesh(new T.CylinderGeometry(radius,radius,height,this.software?6:16),this.mat(color,.65));m.position.set(...pos);if(axis==='z')m.rotation.x=Math.PI/2;if(axis==='x')m.rotation.z=Math.PI/2;m.castShadow=true;group.add(m);return m;}
  makePart(type) {
    const g=new T.Group();g.userData.type=type;
    if(type==='conveyor') {
      for(const x of [-1.3,1.3]) for(const z of [-.48,.48]) {this.cube(g,[.09,.78,.09],[x,.39,z],'#718391');this.cube(g,[.24,.05,.22],[x,.025,z],'#344952');}
      this.cube(g,[3.4,.18,1.25],[0,.8,0],'#adb9bd');
      this.cube(g,[3.28,.07,1.02],[0,.91,0],'#2c444b');
      for(const z of [-.6,.6]) this.cube(g,[3.5,.12,.055],[0,.99,z],'#cbd3d4');
      for(let x=-1.55;x<1.6;x+=(this.software?.42:.26)) this.cylinder(g,.045,1.04,[x,.965,0],'#556d74','z');
      this.cube(g,[.35,.3,.3],[1.4,.72,.83],'#318295');
      this.cylinder(g,.11,.35,[1.4,.72,.61],'#b7c1c4','z');
      g.userData.indicator=this.cube(g,[.11,.05,.09],[-1.35,1.04,-.62],'#59d9b0');
    } else if(type==='box') {
      this.cube(g,[.68,.63,.68],[0,1.28,0],'#bb8d57');
      this.cube(g,[.16,.008,.69],[0,1.601,0],'#d6bc8d');
      this.cube(g,[.28,.2,.008],[0,1.3,.346],'#efe8d1');
      for(let x=-.1;x<.1;x+=.026)this.cube(g,[.009,.12,.009],[x,1.3,.352],'#454845');
    } else if(type==='sensor') {
      this.cube(g,[.22,.05,.28],[0,.025,-.8],'#435861');
      this.cube(g,[.05,1.28,.05],[0,.64,-.8],'#a7b7be');
      this.cube(g,[.22,.25,.19],[0,1.25,-.8],'#273944');
      g.userData.indicator=this.cylinder(g,.055,.04,[0,1.25,-.68],'#ee6563','z');
      const beam=new T.Mesh(new T.CylinderGeometry(.009,.009,1.48,6),new T.MeshBasicMaterial({color:'#ff6655',transparent:true,opacity:.45}));beam.rotation.x=Math.PI/2;beam.position.set(0,1.25,.08);g.add(beam);
    } else if(type==='pusher') {
      this.cube(g,[.65,.8,.58],[0,.4,0],'#647c88');
      this.cube(g,[.65,.16,.65],[0,.9,0],'#d5ad5d');
      this.cylinder(g,.115,.55,[0,1.1,.1],'#b6c6ce','z');
      const arm=new T.Group();this.cylinder(arm,.035,.85,[0,1.1,.6],'#dfe7ea','z');this.cube(arm,[.55,.32,.08],[0,1.1,1],'#d9ba6e');g.add(arm);g.userData.arm=arm;
    } else if(type==='stopper') {
      this.cube(g,[.25,.75,.35],[0,.375,0],'#627883');
      g.userData.arm=this.cube(g,[.1,.4,1.05],[0,1.06,0],'#e4b157');
    } else if(type==='emitter') {
      for(const z of [-.64,.64])this.cube(g,[.07,1.8,.07],[0,.9,z],'#667b87');
      this.cube(g,[.3,.19,1.4],[0,1.8,0],'#388da4');
      this.cube(g,[.23,.07,.6],[0,1.65,0],'#293b46');
      g.userData.indicator=this.cube(g,[.31,.05,.4],[0,1.92,0],'#6fdbc3');
    } else if(type==='lamp') {
      this.cube(g,[.45,.05,.45],[0,.025,0],'#526a75');this.cylinder(g,.045,1.45,[0,.76,0],'#a6b7bf');
      for(let i=0;i<3;i++){const m=this.cylinder(g,.105,.16,[0,1.55+i*.18,0],['#469b74','#d0a449','#c05e59'][i]);if(i===0)g.userData.indicator=m;}
      this.cylinder(g,.115,.055,[0,2.01,0],'#243946');
    } else {
      this.cube(g,[.12,.9,.12],[0,.45,0],'#8b9fa8');this.cube(g,[.45,.14,.32],[0,.96,0],'#ccaf64');g.userData.indicator=this.cylinder(g,.1,.09,[0,1.075,0],'#dc625d');
    }
    return g;
  }
  sync(parts,boxes,selected,run) {
    if(this.software && performance.now()-(this.lastDraw||0)<60)return;
    this.lastDraw=performance.now();
    const wanted=new Set(parts.filter(p=>!run||p.type!=='box').map(p=>p.id));
    for(const [id,g] of this.objects)if(!wanted.has(id)){this.dispose(g);this.objects.delete(id);}
    for(const p of parts){if(!wanted.has(p.id))continue;let g=this.objects.get(p.id);if(g&&g.userData.type!==p.type){this.dispose(g);this.objects.delete(p.id);g=null;}if(!g){g=this.makePart(p.type);g.userData.id=p.id;this.world.add(g);this.objects.set(p.id,g);}g.position.set(p.x,0,p.z);g.rotation.y=-(p.rotation||0)*Math.PI/2;if(g.userData.indicator)g.userData.indicator.material=this.mat(p.value?'#5df6bc':'#725b5a');if(g.userData.arm){if(p.type==='pusher')g.userData.arm.position.z=p.value?.3:-.3;else g.userData.arm.position.y=p.value?0:-.45;}}
    const ids=new Set(run?boxes.map(b=>b.id):[]);for(const [id,g]of this.boxes)if(!ids.has(id)){this.dispose(g);this.boxes.delete(id);}if(run)for(const b of boxes){let g=this.boxes.get(b.id);if(!g){g=this.makePart('box');this.world.add(g);this.boxes.set(b.id,g);}g.position.set(b.x,0,b.z);}
    const target=this.objects.get(selected);this.selection.visible=!!target;if(target)this.selection.setFromObject(target);
    this.controls.update();this.renderer.render(this.world,this.camera);
  }
  dispose(g){this.world.remove(g);g.traverse(o=>{o.geometry?.dispose();if(o.material?.type==='MeshBasicMaterial')o.material.dispose();});}
  rayAt(x,y){this.pointer.set(x/this.canvas.clientWidth*2-1,-y/this.canvas.clientHeight*2+1);this.ray.setFromCamera(this.pointer,this.camera);}
  ground(x,y){this.rayAt(x,y);const p=new T.Vector3();return this.ray.ray.intersectPlane(this.plane,p)?{x:p.x,z:p.z}:{x:0,z:0};}
  pick(x,y){this.rayAt(x,y);const hit=this.ray.intersectObjects([...this.objects.values()],true)[0];if(!hit)return null;let g=hit.object;while(g&&!g.userData.id)g=g.parent;return g?.userData.id;}
  reset(){this.camera.position.set(8.5,7.5,10.5);this.controls.target.set(0,.5,0);this.controls.update();}
  zoom(factor){this.camera.position.sub(this.controls.target).multiplyScalar(factor).add(this.controls.target);this.controls.update();}
  resize(){const w=this.canvas.parentElement.clientWidth,h=this.canvas.parentElement.clientHeight;if(!w||!h)return;this.renderer.setSize(w,h,false);this.camera.aspect=w/h;this.camera.updateProjectionMatrix();}
}
