import React, { Component, Suspense, memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { Stars, useGLTF } from '@react-three/drei';
import * as THREE from 'three';
import { addCrystalOnce, isPortalUnlocked, togglePauseState } from './gameLogic.js';

const TOTAL = 10;
const START = new THREE.Vector3(-0.2, 0, 5.1);
// Keep each pickup clear of the three solid pillar footprints.
const BASE_OBSTACLES = [[-4,2,.72],[0,-1.8,.72],[4,2,.72]];
const DRONE_SPAWNS = [[-6,.65,-3],[6,.65,-3],[-6,.65,1],[6,.65,1],[-6,.65,4],[6,.65,4],[-4,.65,-5],[-1,.65,-5],[2,.65,-5],[4,.65,4],[-5,.65,0],[5,.65,0]];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
useGLTF.preload('/models/player.glb');
useGLTF.preload('/models/drone.glb');
useGLTF.preload('/models/crystal.glb');

function createMission(number) {
  const portal = number % 2 ? [6.3,-5.2] : [-6.3,-5.2];
  const seed = number * 7919;
  let state = seed >>> 0;
  const random = () => { state = (state * 1664525 + 1013904223) >>> 0; return state / 4294967296; };
  const obstaclePoints = [];
  for (let x=-6; x<=6; x+=2) for (let z=-4; z<=4; z+=2) obstaclePoints.push([x,z]);
  const extraCount = Math.min(9, Math.floor((number-1)/10));
  const extraObstacles = obstaclePoints.filter(([x,z]) => Math.hypot(x-START.x,z-START.z)>2.7 && Math.hypot(x-portal[0],z-portal[1])>2.8 && BASE_OBSTACLES.every(([bx,bz])=>Math.hypot(x-bx,z-bz)>1.8)).sort(()=>random()-.5).slice(0,extraCount).map(([x,z])=>[x,z,.52]);
  const obstacles = [...BASE_OBSTACLES,...extraObstacles];
  const crystalCandidates=[];
  for(let x=-6;x<=6;x+=2)for(let z=-5;z<=5;z+=2){
    if(Math.hypot(x-START.x,z-START.z)<1.8||Math.hypot(x-portal[0],z-portal[1])<2.2)continue;
    if(obstacles.some(([ox,oz,r])=>Math.hypot(x-ox,z-oz)<r+1.1))continue;
    crystalCandidates.push([x,.8,z]);
  }
  crystalCandidates.sort(()=>random()-.5);
  const crystals=[];
  for(const candidate of crystalCandidates){if(crystals.every(p=>Math.hypot(p[0]-candidate[0],p[2]-candidate[2])>=1.9))crystals.push(candidate);if(crystals.length===TOTAL)break;}
  for(const candidate of crystalCandidates){if(crystals.length===TOTAL)break;if(!crystals.includes(candidate))crystals.push(candidate);}
  const droneCount=Math.min(DRONE_SPAWNS.length,3+Math.floor((number-1)/8));
  const drones=DRONE_SPAWNS.slice().sort(()=>random()-.5).slice(0,droneCount);
  return {crystals,obstacles,drones,portal,extraCount,final:number===100};
}

function ProceduralCrystal() {
  return <mesh castShadow><octahedronGeometry args={[.38,0]}/><meshStandardMaterial color="#89f8ff" emissive="#00d9ff" emissiveIntensity={2.2} metalness={.25} roughness={.18}/></mesh>;
}

function ImportedCrystal() {
  const {scene}=useGLTF('/models/crystal.glb');
  const model=useMemo(()=>{const clone=scene.clone(true);clone.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;}});return clone;},[scene]);
  return <primitive object={model}/>;
}

function ImportedModel({url,scale=1,position=[0,0,0],materialColor,emissiveColor,emissiveIntensity=.55}) {
  const {scene}=useGLTF(url);
  const model=useMemo(()=>{const clone=scene.clone(true);clone.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;if(materialColor){node.geometry=node.geometry.clone();if(!node.geometry.getAttribute('normal'))node.geometry.computeVertexNormals();node.material=new THREE.MeshStandardMaterial({color:materialColor,emissive:emissiveColor||materialColor,emissiveIntensity,metalness:.32,roughness:.34,side:THREE.DoubleSide});}}});return clone;},[scene,materialColor,emissiveColor,emissiveIntensity]);
  return <primitive object={model} scale={scale} position={position}/>;
}

