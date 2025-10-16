(function(){
  const { useState, useEffect, useMemo, useRef } = React;
  const { MUELLE_MIN, MUELLE_MAX, range, fmt, estadoDe, clsEstado, normStr, toISOFromHHMM, normMat, normPrec } = window.Utils;
  const { loadData, saveData, mergeInto } = window.State;
  const { parseJson, parseHtml } = window.Parsers;

  /* Tarjeta de cada muelle */
  function MuelleCard({ muelle, camion, onDropTo }) {
    const e = estadoDe(camion);
    const borde = (!camion || (camion.matricula && camion.precinto))
      ? 'border-transparent'
      : 'border-dashed border-slate-300';
    const icon = e === 'retraso' ? '⛔' :
                 e === 'alerta-30' ? '🕒' :
                 e === 'ocupado' ? '📦' : '✅';

    const [over, setOver] = useState(false);

    // Eventos drag and drop
    function onDragStart(ev) {
      if (!camion) return ev.preventDefault();
      ev.dataTransfer.setData('text/muelle', String(muelle));
      ev.dataTransfer.effectAllowed = 'move';
      ev.currentTarget.classList.add('dragging');
    }

    function onDragEnd(ev) {
      ev.currentTarget.classList.remove('dragging');
    }

    function onDragOver(ev) {
      ev.preventDefault();
      ev.dataTransfer.dropEffect = 'move';
      if (!over) setOver(true);
    }

    function onDragLeave() {
      setOver(false);
    }

    function onDrop(ev) {
      ev.preventDefault();
      setOver(false);
      const from = Number(ev.dataTransfer.getData('text/muelle'));
      if (Number.isFinite(from) && from !== muelle) {
        onDropTo(from, muelle);
      }
    }

    return React.createElement(
      'div',
      {
        className: `card border ${borde} ${over ? 'drop-target' : ''}`,
        draggable: !!camion,
        onDragStart,
        onDragEnd,
        onDragOver,
        onDragLeave,
        onDrop,
      },
      React.createElement(
        'div',
        { className: 'flex justify-between items-center' },
        React.createElement('div', { className: 'font-semibold' }, `Muelle ${muelle}`),
        React.createElement('span', { className: clsEstado(e) }, `${icon} ${e}`)
      ),
      camion
        ? React.createElement(
            'div',
            { className: 'mt-2 text-sm' },
            React.createElement('div', { className: 'font-medium' }, camion.empresa || '—'),
            React.createElement('div', { className: 'opacity-80' }, camion.carga || '—'),
            React.createElement('div', { className: 'mt-1' }, `Llega: ${fmt(camion.horaLlegada)} · Límite: ${fmt(camion.horaSalidaLimite)}`),
            React.createElement('div', { className: 'mt-1' }, `Mat.: ${camion.matricula || '—'} · Prec.: ${camion.precinto || '—'}`),
            React.createElement('div', { className: 'mt-1 text-xs text-slate-500' }, `Fuente: ${camion.fuente || '—'} · ${
              camion.actualizadoEn ? new Date(camion.actualizadoEn).toLocaleTimeString() : ''
            }`)
          )
        : React.createElement('div', { className: 'mt-2 text-sm opacity-60' }, 'Libre')
    );
  }

  /* Aplicación principal */
  function App() {
    const muelles = useMemo(() => range(MUELLE_MIN, MUELLE_MAX), []);
    const [data, setData] = useState(() => loadData());
    const [filtroEmpresa, setFiltroEmpresa] = useState('');
    const [soloAlertas, setSoloAlertas] = useState(false);
    const [pegarRaw, setPegarRaw] = useState('');
    const [tv, setTv] = useState(false);
    const fileRef = useRef(null);

    // Detectar modo TV por query ?tv=1
    useEffect(() => {
      const url = new URL(window.location.href);
      const tvParam = url.searchParams.get('tv');
      if (tvParam === '1' || tvParam === 'true') setTv(true);
    }, []);

    // Añadir o quitar clase "tv" al body
    useEffect(() => {
      document.body.classList.toggle('tv', tv);
    }, [tv]);

    // Refrescar visualmente cada minuto
    useEffect(() => {
      const id = setInterval(() => setData(d => ({ ...d })), 60000);
      return () => clearInterval(id);
    }, []);

    // Permiso notificaciones
    useEffect(() => {
      if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
        Notification.requestPermission();
      }
    }, []);

    // Filtrado dinámico
    const muellesFiltrados = useMemo(
      () =>
        muelles.filter(m => {
          const c = data[m];
          if (
            soloAlertas &&
            (!c || (estadoDe(c) !== 'alerta-30' && estadoDe(c) !== 'retraso'))
          )
            return false;
          if (!filtroEmpresa) return true;
          return (c?.empresa || '')
            .toLowerCase()
            .includes(filtroEmpresa.toLowerCase());
        }),
      [muelles, data, filtroEmpresa, soloAlertas]
    );

    // Mover camión entre muelles
    function moveTruck(from, to) {
      setData(prev => {
        const next = { ...prev };
        const a = next[from] || null;
        const b = next[to] || null;
        next[to] = a;
        next[from] = b || null;
        saveData(next);
        return next;
      });
    }

    /* Importar Excel */
    function handleExcel(e) {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });
          const byMuelle = {};
          for (const r of rows) {
            const muelle = Number(r.MUELLE ?? r.muelle ?? r['Muelle']);
            if (!(muelle >= MUELLE_MIN && muelle <= MUELLE_MAX)) continue;
            const empresa = normStr(r.EMPRESA ?? r.empresa ?? r['Empresa']);
            const carga = normStr(r.CARGA ?? r.carga ?? r['Carga']);
            const llegada = toISOFromHHMM(r.LLEGADA ?? r['Hora llegada'] ?? r['LLEGADA HH:MM']);
            const salida = toISOFromHHMM(r.SALIDA ?? r['Hora límite'] ?? r['SALIDA HH:MM']);
            byMuelle[muelle] = {
              id: r.ID || r.CMR || `${empresa}-${muelle}-${r.SALIDA || ''}`,
              empresa,
              carga,
              matricula: normMat(r.MATRICULA || r['Matrícula']),
              precinto: normPrec(r.PRECINTO || r['Precinto']),
              horaLlegada: llegada,
              horaSalidaLimite: salida,
              muelle,
              fuente: 'excel',
            };
          }
          const merged = mergeInto(data, byMuelle);
          setData(merged);
          saveData(merged);
        } catch (err) {
          alert('Error leyendo Excel: ' + err);
        }
        if (fileRef.current) fileRef.current.value = '';
      };
      reader.readAsBinaryString(f);
    }

    /* Importar desde URL */
    async function fetchURL() {
      const url = prompt('Pega la URL (debe permitir CORS en navegador):');
      if (!url) return;
      try {
        const res = await fetch(url);
        const text = await res.text();
        let byMuelle = {};
        try {
          byMuelle = parseJson(JSON.parse(text));
        } catch {
          byMuelle = parseHtml(text);
        }
        const merged = mergeInto(data, byMuelle);
        setData(merged);
        saveData(merged);
      } catch (err) {
        alert('No se pudo traer la URL (posible CORS). Usa "Pegar datos".');
      }
    }

    /* Importar por pegado */
    function pegarDatos() {
      try {
        const raw = pegarRaw.trim();
        if (!raw) return;
        let patch = {};
        try {
          patch = parseJson(JSON.parse(raw));
        } catch {
          patch = parseHtml(raw);
        }
        const merged = mergeInto(data, patch);
        setData(merged);
        saveData(merged);
        setPegarRaw('');
      } catch (err) {
        alert('Datos no reconocidos: ' + err);
      }
    }

    // Notificaciones de alertas
    useEffect(() => {
      if (typeof Notification === 'undefined' || Notification.permission !== 'granted')
        return;
      for (const muelle of Object.keys(data)) {
        const c = data[muelle];
        if (!c?.horaSalidaLimite) continue;
        const diff = (new Date(c.horaSalidaLimite).getTime() - Date.now()) / 60000;
        if (diff <= 30 && diff > 29)
          new Notification(`Muelle ${muelle}: salida en 30 min`, {
            body: `${c.empresa || ''} · ${c.carga || ''}`,
          });
      }
    });

    /* Render principal */
    return React.createElement(
      'div',
      { className: 'max-w-7xl mx-auto p-6 space-y-4' },
      React.createElement(
        'header',
        { className: 'controls flex flex-wrap gap-2 items-center' },
        React.createElement('h1', { className: 'text-xl font-semibold mr-auto' }, 'Control de Muelles 312–370'),
        React.createElement('input', { ref: fileRef, type: 'file', accept: '.xlsx,.xls', onChange: handleExcel, className: 'block' }),
        React.createElement('button', { onClick: fetchURL, className: 'card hover:shadow-md' }, 'Traer desde URL'),
        React.createElement('button', { onClick: () => { if (confirm('¿Borrar datos locales?')) { setData({}); saveData({}); } }, className: 'card hover:shadow-md' }, 'Limpiar'),
        React.createElement('button', { onClick: () => setTv(v => !v), className: 'card hover:shadow-md' }, tv ? 'Salir modo TV' : 'Modo TV')
      ),
      React.createElement(
        'div',
        { className: 'controls flex flex-wrap gap-2 items-center' },
        React.createElement('input', { placeholder: 'Filtrar por empresa', value: filtroEmpresa, onChange: e => setFiltroEmpresa(e.target.value), className: 'card w-64' }),
        React.createElement('label', { className: 'flex items-center gap-2' },
          React.createElement('input', { type: 'checkbox', checked: soloAlertas, onChange: e => setSoloAlertas(e.target.checked) }),
          'Solo alertas/retrasos'
        )
      ),
      React.createElement(
        'details',
        { className: 'controls card' },
        React.createElement('summary', null, 'Pegar datos (alternativa sin CORS)'),
        React.createElement('p', { className: 'text-sm text-slate-600 mb-2' }, 'Pega aquí JSON (array o {items:[]}) o HTML de una tabla.'),
        React.createElement('textarea', { value: pegarRaw, onChange: e => setPegarRaw(e.target.value), rows: 6, className: 'w-full p-2 border rounded' }),
        React.createElement('div', { className: 'mt-2 flex justify-end' },
          React.createElement('button', { onClick: pegarDatos, className: 'card hover:shadow-md' }, 'Importar')
        )
      ),
      React.createElement(
        'section',
        { className: 'grid-muelles' },
        muellesFiltrados.map(m =>
          React.createElement(MuelleCard, { key: m, muelle: m, camion: data[m], onDropTo: moveTruck })
        )
      ),
      React.createElement('footer', { className: 'text-xs text-slate-500 py-6' },
        'SPA estática · Datos en localStorage · Importa Excel/URL/pegar contenido · Drag & Drop entre muelles · Modo TV')
    );
  }

  window.Components = { App, MuelleCard };
})();
