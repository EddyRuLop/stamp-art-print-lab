import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { MAX_BYTES } from './image-core.js';
import { cmToPixels, packDtf, pixelsToCm } from './dtf-core.js';
import { downloadBlob, safeName, zipFiles } from './downloads.js';
import { demoImages } from './demo-images.js';
import { localSession } from './local-session.js';
import './style.css';

const number=(value,digits=2)=>new Intl.NumberFormat('es-MX',{maximumFractionDigits:digits}).format(value);
const tools=[
  {id:'prepare',title:'Tamaño y 300 DPI',short:'Preparar PNG',symbol:'↗',tag:'Medidas precisas',text:'Ajusta centímetros, conserva proporciones y prepara tus diseños para imprimir.',visual:'size'},
  {id:'background',title:'Quitar fondo',short:'Quitar fondo',symbol:'◐',tag:'Por color',text:'Elimina negro, blanco o el color que elijas. Controla tolerancia y bordes.',visual:'background'},
  {id:'alpha',title:'Semitransparencias',short:'Limpiar transparencias',symbol:'◒',tag:'Alfa 0 / 255',text:'Limpia bordes y sombras para obtener píxeles opacos o transparentes.',visual:'alpha'},
  {id:'vector',title:'Vectorizar SVG',short:'Vectorizar',symbol:'◇',tag:'Trazados editables',text:'Convierte logos y siluetas en trazados editables de uno o varios colores.',visual:'vector'},
  {id:'semitone',title:'Semitonos',short:'Semitonos',symbol:'◌',tag:'Trama de impresión',text:'Usa el color de la prenda para crear una trama de puntos con alfa binario.',visual:'alpha'},
  {id:'mockup',title:'Mockup de prenda',short:'Mockups',symbol:'▣',tag:'Vista previa',text:'Previsualiza tu diseño sobre una playera o una totebag.',visual:'size'},
  {id:'dtf',title:'Crear plantilla DTF',short:'Plantilla DTF',symbol:'▦',tag:'Ancho 88 cm',text:'Acomoda varios diseños automáticamente, sin escalar, separados por 1 mm.',visual:'dtf'},
];
const defaults={mode:'pixels',widthCm:30,sharpen:false,strength:35,alphaMode:'threshold',threshold:128,backgroundColor:'#ffffff',backgroundTolerance:28,backgroundFeather:0,vectorThreshold:128,vectorInvert:false,vectorColor:'#000000',vectorColors:1,frequency:35,angle:22,garment:'#000000',garmentType:'playera',garmentColor:'#282528',printSize:65};
function BlobImage({blob,...props}) {
  const [url,setUrl]=useState('');
  useEffect(()=>{if(!blob){setUrl('');return;}const u=URL.createObjectURL(blob);setUrl(u);return()=>URL.revokeObjectURL(u);},[blob]);
  return url?<img src={url} {...props}/>:null;
}
function Field({label,hint,children}){return <label className="field"><span>{label}</span>{children}{hint&&<small>{hint}</small>}</label>;}
function Slider({label,value,min=0,max=255,onChange,disabled}){return <Field label={<>{label}<b>{value}</b></>}><input type="range" min={min} max={max} value={value} disabled={disabled} onChange={e=>onChange(Number(e.target.value))}/></Field>;}