class ModelBoundary extends Component {
  constructor(props){super(props);this.state={failed:false};}
  static getDerivedStateFromError(){return {failed:true};}
  componentDidCatch(error){console.warn('3D game model unavailable; using procedural fallback.',error);}
  render(){return this.state.failed?this.props.fallback:this.props.children;}
}

function Crystal({ position, collected, index }) {
  const ref = useRef();
  useFrame(({ clock }, dt) => { if (ref.current && !collected) { ref.current.rotation.y += dt; ref.current.position.y = position[1] + Math.sin(clock.elapsedTime * 2 + index) * .13; } });
  if (collected) return null;
  return <group ref={ref} position={position}><ModelBoundary fallback={<ProceduralCrystal/>}><Suspense fallback={<ProceduralCrystal/>}><ImportedCrystal/></Suspense></ModelBoundary></group>;
}
const MemoCrystal=memo(Crystal);

function ProceduralPlayer({arms}) {
  return <>
    <mesh position={[0,.61,0]} castShadow><capsuleGeometry args={[.32,.58,6,12]}/><meshStandardMaterial color="#d8faff" metalness={.62} roughness={.22}/></mesh>
    <mesh position={[0,.72,.265]} castShadow><boxGeometry args={[.38,.25,.1]}/><meshStandardMaterial color="#304b79" metalness={.65} roughness={.24}/></mesh>
    <mesh position={[0,1.12,.06]} castShadow><sphereGeometry args={[.27,24,18]}/><meshStandardMaterial color="#111b38" metalness={.72} roughness={.17}/></mesh>
    <mesh position={[0,1.13,.31]}><boxGeometry args={[.29,.085,.04]}/><meshBasicMaterial color="#00eaff"/></mesh>
    <mesh position={[0,.25,.04]} castShadow><boxGeometry args={[.34,.22,.42]}/><meshStandardMaterial color="#16264b" metalness={.55} roughness={.35}/></mesh>
    {[-1,1].map((s,i)=><group key={s} ref={el=>arms.current[i]=el} position={[s*.4,.87,0]}><mesh position={[0,-.22,0]} rotation={[0,0,-s*.1]} castShadow><capsuleGeometry args={[.105,.34,4,8]}/><meshStandardMaterial color="#7e8cff" metalness={.55}/></mesh><mesh position={[0,-.46,.03]} castShadow><sphereGeometry args={[.12,12,10]}/><meshStandardMaterial color="#26375e" metalness={.65}/></mesh></group>)}
  </>;
}

function PlayerMesh({ group, velocity, shieldUntil }) {
  const visual=useRef(), arms=useRef([]), shield=useRef();
  useFrame(({clock})=>{const gait=clock.elapsedTime*10,moving=velocity.current.lengthSq()>.1,protectedNow=performance.now()/1000<shieldUntil.current;if(visual.current)visual.current.position.y=0;arms.current.forEach((arm,i)=>{if(arm)arm.rotation.x=moving?Math.sin(gait+i*Math.PI)*.42:0;});if(shield.current){shield.current.visible=protectedNow;if(protectedNow)shield.current.material.opacity=.09+Math.sin(clock.elapsedTime*8)*.035;}});
  const fallback=<ProceduralPlayer arms={arms}/>;
  return <group ref={group}><mesh rotation={[-Math.PI/2,0,0]} position={[0,.012,0]}><circleGeometry args={[.3,32]}/><meshBasicMaterial color="#00030c" transparent opacity={.42} depthWrite={false}/></mesh><group ref={visual}><ModelBoundary fallback={fallback}><Suspense fallback={fallback}><ImportedModel url="/models/player.glb" position={[0,.5,0]} materialColor="#8cf4ff" emissiveColor="#126a82" emissiveIntensity={.8}/></Suspense></ModelBoundary><mesh ref={shield} visible={false} position={[0,.65,0]}><sphereGeometry args={[.91,24,18]}/><meshBasicMaterial color="#66f5ff" transparent opacity={.11} depthWrite={false} side={THREE.DoubleSide}/></mesh></group></group>;
}

