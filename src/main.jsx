import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { DPI, MAX_BYTES, dimensionsForPrint } from './image-core.js';
import './style.css';
import VectorPanel from './VectorPanel.jsx';

const format = n => new Intl.NumberFormat('es-MX').format(n);
const cm = n => new Intl.NumberFormat('es-MX', { maximumFractionDigits: 2 }).format(n);
const defaults = width => ({ mode: 'pixels', widthCm: width ? Number((width / DPI * 2.54).toFixed(3)) : 30, alphaMode: 'keep', threshold: 128, sharpen: false, strength: 35, backgroundMode: 'none', backgroundColor: '#ffffff', backgroundTolerance: 28, backgroundFeather: 12 });

function Icon({ name, size = 20, ...props }) {
  const paths = {
    upload: <><path d="M12 16V3m-5 5 5-5 5 5"/><path d="M4 15v5a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-5"/></>,
    image: <><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="8" cy="8" r="1.5"/><path d="m21 15-5-5-8 11M3 15l4-4 4 4"/></>,
    arrow: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
    download: <><path d="M12 3v13m-5-5 5 5 5-5"/><path d="M4 17v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></>,
    spark: <><path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5Z"/></>,
    check: <><path d="m5 12 4 4L19 6"/></>,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
    info: <><circle cx="12" cy="12" r="9"/><path d="M12 11v6m0-10v.1"/></>,
    reset: <><path d="M3 10a9 9 0 1 1 1 8M3 4v6h6"/></>,
    close: <><path d="m6 6 12 12M6 18 18 6"/></>,
    ruler: <><rect x="2" y="7" width="20" height="10" rx="2"/><path d="M6 7v5m4-5v3m4-3v5m4-5v3"/></>,
    alpha: <><circle cx="9" cy="12" r="7"/><circle cx="15" cy="12" r="7"/></>,
    file: <><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8m-8 4h5"/></>,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.65" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.image}</svg>;
}

async function demoFile() {
  const canvas = document.createElement('canvas');
  canvas.width = 900; canvas.height = 1050;
  const c = canvas.getContext('2d');
  // Vector-built sample with antialiased edges and a translucent glow, not a user file.
  const glow = c.createRadialGradient(450, 520, 140, 450, 520, 420);
  glow.addColorStop(0, 'rgba(135, 81, 239, .7)'); glow.addColorStop(1, 'rgba(135, 81, 239, 0)');
  c.fillStyle = glow; c.fillRect(0, 0, 900, 1050);
  c.save(); c.translate(450, 520); c.rotate(-.09);
  c.fillStyle = '#9b76ff'; c.beginPath(); c.roundRect(-305, -335, 610, 670, 95); c.fill();
  c.strokeStyle = '#d2fb8e'; c.lineWidth = 8; c.beginPath(); c.roundRect(-280, -310, 560, 620, 74); c.stroke();
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillStyle = '#181327'; c.font = '900 130px Arial, sans-serif';
  c.fillText('MAKE', 0, -150); c.fillText('IT', 0, -15); c.fillText('YOURS', 0, 120);
  c.fillStyle = '#d2fb8e'; c.font = '700 25px Arial, sans-serif'; c.fillText('STAMP ART · PRINT SOMETHING GOOD', 0, 260);
  for (const [x,y,size] of [[-240,-250,18],[240,220,22],[220,-250,18]]) {
    c.save();c.translate(x,y);c.beginPath();c.moveTo(0,-size*1.5);c.lineTo(size*.35,-size*.35);c.lineTo(size*1.5,0);c.lineTo(size*.35,size*.35);c.lineTo(0,size*1.5);c.lineTo(-size*.35,size*.35);c.lineTo(-size*1.5,0);c.lineTo(-size*.35,-size*.35);c.closePath();c.fill();c.restore();
  }
  c.restore();
  const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
  if (!blob) throw new Error('No se pudo crear el diseño de prueba.');
  return new File([blob], 'diseno-de-prueba.png', { type: 'image/png' });
}