function App(){
  const [tool,setTool]=useState('home'),[assets,setAssets]=useState([]),[settings,setSettings]=useState(defaults);
  const [busy,setBusy]=useState(false),[stage,setStage]=useState(''),[progress,setProgress]=useState(0),[error,setError]=useState('');
  const [results,setResults]=useState([]),[dtf,setDtf]=useState({widthCm:88,gapMm:1,marginMm:1,maxHeightCm:0}),[sheet,setSheet]=useState(null),[viewBg,setViewBg]=useState('checker');
  const [positions,setPositions]=useState({}),[pieceKey,setPieceKey]=useState('');
  const input=useRef(null),task=useRef(null),session=useRef(0);
  useEffect(()=>()=>task.current?.worker.terminate(),[]);
  const selected=assets.filter(a=>a.selected),current=tools.find(t=>t.id===tool);
  function workerJob(job,isDtf=false,onProgress=()=>{}){
    return new Promise((resolve,reject)=>{
      const worker=isDtf?new Worker(new URL('./dtf.worker.js',import.meta.url),{type:'module'}):new Worker(new URL('./image.worker.js',import.meta.url),{type:'module'});
      task.current={worker,reject};
      const finish=()=>{worker.terminate();if(task.current?.worker===worker)task.current=null;};
      worker.onmessage=({data})=>{if(data.type==='progress')onProgress(data);else if(data.type==='done'){finish();resolve(data);}else if(data.type==='error'){finish();reject(new Error(data.message));}};
      worker.onerror=()=>{finish();reject(new Error('El navegador no pudo procesar esta imagen. Prueba con un lote más pequeño.'));};
      worker.postMessage(job);
    });
  }
  function cancel(){session.current++;const t=task.current;if(t){t.worker.terminate();const e=new Error('Cancelado');e.name='AbortError';t.reject(e);task.current=null;}setBusy(false);setStage('Proceso cancelado. Tus archivos cargados se conservan.');setProgress(0);}
  async function upload(files, { replaceSelection = false } = {}){
    if(input.current)input.current.value='';
    if(busy||task.current)return;const list=Array.from(files||[]);if(!list.length)return;
    if(list.length+assets.length>100){setError('Puedes cargar hasta 100 archivos por sesión.');return;}
    const id=++session.current;setBusy(true);setError('');setProgress(0);setSheet(null);const failures=[];let loaded=0;
    for(let index=0;index<list.length;index++){
      const file=list[index];setStage(`Cargando ${index+1} de ${list.length}: ${file.name}`);
      try{
        if(file.size>MAX_BYTES)throw new Error('Supera el límite de 200 MB por archivo.');
        const data=await workerJob({type:'inspect',file},false,d=>setProgress(Math.round((index+d.value/100)/list.length*100)));
        if(session.current!==id)return;
        const firstLoaded = loaded++ === 0;
        if(firstLoaded)resetPositions();
        const clearSelection = replaceSelection && firstLoaded;
        setAssets(previous=>[...(clearSelection ? previous.map(item=>({...item,selected:false})) : previous),{id:crypto.randomUUID(),file,name:file.name,info:data.info,thumbnail:data.thumbnail,selected:true,copies:1}]);
      }catch(e){if(e.name==='AbortError'||session.current!==id)return;failures.push(`${file.name}: ${e.message}`);}
    }
    if(session.current===id){setBusy(false);setProgress(100);setStage(`${list.length-failures.length} archivos cargados.`);if(failures.length)setError(failures.join('\n'));}
    return list.length-failures.length;
  }

  async function tryExamples(){
    try {
      await upload(await demoImages());
    } catch (e) {
      setError(e.message);
    }
  }

  async function manageSession(mode){
    if(busy)return;
    setBusy(true);
    setError('');
    setStage('Abriendo el almacenamiento local…');
    try {
      if (mode === 'save') {
        await localSession('save', {assets, settings, dtf, positions});
        setStage('Sesión guardada en este navegador.');
      } else if (mode === 'clear') {
        await localSession('clear');
        setStage('Sesión guardada eliminada de este navegador.');
      } else {
        const saved = await localSession('load');
        if (!saved) { setStage('Aún no tienes una sesión guardada.'); return; }
        if (assets.length) {
          setStage('Vacía la biblioteca actual antes de recuperar una sesión.');
          return;
        }
        setAssets(saved.assets);
        setSettings({...defaults,...saved.settings});
        setDtf(saved.dtf);
        setPositions(saved.positions??{});
        setPieceKey('');
        setSheet(null);
        setResults([]);
        setStage('Sesión recuperada.');
      }
    } catch {
      setError('El navegador no pudo acceder al almacenamiento local. Revisa el espacio disponible y los permisos.');
    } finally {
      setBusy(false);
    }
  }
  function change(patch){setSettings(s=>({...s,...patch}));setResults([]);setError('');}
  function resetPositions(){
    setPositions({});
    setPieceKey('');
    setSheet(null);
  }
  function changeDtf(patch){resetPositions();setDtf(s=>({...s,...patch}));setSheet(null);setError('');}
  function updateAsset(id,patch){resetPositions();setAssets(previous=>previous.map(a=>a.id===id?{...a,...patch}:a));setSheet(null);setResults([]);}
  function navigate(next){if(busy)return;setTool(next);setResults([]);setError('');setStage('');}
  let layout=null,baseLayout=null,layoutError='';
  const pieces = selected.map(a=>({id:a.id,name:a.name,width:a.info.width,height:a.info.height,copies:a.copies}));
  if(tool==='dtf'&&selected.length){
    try{
      baseLayout=packDtf(pieces,dtf);
      layout=Object.keys(positions).length ? packDtf(pieces,{...dtf,positions}) : baseLayout;
    }catch(e){layoutError=e.message;}
  }
  const basePiece=baseLayout?.placements.find(p=>`${p.id}:${p.copy}`===pieceKey);
  const editedPiece=basePiece ? {...basePiece,...positions[pieceKey]} : null;
  function movePiece(axis,value){
    if(!editedPiece||value==='')return;
    const coordinate=cmToPixels(Number(value));
    setPositions(previous=>({...previous,[pieceKey]:{x:editedPiece.x,y:editedPiece.y,[axis]:coordinate}}));
    setSheet(null);
  }
  async function processBatch(){
    if(!selected.length||busy)return;const id=++session.current;setBusy(true);setError('');setResults([]);setProgress(0);const failures=[];
    for(let index=0;index<selected.length;index++){
      const asset=selected[index];setStage(`${index+1} de ${selected.length}: ${asset.name}`);
      try{
        const options=tool==='vector'?{threshold:settings.vectorThreshold,invert:settings.vectorInvert,color:settings.vectorColor,colors:settings.vectorColors}:{...settings,widthCm:Number(settings.widthCm),mode:tool==='prepare'?settings.mode:'pixels',sharpen:tool==='prepare'&&settings.sharpen,backgroundMode:tool==='background'?'color':'none',alphaMode:['prepare','semitone'].includes(tool)?'keep':settings.alphaMode};
        const data=await workerJob({type:['vector','mockup','semitone'].includes(tool)?tool:'process',file:asset.file,options},false,d=>{setProgress(Math.round((index+d.value/100)/selected.length*100));setStage(`${index+1}/${selected.length} · ${d.message}`);});
        if(session.current!==id)return;
        const blob=tool==='vector'?new Blob([data.svg],{type:'image/svg+xml'}):data.blob;
        const name=`${String(index+1).padStart(2,'0')}-${safeName(asset.name)}-${tool==='vector'?'vector.svg':tool==='mockup'?'mockup.png':tool+'-300dpi.png'}`;
        setResults(previous=>[...previous,{id:crypto.randomUUID(),source:asset,name,blob,thumbnail:data.thumbnail,info:data.info,contours:data.contours,colors:data.colors}]);
      }catch(e){if(e.name==='AbortError'||session.current!==id)return;failures.push(`${asset.name}: ${e.message}`);}
    }
    if(session.current===id){setBusy(false);setProgress(100);setStage(failures.length===selected.length?'No se generaron resultados.': 'Proceso terminado. Los resultados están listos para revisar.');if(failures.length)setError(failures.join('\n'));}
  }
  async function buildSheet(){
    if(!layout||busy)return;const id=++session.current;setBusy(true);setError('');setSheet(null);setProgress(0);
    try{
      const data=await workerJob({items:selected.map(a=>({id:a.id,name:a.name,file:a.file,width:a.info.width,height:a.info.height,copies:a.copies})),options:{...dtf,positions}},true,d=>{setStage(d.message);setProgress(d.value);});
      if(session.current!==id)return;setSheet(data);setStage('Plantilla DTF lista para descargar.');
    }catch(e){if(e.name!=='AbortError'&&session.current===id)setError(e.message);}
    finally{if(session.current===id)setBusy(false);}
  }
  async function downloadZip(){if(!results.length||busy)return;setBusy(true);setStage('Creando ZIP…');try{downloadBlob(await zipFiles(results),'stamp-art-'+tool+'.zip');setStage('ZIP listo.');}catch(e){setError(e.message);}finally{setBusy(false);}}
  async function reuse(){
    if(busy)return;
    const files=results.filter(r=>r.info).map(r=>new File([r.blob],r.name,{type:'image/png'}));
    if(!files.length)return;
    if(await upload(files,{replaceSelection:true})){
      setTool('dtf');
      setResults([]);
    }
  }
  const slider=(label,key,max=255,min=0)=><Slider label={label} value={settings[key]} min={min} max={max} disabled={busy} onChange={v=>change({[key]:v})}/>;
  const dtfMismatch=tool==='dtf'&&selected.some(a=>a.info.inputDpi&&Math.abs(a.info.inputDpi-300)>1);
  return <div className="app-shell">
    <header className="app-header"><button className="brand" onClick={()=>navigate('home')} disabled={busy}><span className="brand-logo">SA<span>✳</span></span><span>Stamp Art<small>PRINT LAB</small></span></button><div className="header-actions"><span className="private-pill"><i/>Archivos en tu dispositivo</span><a href="https://github.com/EddyRuLop/stamp-art-print-lab" target="_blank" rel="noreferrer">GitHub ↗</a></div></header>
    <div className="app-body"><aside className="sidebar"><div className="sidebar-label">TU TALLER</div><button className={tool==='home'?'nav-link active':'nav-link'} onClick={()=>navigate('home')} disabled={busy}><span>⌂</span> Todas las herramientas</button>{tools.map(t=><button key={t.id} className={`nav-link ${tool===t.id?'active':''}`} onClick={()=>navigate(t.id)} disabled={busy}><span>{t.symbol}</span>{t.short}</button>)}<div className="sidebar-bottom"><span className="version-badge">PRINT LAB · V2.1</span><p>Carga tus diseños una vez.<br/>Úsalos en cada herramienta.</p></div></aside>
    <main className="content" onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault();upload(e.dataTransfer.files);}}>
      <input ref={input} className="visually-hidden" type="file" multiple accept="image/png,image/jpeg,image/webp" onChange={e=>upload(e.target.files)} aria-label="Cargar varias imágenes" disabled={busy}/>
      {tool==='home'?<><div className="page-intro"><div><span className="eyebrow">HECHO PARA STAMP ART</span><h1>Tu taller de archivos DTF.</h1><p>Elige una herramienta. Carga uno o varios diseños y prepara tu siguiente impresión.</p></div><div className="intro-actions"><button className="secondary" disabled={busy} onClick={tryExamples}>Cargar diseños de muestra</button><button className="primary" disabled={busy} onClick={()=>input.current?.click()}>＋ Cargar imágenes</button></div></div><div className="tool-grid">{tools.map(t=><button key={t.id} className="tool-card" disabled={busy} onClick={()=>navigate(t.id)}><div className={`tool-art art-${t.visual}`}><span className="tool-tag">{t.tag}</span><div className="art-scene"><div className="art-design">SA<span>PRINT<br/>YOUR<br/>IDEAS</span></div><div className="art-secondary"/><span className="art-symbol">{t.symbol}</span></div></div><div className="tool-card-content"><h2>{t.title}</h2><p>{t.text}</p><span className="card-action">Abrir herramienta <b>↗</b></span></div></button>)}</div></>:<><div className="breadcrumb"><button disabled={busy} onClick={()=>navigate('home')}>Herramientas</button><span>/</span>{current?.title}</div><div className="page-intro tool-intro"><div><span className="eyebrow">{current?.tag}</span><h1>{current?.title}</h1><p>{current?.text}</p></div><button className="secondary" disabled={busy} onClick={()=>input.current?.click()}>＋ Agregar imágenes</button></div></>}
      {error&&<div className="notice error" role="alert"><span>!</span><p>{error}</p><button onClick={()=>setError('')} aria-label="Cerrar error">×</button></div>}
      {busy&&<div className="progress-panel" role="status" aria-live="polite"><div><span className="spinner"/><strong>{stage}</strong>{task.current&&<button onClick={cancel}>Cancelar</button>}</div><progress value={progress} max="100"/><small>{progress}% · Procesando en tu dispositivo</small></div>}
      <div className={tool==='home'?'home-library':'tool-workspace'}>
        <section className="library-panel"><div className="panel-heading"><div><h2>Mis diseños <span>{assets.length}</span></h2><p>{assets.length?`${selected.length} seleccionados · Se comparten entre herramientas`:'PNG, JPG y WebP · Hasta 200 MB por archivo'}</p></div><div className="library-actions">{assets.length>0&&<><button disabled={busy} onClick={()=>{resetPositions();setAssets(a=>a.map(item=>({...item,selected:!a.every(x=>x.selected)})));setSheet(null);setResults([]);}}>{assets.every(a=>a.selected)?'Desmarcar':'Seleccionar todos'}</button><button disabled={busy} onClick={()=>{resetPositions();setAssets([]);setSheet(null);setResults([]);}}>Vaciar</button></>}<button className="small-add" disabled={busy} onClick={()=>input.current?.click()} aria-label="Agregar imágenes">＋</button></div></div>
        {!assets.length?<button className="dropzone" disabled={busy} onClick={()=>input.current?.click()}><span className="drop-icon">↑</span><strong>Arrastra aquí tus diseños</strong><span>O haz clic para seleccionar varias imágenes</span><small>200 MB / archivo · Hasta 100 MP · PNG, JPG, WebP</small></button>:<div className="asset-grid">{assets.map(asset=><article key={asset.id} className={`asset-card ${asset.selected?'selected':''}`}><div className="asset-preview checker"><BlobImage blob={asset.thumbnail} alt={asset.name}/><input type="checkbox" checked={asset.selected} disabled={busy} onChange={e=>updateAsset(asset.id,{selected:e.target.checked})} aria-label={`Seleccionar ${asset.name}`}/><button className="remove-asset" disabled={busy} onClick={()=>{resetPositions();setAssets(a=>a.filter(x=>x.id!==asset.id));setSheet(null);setResults([]);}} aria-label={`Quitar ${asset.name}`}>×</button></div><div className="asset-details"><strong title={asset.name}>{asset.name}</strong><span>{number(asset.info.width,0)} × {number(asset.info.height,0)} px · {number(asset.file.size/1048576,1)} MB</span><small>{number(pixelsToCm(asset.info.width))} × {number(pixelsToCm(asset.info.height))} cm a 300 DPI</small>{tool==='dtf'&&<label className="copies">Cantidad<input type="number" min="1" max="100" value={asset.copies} disabled={busy} onChange={e=>updateAsset(asset.id,{copies:Number(e.target.value)})}/></label>}</div></article>)}</div>}
        <div className="session-actions">
          <button disabled={busy||!assets.length} onClick={()=>manageSession('save')}>Guardar sesión en este navegador</button>
          <button disabled={busy} onClick={()=>manageSession('load')}>Recuperar sesión</button>
          <button disabled={busy} onClick={()=>manageSession('clear')}>Borrar sesión guardada</button>
        </div>
        {assets.length>0&&<div className="library-foot">＋ Puedes añadir más archivos. Solo se procesan los seleccionados.</div>}</section>
        {tool!=='home'&&<aside className="controls-panel"><div className="panel-heading"><h2>{tool==='dtf'?'Medidas de la película':'Ajustes del lote'}</h2><span className="count-badge">{selected.length} archivos</span></div><div className="control-fields">
          {tool==='prepare'&&<><Field label="Tamaño de salida"><select value={settings.mode} disabled={busy} onChange={e=>change({mode:e.target.value})}><option value="pixels">Conservar píxeles originales</option><option value="print">Ajustar ancho en centímetros</option></select></Field>{settings.mode==='print'&&<Field label="Ancho de cada diseño" hint="La altura se calcula proporcionalmente para cada imagen."><div className="input-unit"><input type="number" min="0.1" max="500" step="0.1" value={settings.widthCm} disabled={busy} onChange={e=>change({widthCm:e.target.value})}/><span>cm</span></div></Field>}<div className="fixed-value"><span>Resolución de salida</span><b>300 DPI</b></div><label className="check-field"><input type="checkbox" checked={settings.sharpen} disabled={busy} onChange={e=>change({sharpen:e.target.checked})}/> Aplicar nitidez</label>{settings.sharpen&&slider('Intensidad','strength',100)}<p className="hint">Cambiar DPI no recupera detalle perdido. El ajuste de tamaño solo se aplica si lo eliges.</p></>}
          {tool==='background'&&<><Field label="Color que quieres eliminar"><div className="color-input"><input type="color" value={settings.backgroundColor} disabled={busy} onChange={e=>change({backgroundColor:e.target.value})}/><span>{settings.backgroundColor.toUpperCase()}</span></div></Field><div className="presets">{[['Blanco','#ffffff'],['Negro','#000000'],['Verde','#00ff00']].map(([label,value])=><button key={value} disabled={busy} onClick={()=>change({backgroundColor:value})}>{label}</button>)}</div>{slider('Tolerancia','backgroundTolerance',180)}{slider('Suavizado del borde','backgroundFeather',80)}<p className="hint">Para fondos de color sólido. También elimina ese color dentro del dibujo: revisa el resultado. El recorte automático por IA sigue pendiente.</p></>}
          {(tool==='alpha'||tool==='background')&&<><Field label="Transparencia de salida"><select value={settings.alphaMode} disabled={busy} onChange={e=>change({alphaMode:e.target.value})}><option value="threshold">Sin semitransparencias · Umbral</option><option value="visible">Hacer opaco todo lo visible</option><option value="keep">Conservar bordes suaves</option></select></Field>{settings.alphaMode==='threshold'&&slider('Umbral de opacidad','threshold',255,1)}<div className="fixed-value"><span>Formato de salida</span><b>PNG · 300 DPI</b></div><p className="hint">El filtro se aplica a cada diseño seleccionado, conservando su número de píxeles.</p></>}
          {tool==='vector'&&<>
            <Field label="Paleta"><select value={settings.vectorColors} disabled={busy} onChange={e=>change({vectorColors:Number(e.target.value)})}><option value={1}>Silueta de un color</option><option value={2}>Hasta 2 colores</option><option value={4}>Hasta 4 colores</option><option value={8}>Hasta 8 colores</option></select></Field>
            {settings.vectorColors===1&&<>
              {slider('Umbral claro / oscuro','vectorThreshold',255,1)}
              <label className="check-field"><input type="checkbox" checked={settings.vectorInvert} disabled={busy} onChange={e=>change({vectorInvert:e.target.checked})}/> Vectorizar las zonas claras</label>
              <Field label="Color del vector"><input type="color" value={settings.vectorColor} disabled={busy} onChange={e=>change({vectorColor:e.target.value})}/></Field>
            </>}
            <p className="hint">SVG editable con huecos transparentes. Diseñado para logos y colores planos. El análisis utiliza hasta 768 px por lado.</p>
          </>}
          {tool==='semitone'&&<>
            {slider('Frecuencia (LPI)','frequency',75,15)}
            {slider('Ángulo (grados)','angle',90)}
            <Field label="Color de prenda"><input type="color" value={settings.garment} disabled={busy} onChange={e=>change({garment:e.target.value})}/></Field>
            <p className="hint">Exporta PNG a 300 DPI conservando los píxeles de origen. Haz una prueba de impresión con la malla y el tejido definitivos.</p>
          </>}
          {tool==='mockup'&&<>
            <Field label="Producto"><select value={settings.garmentType} disabled={busy} onChange={e=>change({garmentType:e.target.value})}><option value="playera">Playera</option><option value="totebag">Totebag</option></select></Field>
            <Field label="Color de prenda"><input type="color" value={settings.garmentColor} disabled={busy} onChange={e=>change({garmentColor:e.target.value})}/></Field>
            {slider('Tamaño relativo del diseño (%)','printSize',90,15)}
            <p className="hint">Vista de referencia en PNG de 900 × 800 px.</p>
          </>}
          {tool==='dtf'&&<><Field label="Ancho de película"><div className="input-unit"><input type="number" min="1" max="200" step="0.1" value={dtf.widthCm} disabled={busy} onChange={e=>changeDtf({widthCm:Number(e.target.value)})}/><span>cm</span></div></Field><div className="presets">{[58,88].map(value=><button key={value} disabled={busy} onClick={()=>changeDtf({widthCm:value})}>{value} cm</button>)}</div><div className="field-row"><Field label="Separación"><div className="input-unit"><input type="number" min="1" max="20" step="0.1" value={dtf.gapMm} disabled={busy} onChange={e=>changeDtf({gapMm:Number(e.target.value)})}/><span>mm</span></div></Field><Field label="Margen exterior"><div className="input-unit"><input type="number" min="0" max="50" step="0.1" value={dtf.marginMm} disabled={busy} onChange={e=>changeDtf({marginMm:Number(e.target.value)})}/><span>mm</span></div></Field></div><Field label="Largo máximo (opcional)" hint="0 = largo automático según tus diseños."><div className="input-unit"><input type="number" min="0" max="5000" step="1" value={dtf.maxHeightCm} disabled={busy} onChange={e=>changeDtf({maxHeightCm:Number(e.target.value)})}/><span>cm</span></div></Field><p className="hint">Sin IA, sin escalar ni girar. El tamaño se obtiene de los píxeles originales a 300 DPI. Los márgenes transparentes del diseño también ocupan espacio.</p>{layout&&<div className="layout-stats"><div><span>Largo calculado</span><b>{number(layout.heightCm)} cm</b></div><div><span>Piezas</span><b>{layout.pieces}</b></div><div><span>Aprovechamiento del lienzo</span><b>{number(layout.utilization*100,1)}%</b></div></div>}{layoutError&&<p className="inline-error">{layoutError}</p>}{dtfMismatch&&<p className="inline-warning">Hay archivos que declaran un DPI distinto de 300. Comprueba las medidas en cm de las tarjetas; aquí se conservan los píxeles.</p>}</>}
          {tool==='dtf'&&baseLayout&&<>
            <Field label="Ajustar posición manualmente"><select value={pieceKey} onChange={e=>setPieceKey(e.target.value)} disabled={busy}>
              <option value="">Selecciona una pieza</option>
              {baseLayout.placements.map(p=><option key={`${p.id}:${p.copy}`} value={`${p.id}:${p.copy}`}>{p.name} · copia {p.copy+1}</option>)}
            </select></Field>
            {editedPiece&&<div className="field-row">
              <Field label="X (cm)"><input type="number" step="0.1" min="0" disabled={busy} value={Number(pixelsToCm(editedPiece.x).toFixed(2))} onChange={e=>movePiece('x',e.target.value)}/></Field>
              <Field label="Y (cm)"><input type="number" step="0.1" min="0" disabled={busy} value={Number(pixelsToCm(editedPiece.y).toFixed(2))} onChange={e=>movePiece('y',e.target.value)}/></Field>
            </div>}
            {Object.keys(positions).length>0&&<button className="secondary" disabled={busy} onClick={resetPositions}>Restaurar acomodo automático</button>}
          </>}
        </div><div className="control-action"><button className="primary full" disabled={busy||!selected.length||(tool==='dtf'&&!layout)} onClick={tool==='dtf'?buildSheet:processBatch}>{tool==='dtf'?'Exportar plantilla PNG':tool==='vector'?'Vectorizar seleccionados':tool==='mockup'?'Generar mockups':'Procesar seleccionados'} <span>→</span></button><p>{tool==='dtf'?'PNG transparente · 300 DPI · Sin reescalar':'Un archivo de salida por cada diseño'}</p></div></aside>}
      </div>
      {tool==='dtf'&&layout&&<section className="sheet-panel"><div className="panel-heading"><div><h2>Vista previa del acomodo</h2><p>{number(layout.widthCm)} × {number(layout.heightCm)} cm · {layout.pieces} piezas · separación mínima {number(layout.gap/300*25.4)} mm</p></div>{sheet&&<button className="primary" disabled={busy} onClick={()=>downloadBlob(sheet.blob,`stamp-art-dtf-${number(layout.widthCm)}x${number(layout.heightCm)}cm-300dpi.png`)}>↓ Descargar plantilla</button>}</div><div className="sheet-scroll"><div className="sheet checker" style={{aspectRatio:`${layout.width}/${layout.height}`}}>{layout.placements.map((p,index)=><div className="sheet-design" key={`${p.id}-${p.copy}`} style={{left:`${p.x/layout.width*100}%`,top:`${p.y/layout.height*100}%`,width:`${p.width/layout.width*100}%`,height:`${p.height/layout.height*100}%`}} title={`${p.name} · copia ${p.copy+1}`}><BlobImage blob={assets.find(a=>a.id===p.id)?.thumbnail} alt={p.name}/><span>{index+1}</span></div>)}</div></div><div className="sheet-foot">El acomodo utiliza los lienzos completos. La vista previa es reducida; el PNG exportado conserva las dimensiones originales de cada pieza.</div>{sheet?.warnings.length>0&&<div className="notice warning"><p>{sheet.warnings.join('\n')}</p></div>}</section>}
      {results.length>0&&<section className="results-panel"><div className="panel-heading"><div><h2>Resultados <span>{results.length}</span></h2><p>Revisa antes de imprimir. Descarga cada archivo o el lote completo.</p></div><div className="result-actions"><select value={viewBg} onChange={e=>setViewBg(e.target.value)} aria-label="Fondo de vista previa"><option value="checker">Cuadros</option><option value="dark">Oscuro</option><option value="white">Blanco</option></select>{results.some(r=>r.info)&&<button className="secondary" disabled={busy} onClick={reuse}>Usar en DTF</button>}<button className="primary" disabled={busy} onClick={downloadZip}>↓ Descargar ZIP</button></div></div><div className="result-grid">{results.map(r=><article className="result-card" key={r.id}><div className={`result-preview bg-${viewBg}`}><BlobImage blob={r.thumbnail||r.blob} alt={`Resultado de ${r.source.name}`}/></div><div className="result-details"><strong title={r.name}>{r.name}</strong><p>{r.info?`${number(r.info.width,0)} × ${number(r.info.height,0)} px · 300 DPI${r.info.stats.semi===0?' · Alfa 0/255':''}`:tool==='mockup'?'PNG · Mockup de referencia':`${r.contours} contornos · SVG · ${r.colors??1} ${(r.colors??1)===1?'color':'colores'}`}</p><div><button disabled={busy} onClick={()=>downloadBlob(r.blob,r.name)}>Descargar ↓</button><a href="#" onClick={e=>{e.preventDefault();const url=URL.createObjectURL(r.blob);const win=window.open(url,'_blank');if(!win)URL.revokeObjectURL(url);else setTimeout(()=>URL.revokeObjectURL(url),60000);}}>Abrir al 100% ↗</a></div></div></article>)}</div></section>}
      {!busy&&stage&&<p className="status-line" aria-live="polite">{stage}</p>}
      <footer className="app-footer"><span>Stamp Art · Print Lab</span><span>Procesamiento local · Archivos de hasta 200 MB</span></footer>
    </main></div>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);