function Drone({ index, position, dead, positionsRef, boss }) {
  const ref = useRef();
  useFrame(({clock})=>{if(ref.current&&!dead){const p=positionsRef.current[index];if(p){ref.current.position.x=p.x;ref.current.position.z=p.z;}ref.current.position.y=position[1]+Math.sin(clock.elapsedTime*2+index)*.12;}});
  if (dead) return null;
  const fallback=<mesh castShadow><icosahedronGeometry args={[.42,1]}/><meshStandardMaterial color={boss?'#ffb347':'#ff477e'} emissive={boss?'#ff4b18':'#ff174d'} emissiveIntensity={boss?2:1.4}/></mesh>;
  return <group ref={ref} position={position}><ModelBoundary fallback={fallback}><Suspense fallback={fallback}><ImportedModel url="/models/drone.glb" materialColor={boss?'#ffbd52':'#ff547f'} emissiveColor={boss?'#9d3c11':'#82123d'} emissiveIntensity={boss?1.05:.7}/></Suspense></ModelBoundary></group>;
}

function Arena({collected, deadDrones, portalOpen, crystals, portalPosition, obstacles, drones, enemyPositions, final}) {
  return <>
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.08,0]} receiveShadow><planeGeometry args={[16,14,1,1]}/><meshStandardMaterial color="#0b1430" metalness={.45} roughness={.48}/></mesh>
    <gridHelper args={[16,32,'#174a70','#12213e']} position={[0,-.045,0]}/>
    {[0,1,2].map(i=><mesh key={`circuit-${i}`} rotation={[-Math.PI/2,0,0]} position={[0,-.035+i*.002,0]}><ringGeometry args={[2.3+i*.55,2.32+i*.55,64]}/><meshBasicMaterial color={i===1?'#612aff':'#087c9f'} transparent opacity={.42} side={THREE.DoubleSide}/></mesh>)}
    {[[0,.35,-6.8,16,.7,.25],[0,.35,6.8,16,.7,.25],[-7.8,.35,0,.25,.7,13.6],[7.8,.35,0,.25,.7,13.6]].map((a,i)=><mesh key={i} position={a.slice(0,3)}><boxGeometry args={a.slice(3)}/><meshStandardMaterial color="#1b2a51" emissive="#123e72" emissiveIntensity={.7}/></mesh>)}
    {obstacles.map(([x,z,r],i)=><group key={i} position={[x,.65,z]}><mesh castShadow receiveShadow><cylinderGeometry args={[r*.72,r,1.3,8]}/><meshStandardMaterial color={i>=3?'#20254c':'#121e3b'} metalness={.6} roughness={.3}/></mesh><mesh position={[0,.2,0]}><torusGeometry args={[r*.8,.035,6,16]}/><meshBasicMaterial color={final?'#ff6b3d':'#a342ff'}/></mesh></group>)}
    {crystals.map((p,i)=><MemoCrystal key={i} position={p} index={i} collected={collected.includes(i)}/>)}
    {drones.map((p,i)=><Drone key={i} position={p} index={i} positionsRef={enemyPositions} dead={deadDrones.includes(i)} boss={final&&i===drones.length-1}/>)}
    <group position={[portalPosition[0],0,portalPosition[1]]}><mesh position={[0,.06,0]}><cylinderGeometry args={[1.05,1.05,.14,40]}/><meshStandardMaterial color="#163e52" emissive={portalOpen?'#00f0c8':'#6b2345'} emissiveIntensity={1.3}/></mesh><mesh position={[0,1,0]} rotation={[0,0,Math.PI/2]}><torusGeometry args={[.82,.075,12,40]}/><meshBasicMaterial color={portalOpen?'#00ffd0':'#ff477e'}/></mesh><mesh position={[0,1,0]}><circleGeometry args={[.72,40]}/><meshBasicMaterial color={portalOpen?'#00bdaa':'#641634'} transparent opacity={portalOpen?.2:.12} side={THREE.DoubleSide}/></mesh><pointLight color={portalOpen?'#00ffd0':'#ff477e'} intensity={1.6} distance={5}/></group>
  </>;
}

