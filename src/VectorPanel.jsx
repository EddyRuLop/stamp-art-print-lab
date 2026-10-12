import React, { useEffect, useRef, useState } from 'react';

export default function VectorPanel() {
  const [file,setFile]=useState(null), [threshold,setThreshold]=useState(128), [invert,setInvert]=useState(false), [color,setColor]=useState('#000000');
  const [result,setResult]=useState(null), [url,setUrl]=useState(''), [error,setError]=useState(''), [busy,setBusy]=useState(false);
  const worker=useRef(null);
  useEffect(()=>{ if(!result){setUrl('');return;} const u=URL.createObjectURL(new Blob([result.svg],{type:'image/svg+xml'}));setUrl(u);return()=>URL.revokeObjectURL(u); },[result]);
  useEffect(()=>()=>worker.current?.terminate(),[]);
  function change(fn){fn();setResult(null);setError('');}
  function cancel(){worker.current?.terminate();worker.current=null;setBusy(false);}
  function vectorize(){
    if(!file||busy)return;
    setBusy(true);setError('');setResult(null);
    const w=new Worker(new URL('./image.worker.js',import.meta.url),{type:'module'});worker.current=w;
    w.onmessage=({data})=>{if(data.type==='progress')return;w.terminate();worker.current=null;setBusy(false);if(data.type==='error')setError(data.message);else setResult(data);};
    w.onerror=()=>{cancel();setError('No se pudo vectorizar. Prueba con una imagen más sencilla.');};
    w.postMessage({type:'vector',file,options:{threshold,invert,color}});
  }
  return <section id="vectorizacion" className="vector-panel">
    <div><span className="eyebrow">VECTOR SVG</span><h2>Vectoriza logos y siluetas</h2><p>Convierte zonas oscuras o claras en contornos de un color. Ideal para gráficos planos; fotos y degradados necesitan una vectorización a color más avanzada.</p></div>
    <div className="vector-controls"><label>Imagen PNG, JPG o WebP<input type="file" accept="image/png,image/jpeg,image/webp" disabled={busy} onChange={e=>change(()=>setFile(e.target.files?.[0]||null))}/></label><label>Umbral: {threshold}<input type="range" min="1" max="255" value={threshold} disabled={busy} onChange={e=>change(()=>setThreshold(Number(e.target.value)))}/></label><label>Color del vector<input type="color" value={color} disabled={busy} onChange={e=>change(()=>setColor(e.target.value))}/></label><label><input type="checkbox" checked={invert} disabled={busy} onChange={e=>change(()=>setInvert(e.target.checked))}/> Invertir selección (zonas claras)</label><button className="upload-btn" disabled={!file||busy} onClick={vectorize}>{busy?'Vectorizando…':'Crear SVG'}</button>{busy&&<button onClick={cancel}>Cancelar</button>}</div>
    {error&&<p role="alert" className="field-error">{error}</p>}
    {result&&<div className="vector-result"><div className="vector-preview"><img src={url} alt="Vista previa del vector SVG"/></div><div><p>{result.contours} contornos · SVG con trazados editables</p><a className="download-btn" href={url} download={`${file.name.replace(/\.[^.]+$/,'')}-vector.svg`}>Descargar SVG</a></div></div>}
    <p className="field-hint">El trazado analiza hasta 768 px por lado y conserva el tamaño físico equivalente al original a 300 PPI. SVG puede escalarse sin pixelarse; el detalle depende de la imagen y del trazado. Revisa bordes al abrirlo en Inkscape. El SVG no necesita metadatos DPI.</p>
  </section>;
}