function App() {
  const [file, setFile] = useState(null), [info, setInfo] = useState(null);
  const [settings, setSettings] = useState(defaults());
  const [result, setResult] = useState(null), [originalUrl, setOriginalUrl] = useState(''), [resultUrl, setResultUrl] = useState('');
  const [busy, setBusy] = useState(false), [stage, setStage] = useState(''), [percent, setPercent] = useState(0), [error, setError] = useState('');
  const [tab, setTab] = useState('original'), [background, setBackground] = useState('checker'), [zoom, setZoom] = useState('fit'), [dragging, setDragging] = useState(false);
  const input = useRef(null), workerRef = useRef(null), sequence = useRef(0);

  useEffect(() => {
    if (!file) { setOriginalUrl(''); return; }
    const url = URL.createObjectURL(file); setOriginalUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  useEffect(() => {
    if (!result) { setResultUrl(''); return; }
    const url = URL.createObjectURL(result.blob); setResultUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [result]);
  useEffect(() => () => workerRef.current?.worker.terminate(), []);

  function runWorker(job, id) {
    return new Promise((resolve, reject) => {
      const worker = new Worker(new URL('./image.worker.js', import.meta.url), { type: 'module' });
      workerRef.current = { worker, reject };
      const finish = () => { worker.terminate(); if (workerRef.current?.worker === worker) workerRef.current = null; };
      worker.onmessage = ({ data }) => {
        if (data.type === 'progress') { if (sequence.current === id) { setPercent(data.value); setStage(data.message); } }
        else if (data.type === 'done') { finish(); resolve(data); }
        else if (data.type === 'error') { finish(); reject(new Error(data.message)); }
      };
      worker.onerror = () => { finish(); reject(new Error('El navegador no pudo procesar el archivo. Prueba con una imagen más pequeña o una versión reciente del navegador.')); };
      worker.postMessage(job);
    });
  }

  function cancel() {
    sequence.current++;
    const task = workerRef.current;
    if (task) { task.worker.terminate(); const aborted = new Error('Cancelado'); aborted.name = 'AbortError'; task.reject(aborted); workerRef.current = null; }
    setBusy(false); setStage('Proceso cancelado'); setPercent(0);
  }

  async function loadImage(next) {
    if (!next || busy) return;
    if (next.size > MAX_BYTES) { setError('El archivo supera 25 MB. Usa una imagen más ligera.'); return; }
    const id = ++sequence.current;
    setBusy(true); setError(''); setPercent(0); setStage('Analizando el archivo…');
    try {
      const data = await runWorker({ type: 'inspect', file: next }, id);
      if (sequence.current !== id) return;
      setFile(next); setInfo(data.info); setSettings(defaults(data.info.width)); setResult(null); setTab('original'); setZoom('fit'); setStage('Imagen lista para preparar');
    } catch (e) { if (sequence.current === id && e.name !== 'AbortError') { setError(e.message); setStage(''); } }
    finally { if (sequence.current === id) setBusy(false); if (input.current) input.current.value = ''; }
  }

  function change(patch) { setSettings(s => ({ ...s, ...patch })); setResult(null); setTab('original'); setError(''); setStage(''); }
  function reset() { if (busy) return; setSettings(defaults(info?.width)); setResult(null); setTab('original'); setError(''); setStage(''); }
  async function loadDemo() { if (busy) return; try { await loadImage(await demoFile()); } catch (e) { setError(e.message); } }

  let planned = null, dimensionError = '';
  if (info) {
    try { planned = dimensionsForPrint(info.width, info.height, settings.mode, Number(settings.widthCm)); }
    catch (e) { dimensionError = e.message; }
  }
  const sourcePpi = info && planned ? info.width / (planned.widthCm / 2.54) : null;
  const maxWidthCm = info ? Math.sqrt(20_000_000 * info.width / info.height) / DPI * 2.54 : null;

  async function prepare() {
    if (!file || !info || !planned || busy) return;
    const id = ++sequence.current;
    setBusy(true); setError(''); setResult(null); setPercent(0); setStage('Preparando tu archivo…');
    try {
      const data = await runWorker({ type: 'process', file, options: { ...settings, widthCm: Number(settings.widthCm) } }, id);
      if (sequence.current !== id) return;
      const base = file.name.replace(/\.[^.]+$/, '').replace(/[^\p{L}\p{N}_-]/gu, '-').slice(0, 80) || 'diseno';
      const alpha = settings.alphaMode === 'keep' ? '' : '-sin-semitransparencias';
      const background = settings.backgroundMode === 'color' ? '-sin-fondo' : '';
      setResult({ ...data, name: `${base}-${data.info.width}x${data.info.height}-300dpi${background}${alpha}.png` });
      setTab('result'); setZoom('fit'); setStage('PNG verificado y listo para descargar');
    } catch (e) { if (sequence.current === id && e.name !== 'AbortError') { setError(e.message); setStage(''); } }
    finally { if (sequence.current === id) setBusy(false); }
  }

  function download() {
    if (!resultUrl || !result || busy) return;
    const a = document.createElement('a'); a.href = resultUrl; a.download = result.name; document.body.appendChild(a); a.click(); a.remove();
  }

  const showingResult = tab === 'result' && result && resultUrl;
  const imageUrl = showingResult ? resultUrl : originalUrl;
  const viewInfo = showingResult ? result.info : info;
  const imageStyle = zoom === 'fit' ? undefined : { width: `${viewInfo?.width * Number(zoom)}px`, height: `${viewInfo?.height * Number(zoom)}px`, maxWidth: 'none', maxHeight: 'none', flexShrink: 0 };

  return <>
    <header className="site-header">
      <a className="brand" href="#"><span className="brand-mark">sa<span>✳</span></span><span className="brand-name">Stamp Art<span>PRINT LAB</span></span></a>
      <nav aria-label="Navegación"><a href="#about">Cómo funciona <Icon name="arrow" size={15}/></a><span className="local-badge"><span/> En tu dispositivo</span></nav>
    </header>
    <main className="main">
      <section className="intro">
        <div><div className="eyebrow"><span/> TU TALLER DIGITAL</div><h1>Del diseño a la <span>impresión.</span></h1><p>Medidas precisas. Transparencia a tu gusto. Un PNG listo para revisar.</p></div>
        <button className="demo-btn" onClick={loadDemo} disabled={busy}><Icon name="spark" size={17}/> Probar con un diseño</button>
      </section>

      <input ref={input} id="image-file" type="file" accept="image/png,image/jpeg,image/webp" className="visually-hidden" disabled={busy} onChange={e => loadImage(e.target.files?.[0])} aria-label="Seleccionar imagen PNG, JPG o WebP" />
      {error && <div className="error-notice" role="alert"><Icon name="info"/><span>{error}</span><button aria-label="Cerrar mensaje" onClick={() => setError('')}><Icon name="close" size={17}/></button></div>}

      <div className="workspace">
        <section className="preview-panel" aria-label="Vista previa de la imagen">
          <div className="preview-top"><div className="tabs" role="tablist" aria-label="Versión de la imagen"><button role="tab" aria-selected={tab === 'original'} className={tab === 'original' ? 'active' : ''} onClick={() => setTab('original')}>Original</button><button role="tab" aria-selected={tab === 'result'} disabled={!result} className={tab === 'result' ? 'active' : ''} onClick={() => setTab('result')}>Resultado {result && <span className="tab-dot"/>}</button></div><span className="format-tag">{showingResult ? 'PNG · 300 DPI' : info?.fileType || 'PNG / JPG / WEBP'}</span></div>

          <div className={`preview-body bg-${background} ${dragging ? 'dragging' : ''} ${zoom !== 'fit' ? 'pixel-view' : ''}`} onDragOver={e => { e.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={e => { e.preventDefault(); setDragging(false); if (!busy) loadImage(e.dataTransfer.files?.[0]); }}>
            {imageUrl ? <div className={`image-stage ${zoom === 'fit' ? 'fit-stage' : ''}`}><img src={imageUrl} alt={showingResult ? 'Resultado procesado de tu diseño' : 'Diseño original cargado'} style={imageStyle}/></div> : <div className="empty-preview"><div className="upload-visual"><div className="upload-back"/><div className="upload-front"><Icon name="image" size={43}/><span className="upload-plus">+</span></div><span className="decor-dot"/></div><h2>Tu próxima creación empieza aquí</h2><p>Arrastra una imagen o selecciónala desde tu equipo.</p><button className="upload-btn" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" size={18}/> Seleccionar imagen</button><span className="file-limit">PNG, JPG o WebP · Hasta 25 MB y 20 MP</span><div className="empty-hint"><Icon name="lock" size={14}/> Tu archivo permanece en tu dispositivo.</div></div>}
            {busy && <div className="processing-overlay" role="status" aria-live="polite"><div className="spinner"/><strong>{stage}</strong><div className="progress-track"><span style={{ width: `${percent}%` }}/></div><span>{percent}%</span><button onClick={cancel}>Cancelar</button></div>}
          </div>

          <div className="preview-toolbar"><div className="backgrounds" aria-label="Fondo de vista previa"><span>Fondo</span>{[['checker','Cuadros'],['dark','Oscuro'],['white','Blanco']].map(([value,label]) => <button key={value} className={`swatch swatch-${value} ${background === value ? 'selected' : ''}`} onClick={() => setBackground(value)} aria-label={`Fondo ${label.toLowerCase()}`} aria-pressed={background === value} title={label}/>)}</div><div className="preview-tools"><label className="zoom-control"><span className="visually-hidden">Ampliación de la vista previa</span><select value={zoom} onChange={e => setZoom(e.target.value)} disabled={!file}><option value="fit">Ajustar</option><option value="1">100%</option><option value="2">200%</option></select></label><button className="replace-btn" onClick={() => input.current?.click()} disabled={busy}><Icon name="upload" size={15}/><span>{file ? 'Cambiar imagen' : 'Subir imagen'}</span></button></div></div>

          <div className="file-summary"><Icon name="file" size={19}/><div><strong>{file?.name || 'Todavía no hay una imagen cargada'}</strong><span>{info ? `${format(info.width)} × ${format(info.height)} px · ${cm(file.size / 1024 / 1024)} MB` : 'El archivo original se conserva durante todo el proceso.'}</span></div>{file && <span className="original-tag">ORIGINAL</span>}</div>

          <div className="stats-grid"><div><span>Salida prevista</span><strong>{planned ? `${format(planned.width)} × ${format(planned.height)}` : '— × —'}<small>px</small></strong></div><div><span>Medida a 300 DPI</span><strong>{planned ? `${cm(planned.widthCm)} × ${cm(planned.heightCm)}` : '— × —'}<small>cm</small></strong></div><div><span>Semitransparentes {showingResult ? 'de salida' : 'originales'}</span><strong>{viewInfo ? format(viewInfo.stats.semi) : '—'}<small>píxeles</small></strong></div></div>
          {sourcePpi && planned?.scale > 1.01 && <div className="resolution-note"><Icon name="info" size={17}/><p>Ampliación de <strong>{cm(planned.scale)}×</strong>. La imagen original aporta aproximadamente <strong>{Math.round(sourcePpi)} PPI</strong> a esta medida. La interpolación suaviza la ampliación; no reconstruye detalles perdidos.</p></div>}
          {result && <div className="result-card" role="status"><div className="result-icon"><Icon name="check" size={22}/></div><div><strong>Tu PNG está preparado</strong><p>300 DPI verificados{result.info.stats.semi === 0 ? ' · Sin semitransparencias' : ` · ${format(result.info.stats.semi)} píxeles semitransparentes conservados`}{result.info.metadataOnly ? ' · Píxeles originales intactos' : ''}.</p></div><button onClick={download} className="download-btn" disabled={busy || !resultUrl}><Icon name="download" size={17}/> Descargar</button></div>}
        </section>

        <aside className="settings-panel" aria-label="Ajustes de impresión"><div className="settings-heading"><h2>Ajustes de impresión</h2><button onClick={reset} disabled={busy} aria-label="Restablecer ajustes" title="Restablecer ajustes"><Icon name="reset" size={18}/></button></div>
          <fieldset disabled={busy} className="settings-fields">
            <div className="setting-section"><div className="section-label"><span className="step-number">01</span><h3>Tamaño y resolución</h3><Icon name="ruler" size={18}/></div><div className="density-row"><span>Resolución de salida</span><span className="density-value">300 <small>DPI</small><Icon name="lock" size={12}/></span></div><div className="segmented"><button type="button" className={settings.mode === 'pixels' ? 'selected' : ''} aria-pressed={settings.mode === 'pixels'} onClick={() => change({ mode: 'pixels' })}>Conservar píxeles</button><button type="button" className={settings.mode === 'print' ? 'selected' : ''} aria-pressed={settings.mode === 'print'} onClick={() => change({ mode: 'print' })}>Medida en cm</button></div>
              {settings.mode === 'print' ? <><div className="size-inputs"><label>Ancho<div className="input-unit"><input type="number" min="0.01" max="500" step="0.1" value={settings.widthCm} onChange={e => change({ widthCm: e.target.value })} inputMode="decimal"/><span>cm</span></div></label><label>Alto proporcional<div className="input-unit readonly"><input value={planned ? cm(planned.heightCm) : '—'} readOnly aria-label="Alto calculado conservando proporciones"/><span>cm</span></div></label></div><div className="presets">{[10,20,30].map(value => <button key={value} type="button" onClick={() => change({ widthCm: value })}>{value} cm</button>)}<span><Icon name="lock" size={11}/> Proporciones</span></div><p className="field-hint">La medida incluye todo el lienzo, también los márgenes transparentes.</p>{maxWidthCm && <p className="field-hint subtle">Ancho máximo aproximado: {cm(maxWidthCm)} cm.</p>}</> : <p className="field-hint">Mantiene el número de píxeles. A 300 DPI, el tamaño de impresión será el indicado en la vista previa.</p>}
              {dimensionError && <p className="field-error" role="alert">{dimensionError}</p>}
            </div>

            <div className="setting-section"><div className="section-label"><span className="step-number">02</span><h3>Mejora de imagen</h3><Icon name="spark" size={18}/></div><div className="enhancement-info"><span className="small-status-dot"/><span>{planned?.scale > 1.01 ? 'Ampliación suave activada' : 'Sin ampliación de píxeles'}</span></div><label className="toggle-row"><span><strong>Ajustar nitidez</strong><small>Refuerza los bordes y el contraste local.</small></span><input type="checkbox" checked={settings.sharpen} onChange={e => change({ sharpen: e.target.checked })}/><span className="toggle-visual"/></label>{settings.sharpen && <div className="slider-field"><label htmlFor="strength">Intensidad <strong>{settings.strength}%</strong></label><input id="strength" type="range" min="0" max="100" value={settings.strength} onChange={e => change({ strength: Number(e.target.value) })}/><div className="range-labels"><span>Suave</span><span>Intensa</span></div></div>}<p className="field-hint">Ampliación con interpolación y nitidez opcional. Esta versión no utiliza IA.</p></div>

            <div className="setting-section"><div className="section-label"><span className="step-number">03</span><h3>Quitar fondo</h3><Icon name="alpha" size={18}/></div><label className="select-label" htmlFor="background-mode">Método</label><select id="background-mode" className="full-select" value={settings.backgroundMode} onChange={e => change({ backgroundMode: e.target.value })}><option value="none">No quitar fondo</option><option value="color">Quitar un color de fondo</option></select>
              {settings.backgroundMode === 'color' && <><div className="color-row"><label htmlFor="background-color">Color a quitar</label><input id="background-color" type="color" value={settings.backgroundColor} onChange={e => change({ backgroundColor: e.target.value })}/><code>{settings.backgroundColor.toUpperCase()}</code></div><div className="color-presets"><button type="button" onClick={() => change({ backgroundColor: '#ffffff' })}>Blanco</button><button type="button" onClick={() => change({ backgroundColor: '#000000' })}>Negro</button><button type="button" onClick={() => change({ backgroundColor: '#00ff00' })}>Verde chroma</button></div><div className="slider-field"><label htmlFor="background-tolerance">Tolerancia <strong>{settings.backgroundTolerance}</strong></label><input id="background-tolerance" type="range" min="0" max="180" value={settings.backgroundTolerance} onChange={e => change({ backgroundTolerance: Number(e.target.value) })}/><div className="range-labels"><span>Color exacto</span><span>Más parecido</span></div></div><div className="slider-field"><label htmlFor="background-feather">Suavizado de borde <strong>{settings.backgroundFeather}</strong></label><input id="background-feather" type="range" min="0" max="80" value={settings.backgroundFeather} onChange={e => change({ backgroundFeather: Number(e.target.value) })}/><div className="range-labels"><span>Borde duro</span><span>Borde suave</span></div></div><p className="field-hint">Ideal para fondos lisos. Si quieres un PNG sin semitransparencias, en el siguiente apartado selecciona <strong>Limpiar con umbral</strong>.</p></>}
              {settings.backgroundMode === 'none' && <p className="field-hint">Quita fondos blancos, negros o de color sólido sin subir el archivo. El recorte automático con IA se añadirá con un modelo que permita publicar la herramienta sin restricciones.</p>}
            </div>

            <div className="setting-section"><div className="section-label"><span className="step-number">04</span><h3>Transparencia</h3><Icon name="alpha" size={18}/></div><label className="select-label" htmlFor="alpha-mode">Tratamiento de transparencia</label><select id="alpha-mode" className="full-select" value={settings.alphaMode} onChange={e => change({ alphaMode: e.target.value })}><option value="keep">Conservar transparencia original</option><option value="threshold">Limpiar con umbral</option><option value="visible">Hacer opaco todo lo visible</option></select>
              {settings.alphaMode === 'threshold' && <><div className="slider-field"><label htmlFor="threshold">Umbral de opacidad <strong>{settings.threshold} / 255</strong></label><input id="threshold" type="range" min="1" max="255" value={settings.threshold} onChange={e => change({ threshold: Number(e.target.value) })}/><div className="range-labels"><span>Conservar más</span><span>Limpiar más</span></div></div><p className="field-hint">Debajo del umbral, el píxel desaparece. Desde el umbral, queda totalmente opaco. Puede eliminar sombras y detalles tenues.</p></>}
              {settings.alphaMode === 'visible' && <p className="field-hint">Todo píxel con algo de opacidad queda al 100%. El fondo transparente se conserva; los residuos tenues pueden hacerse visibles.</p>}
              {settings.alphaMode === 'keep' && <p className="field-hint">Conserva sombras, degradados y bordes suaves. Selecciona una limpieza para obtener únicamente píxeles opacos o transparentes.</p>}
            </div>
          </fieldset>
          <div className="prepare-area"><button className="prepare-btn" onClick={prepare} disabled={!info || busy || !planned}><Icon name="spark" size={18}/>{busy ? 'Preparando…' : 'Preparar PNG'}<Icon name="arrow" size={17}/></button><p><Icon name="check" size={13}/> PNG · Procesamiento local · 300 DPI</p><span className="status-text" aria-live="polite">{busy ? stage : result ? 'Listo para descargar' : info ? 'Revisa tus ajustes y prepara el archivo' : 'Carga una imagen para comenzar'}</span></div>
        </aside>
      </div>

      <VectorPanel/>
      <section id="about" className="about"><div className="about-title"><span className="eyebrow">PENSADO PARA TU TALLER</span><h2>Tú diseñas.<br/><span>Print Lab prepara.</span></h2></div><div className="about-items"><article><span>01</span><h3>Define el tamaño</h3><p>Conserva los píxeles o indica el ancho de impresión. Las proporciones siempre se mantienen.</p></article><article><span>02</span><h3>Revisa los bordes</h3><p>Compara el original y el resultado al 100%. Limpiar transparencias puede cambiar sombras y contornos.</p></article><article><span>03</span><h3>Descarga tu PNG</h3><p>El archivo lleva 300 DPI verificados. La calidad final depende del original y de la medida elegida.</p></article></div></section>
      <div className="tool-note"><Icon name="info" size={17}/><p>La eliminación por color funciona mejor con fondos lisos y puede borrar partes similares del diseño: revisa el resultado al 100%. El recorte automático por IA y los semitonos son los siguientes módulos. Las imágenes transformadas se exportan en el espacio de color del navegador; revisa el color y el acabado con tu proveedor de impresión.</p></div>
    </main>
    <footer><span>Stamp Art <span className="footer-divider">/</span> Print Lab</span><span>Hecho para crear, preparar e imprimir.</span><span className="footer-version">VERSIÓN 1.1</span></footer>
  </>;
}

createRoot(document.getElementById('root')).render(<App/>);