function World({gameState, collected, onCollect, onDamage, deadDrones, onDronePulse, onWin, resetToken, mobileDir, dashSignal, pulseSignal, onDashReady, onPulse, missionIndex}) {
  const mission=useMemo(()=>createMission(missionIndex),[missionIndex]);
  const player=useRef(), pulseVisual=useRef(), velocity=useRef(new THREE.Vector3()), keys=useRef({}), lastDamage=useRef(-10), spawnGrace=useRef(performance.now()/1000+10), hasMoved=useRef(false), dashUntil=useRef(0), dashReady=useRef(0), pulseReady=useRef(0), enemyPositions=useRef(mission.drones.map(p=>new THREE.Vector3(...p))), pulseFx=useRef(null);
  const collectedRef=useRef(collected), deadRef=useRef(deadDrones); collectedRef.current=collected; deadRef.current=deadDrones;
  const cameraTarget=useRef(new THREE.Vector3()), cameraYaw=useRef(.68), cameraPitch=useRef(.55), drag=useRef(null);
  const {gl}=useThree();
  useEffect(()=>{const canvas=gl.domElement; const down=e=>{drag.current={id:e.pointerId,x:e.clientX,y:e.clientY};canvas.setPointerCapture?.(e.pointerId);};const move=e=>{if(!drag.current||drag.current.id!==e.pointerId)return;const dx=e.clientX-drag.current.x,dy=e.clientY-drag.current.y;drag.current.x=e.clientX;drag.current.y=e.clientY;cameraYaw.current-=dx*.005;cameraPitch.current=clamp(cameraPitch.current-dy*.004,.18,1.08);};const up=()=>{drag.current=null;};canvas.addEventListener('pointerdown',down);canvas.addEventListener('pointermove',move);canvas.addEventListener('pointerup',up);canvas.addEventListener('pointercancel',up);return()=>{canvas.removeEventListener('pointerdown',down);canvas.removeEventListener('pointermove',move);canvas.removeEventListener('pointerup',up);canvas.removeEventListener('pointercancel',up);};},[gl]);
  useEffect(()=>{const down=e=>{const k=e.key.toLowerCase(); if(['arrowup','arrowdown','arrowleft','arrowright',' '].includes(k))e.preventDefault(); keys.current[k]=true;}; const up=e=>{keys.current[e.key.toLowerCase()]=false;}; const blur=()=>{keys.current={};}; window.addEventListener('keydown',down);window.addEventListener('keyup',up);window.addEventListener('blur',blur);return()=>{window.removeEventListener('keydown',down);window.removeEventListener('keyup',up);window.removeEventListener('blur',blur);};},[]);
  useEffect(()=>{if(gameState!=='playing')keys.current={};},[gameState]);
  useEffect(()=>{if(player.current){player.current.position.copy(START);velocity.current.set(0,0,0);lastDamage.current=-10;spawnGrace.current=performance.now()/1000+10;hasMoved.current=false;dashReady.current=0;pulseReady.current=0;enemyPositions.current=mission.drones.map(p=>new THREE.Vector3(...p));}},[resetToken,mission]);
  const actionPulse=useCallback(()=>{const now=performance.now()/1000;if(now<pulseReady.current||gameState!=='playing')return;pulseReady.current=now+1.1;onPulse(); if(player.current){pulseFx.current={until:now+.32}; for(let i=0;i<mission.drones.length;i++){if(!deadRef.current.includes(i)&&enemyPositions.current[i].distanceTo(player.current.position)<3.1)onDronePulse(i);}}},[gameState,onDronePulse,onPulse,mission]);
  useEffect(()=>{if(pulseSignal)actionPulse();},[pulseSignal,actionPulse]);
  useEffect(()=>{if(!dashSignal||gameState!=='playing')return;const now=performance.now()/1000;if(now<dashReady.current)return;dashReady.current=now+2.3;dashUntil.current=now+.22;onDashReady(false);setTimeout(()=>onDashReady(true),2300);if(player.current&&velocity.current.lengthSq()<.1)velocity.current.set(0,0,-1);if(player.current)velocity.current.normalize().multiplyScalar(12);},[dashSignal,gameState,onDashReady]);
  useFrame(({camera,clock},dt)=>{
    const t=clamp(dt,0,.04), now=clock.elapsedTime;
    if(gameState==='playing'&&player.current){const p=player.current.position,k=keys.current;let dx=(k.d||k.arrowright?1:0)-(k.a||k.arrowleft?1:0)+(mobileDir.x||0), dz=(k.s||k.arrowdown?1:0)-(k.w||k.arrowup?1:0)+(mobileDir.y||0); const len=Math.hypot(dx,dz);if(len>1){dx/=len;dz/=len;} if(len>.05)hasMoved.current=true;
      if(now>=dashUntil.current){const desired=new THREE.Vector3(dx,0,dz).multiplyScalar(k.shift?6.7:5.1);velocity.current.lerp(desired,Math.min(1,t*9));}
      const nx=clamp(p.x+velocity.current.x*t,-7.15,7.15),nz=clamp(p.z+velocity.current.z*t,-6.15,6.15);
      let safe=true;for(const [ox,oz,r] of mission.obstacles)if(Math.hypot(nx-ox,nz-oz)<r+.34)safe=false;if(safe){p.x=nx;p.z=nz;}else velocity.current.multiplyScalar(.15);
      if(velocity.current.lengthSq()>.1)player.current.rotation.y=Math.atan2(velocity.current.x,velocity.current.z);
      mission.crystals.forEach((c,i)=>{if(!collectedRef.current.includes(i)&&Math.hypot(p.x-c[0],p.z-c[2])<.9)onCollect(i);});
      enemyPositions.current.forEach((ep,i)=>{if(deadRef.current.includes(i))return;const base=mission.drones[i],dist=ep.distanceTo(p),alerted=dist<3.65;const target=alerted?new THREE.Vector3(p.x,.65,p.z):new THREE.Vector3(base[0]+Math.sin(now*.7+i)*1.1,.65,base[2]+Math.cos(now*.55+i)*.9);ep.lerp(target,Math.min(1,t*(alerted?Math.min(1.8,1.4+missionIndex*.004):.7)));const damageCooldown=mission.final?1.4:Math.max(1.8,2.1-Math.floor(missionIndex/30)*.1);if(hasMoved.current&&dist<.88&&performance.now()/1000>spawnGrace.current&&now-lastDamage.current>damageCooldown){lastDamage.current=now;onDamage();}});
      if(isPortalUnlocked(collectedRef.current.length,mission.crystals.length)&&Math.hypot(p.x-mission.portal[0],p.z-mission.portal[1])<2.0)onWin();
    }
    if(player.current){const p=player.current.position,radius=15.5,horizontal=radius*Math.cos(cameraPitch.current);cameraTarget.current.set(p.x+Math.sin(cameraYaw.current)*horizontal,p.y+radius*Math.sin(cameraPitch.current),p.z+Math.cos(cameraYaw.current)*horizontal);camera.position.lerp(cameraTarget.current,.09);camera.lookAt(p.x,.65,p.z);}
    const pulseNow=performance.now()/1000;if(pulseFx.current&&pulseNow<pulseFx.current.until&&pulseVisual.current&&player.current){pulseVisual.current.visible=true;pulseVisual.current.position.copy(player.current.position);pulseVisual.current.position.y=.06;const progress=1-(pulseFx.current.until-pulseNow)/.32;pulseVisual.current.scale.setScalar(.3+progress*3);pulseVisual.current.children[0].material.opacity=1-progress;}else {if(pulseVisual.current)pulseVisual.current.visible=false;pulseFx.current=null;}
  });
  return <><color attach="background" args={['#070b17']}/><fog attach="fog" args={['#070b17',17,32]}/><ambientLight intensity={.62}/><hemisphereLight args={['#81cfff','#120b2e',.55]}/><directionalLight position={[4,10,5]} intensity={1.7} castShadow shadow-mapSize-width={1536} shadow-mapSize-height={1536}/><pointLight position={[-5,4,-3]} color="#4b4dff" intensity={1.3} distance={12}/><Stars radius={60} depth={35} count={650} factor={3} saturation={.4} fade speed={.5}/><Arena collected={collected} deadDrones={deadDrones} portalOpen={collected.length>=TOTAL} crystals={mission.crystals} portalPosition={mission.portal} obstacles={mission.obstacles} drones={mission.drones} enemyPositions={enemyPositions} final={mission.final}/><PlayerMesh group={player} velocity={velocity} shieldUntil={spawnGrace}/><group ref={pulseVisual} visible={false}><mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[.92,1,48]}/><meshBasicMaterial color="#4ceeff" transparent opacity={1} side={THREE.DoubleSide}/></mesh></group></>;
}

export default function App(){
  const [gameState,setGameState]=useState('menu'),[missionIndex,setMissionIndex]=useState(1),[collected,setCollected]=useState([]),[health,setHealth]=useState(5),[bossHealth,setBossHealth]=useState(3),[deadDrones,setDeadDrones]=useState([]),[elapsed,setElapsed]=useState(0),[score,setScore]=useState(0),[best,setBest]=useState(0),[resetToken,setResetToken]=useState(0),[showHelp,setShowHelp]=useState(false),[muted,setMuted]=useState(false),[dashSignal,setDashSignal]=useState(0),[pulseSignal,setPulseSignal]=useState(0),[dashReady,setDashReady]=useState(true),[mobileDir,setMobileDir]=useState({x:0,y:0});
  const audio=useRef(null),collectedLive=useRef([]);
  const tone=useCallback((freq=600,duration=.12,type='sine')=>{if(muted)return;try{const Ctx=window.AudioContext||window.webkitAudioContext;audio.current??=new Ctx();if(audio.current.state==='suspended')audio.current.resume();const o=audio.current.createOscillator(),g=audio.current.createGain();o.type=type;o.frequency.value=freq;g.gain.setValueAtTime(.12,audio.current.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.current.currentTime+duration);o.connect(g);g.connect(audio.current.destination);o.start();o.stop(audio.current.currentTime+duration);}catch{}},[muted]);
  const collect=useCallback(i=>{const next=addCrystalOnce(collectedLive.current,i);if(next===collectedLive.current)return;collectedLive.current=next;setCollected(next);setScore(s=>s+100);tone(880,.18,'triangle');},[tone]);
  const damage=useCallback(()=>{setHealth(h=>{tone(150,.2,'sawtooth');return Math.max(0,h-1);});},[tone]);
  const win=useCallback(()=>setGameState(s=>s==='playing'?'victory':s),[]);
  const downDrone=useCallback(i=>setDeadDrones(old=>{if(old.includes(i))return old;tone(440,.2,'square');setScore(s=>s+250);return [...old,i];}),[tone]);
  const onDronePulse=useCallback(i=>{const bossIndex=Math.min(12,3+Math.floor((missionIndex-1)/8))-1;if(missionIndex===100&&i===bossIndex){if(bossHealth<=1){setBossHealth(0);tone(760,.28,'sawtooth');downDrone(i);}else{setBossHealth(h=>h-1);tone(520,.14,'triangle');}}else downDrone(i);},[missionIndex,bossHealth,downDrone,tone]);
  const restart=()=>{collectedLive.current=[];setMissionIndex(1);setCollected([]);setHealth(5);setBossHealth(3);setDeadDrones([]);setElapsed(0);setScore(0);setDashReady(true);setMobileDir({x:0,y:0});setResetToken(x=>x+1);setGameState('playing');};
  const nextMission=()=>{collectedLive.current=[];setMissionIndex(n=>Math.min(100,n+1));setCollected([]);setHealth(5);setBossHealth(3);setDeadDrones([]);setElapsed(0);setDashReady(true);setMobileDir({x:0,y:0});setResetToken(x=>x+1);setGameState('playing');};
  useEffect(()=>{if(gameState!=='playing')return;const id=setInterval(()=>setElapsed(t=>t+1),1000);return()=>clearInterval(id);},[gameState]);
  useEffect(()=>{if(health<=0&&gameState==='playing')setGameState('gameover');},[health,gameState]);
  useEffect(()=>{const key=e=>{if((e.key==='Escape'||e.key.toLowerCase()==='p')&&['playing','paused'].includes(gameState))setGameState(current=>togglePauseState(current));if(gameState==='playing'&&(e.key===' '||e.key.toLowerCase()==='j')){e.preventDefault();setPulseSignal(s=>s+1);}};window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);},[gameState]);
  useEffect(()=>{if(gameState==='victory'){const next=Math.max(best,score);setBest(next);try{localStorage.setItem('neonCoreBest',String(next));}catch{}}},[gameState]);
  useEffect(()=>{try{setBest(Number(localStorage.getItem('neonCoreBest'))||0);}catch{}},[]);
  const time=`${String(Math.floor(elapsed/60)).padStart(2,'0')}:${String(elapsed%60).padStart(2,'0')}`;
  const droneCount=Math.min(12,3+Math.floor((missionIndex-1)/8));
  const missionName=missionIndex===1?'FACILITY BREACH':missionIndex===100?'CORE SINGULARITY':missionIndex%4===0?'FRACTURE SECTOR':missionIndex%3===0?'NEON CATACOMBS':'REACTOR WING';
  return <main className="app-shell"><header className="topbar"><div className="brand"><span className="brand-mark">✦</span><div><strong>NEON CORE</strong><small>CRYSTAL RUN / SECTOR 7G</small></div></div><div className="top-actions"><span className="live-dot">● SYSTEM {gameState==='playing'?'ONLINE':'STANDBY'}</span><button className="ghost-button" onClick={()=>setShowHelp(v=>!v)}>HOW TO PLAY</button><button className="ghost-button" onClick={()=>setMuted(v=>!v)}>{muted?'SOUND OFF':'SOUND ON'}</button></div></header>
    <section className="game-layout"><aside className="side-panel"><p className="eyebrow">MISSION {String(missionIndex).padStart(2,'0')} / {missionName}</p><h1>Crystal<br/><span>Run.</span></h1><p className="intro">{missionIndex===100?'Final protocol: disable the elite, claim all 10 cores, and breach the singularity gate.':'Recover the energy cores. Survive security. Reach the exit portal.'}</p>
      <div className="progress-head"><span>CRYSTALS</span><strong>{collected.length}<i> / 10</i></strong></div><div className="progress-track"><div style={{width:`${collected.length*10}%`}}/></div>
      <div className="stat-grid"><div><small>VITALITY</small><strong className="health-read">{'◆ '.repeat(health)}{'◇ '.repeat(5-health)}</strong></div><div><small>SCORE / TIME</small><strong>{score}<i> · {time}</i></strong></div></div>
      <div className="stat-grid"><div><small>DRONES DISABLED</small><strong>{deadDrones.length} / {droneCount}</strong></div><div><small>BEST SCORE</small><strong>{best}</strong></div></div>
      {missionIndex===100&&<div className="boss-status"><span>ELITE SHIELD <b>{bossHealth}/3</b></span><div><i style={{width:`${bossHealth/3*100}%`}}/></div><small>Pulse the amber sentinel three times.</small></div>}
      <p className="shield-note">10 SECOND DEPLOYMENT SHIELD · CONTACT DAMAGE: MEDIUM</p>
      <div className="objective"><span className="objective-icon">◎</span><div><strong>PRIMARY OBJECTIVE</strong><p>{collected.length===TOTAL?'PORTAL OPEN: move into the center of the glowing ring to transit.':'Collect all 10 crystals, then move into the center of the exit ring.'}</p></div></div>
      <div className="ability-row"><button className={`secondary-button ${dashReady?'ready':''}`} onClick={()=>setDashSignal(s=>s+1)}>SHIFT · DASH {dashReady?'READY':'COOLDOWN'}</button><button className="secondary-button" onClick={()=>setPulseSignal(s=>s+1)}>SPACE · PULSE</button></div>
      <button className="primary-button" onClick={()=>gameState==='playing'?setGameState('paused'):restart()}>{gameState==='playing'?'Ⅱ PAUSE MISSION':'↻ RESTART MISSION'}</button>
      {showHelp&&<div className="help-card"><strong>FIELD GUIDE</strong><p>WASD / arrows move. Drag the arena to orbit the camera. Shift dashes. Space or J fires a short range pulse. P or Esc pauses. Touch controls are shown on mobile.</p></div>}
      <div className="model-note"><span className="model-dot"/><div><strong>VI3W GLB MODELS</strong><p>Explorer, drones, and pickups load from <code>public/models/</code>. Procedural fallbacks keep play running if a model fails.</p></div></div>
    </aside><section className="viewport-wrap"><div className="viewport-top"><span><span className="tiny-dot"/> LIVE SIMULATION</span><span>SECTOR 7G <b>·</b> {collected.length===TOTAL?'EXIT UNLOCKED':'EXIT LOCKED'}</span></div>
      <div className="viewport"><Canvas shadows camera={{position:[9,8,11],fov:48}} dpr={[1,1.6]}><World gameState={gameState} collected={collected} onCollect={collect} onDamage={damage} deadDrones={deadDrones} onDronePulse={onDronePulse} onWin={win} resetToken={resetToken} mobileDir={mobileDir} dashSignal={dashSignal} pulseSignal={pulseSignal} onDashReady={setDashReady} onPulse={()=>tone(320,.16,'sawtooth')} missionIndex={missionIndex}/></Canvas>
        {gameState!=='playing'&&<div className="game-overlay"><div className="win-card"><div className="win-icon">{gameState==='victory'?'✦':gameState==='gameover'?'⚠':'◈'}</div><p className="eyebrow">{gameState==='menu'?'MISSION BRIEFING':gameState==='paused'?'SIMULATION PAUSED':gameState==='victory'?`MISSION ${String(missionIndex).padStart(2,'0')} CLEAR`:gameState==='gameover'?'SIGNAL LOST':'MISSION BRIEFING'}</p><h2>{gameState==='victory'?(missionIndex===100?'Singularity contained.':'Portal transit ready.'):gameState==='gameover'?'Explorer down.':gameState==='paused'?'Take a breath.':'Crystal Run'}</h2><p>{gameState==='victory'?(missionIndex===100?`You cleared all 100 missions. Final score: ${score}.`:`Portal reached. Proceed to Mission ${String(missionIndex+1).padStart(2,'0')}.`):gameState==='gameover'?'Vital signs critical. Restart the mission and try another route.':gameState==='paused'?'The arena is frozen. Resume when ready.':'Collect 10 crystals, fend off security drones, and reach the portal.'}</p>{gameState==='paused'?<button className="primary-button" onClick={()=>setGameState('playing')}>RESUME</button>:gameState==='victory'&&missionIndex<100?<button className="primary-button" onClick={nextMission}>ENTER MISSION {String(missionIndex+1).padStart(2,'0')}</button>:<button className="primary-button" onClick={restart}>{gameState==='menu'?'START MISSION':gameState==='victory'?'PLAY AGAIN':gameState==='gameover'?'RESTART MISSION':'BEGIN'}</button>}</div></div>}
        <div className="mobile-controls" onContextMenu={e=>e.preventDefault()}><div className="dpad"><button onTouchStart={e=>{e.preventDefault();setMobileDir(v=>({...v,y:-1}));}} onTouchEnd={()=>setMobileDir(v=>({...v,y:0}))}>▲</button><div><button onTouchStart={e=>{e.preventDefault();setMobileDir(v=>({...v,x:-1}));}} onTouchEnd={()=>setMobileDir(v=>({...v,x:0}))}>◀</button><button onTouchStart={e=>{e.preventDefault();setMobileDir(v=>({...v,x:1}));}} onTouchEnd={()=>setMobileDir(v=>({...v,x:0}))}>▶</button></div><button onTouchStart={e=>{e.preventDefault();setMobileDir(v=>({...v,y:1}));}} onTouchEnd={()=>setMobileDir(v=>({...v,y:0}))}>▼</button></div><div className="mobile-actions"><button onClick={()=>setDashSignal(s=>s+1)}>DASH</button><button onClick={()=>setPulseSignal(s=>s+1)}>PULSE</button></div></div>
        <div className="viewport-bottom"><span>WASD / ARROWS · SHIFT DASH · SPACE PULSE</span><span>{time} <b>●</b></span></div>
      </div><div className="bottom-cards"><div><span className="card-icon cyan">◇</span><div><strong>COLLECT</strong><small>10 energy crystals</small></div></div><div><span className="card-icon pink">⌁</span><div><strong>SURVIVE</strong><small>Pulse or evade drones</small></div></div><div><span className="card-icon green">◎</span><div><strong>ESCAPE</strong><small>Reach the unlocked ring</small></div></div></div></section></section><footer><span>NEON CORE © 2026</span><span>BUILT WITH REACT · THREE.JS</span><span>CRYSTAL RUN / BUILD 1.0</span></footer></main>;
}
