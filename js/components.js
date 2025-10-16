(function(){
  const { useState, useEffect, useMemo, useRef } = React;
  const { MUELLE_MIN, MUELLE_MAX, range, fmt, estadoDe, clsEstado, toISOFromHHMM } = window.Utils;
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
            React.createElement('div', { className: 'mt-1' }, `Mat.: ${camion.matricula || '—'}`),
            React.createElement('div', { className: 'mt-1' }, `Estado: ${camion.precinto || '—'}`),
            camion.observaciones
              ? React.createElement('div', { className: 'mt-1 text-xs text-slate-500' }, `Obs.: ${camion.observaciones}`)
              : null,
            React.createElement('div', { className: 'mt-1 text-xs text-slate-400' }, `Fuente: ${camion.fuente || '—'} · ${
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

    /* Importar Excel con encabezados en la fila 3 */
    function handleExcel(e) {
      const f = e.target.files?.[0];
      if (!f) return;
      const reader = new FileReader();
      reader.onload = ev => {
        try {
          const wb = XLSX.read(ev.target.result, { type: 'binary' });
          const ws = wb.Sheets[wb.SheetNames[0]];
          // Leer desde la fila 3 (range: 2)
          const rows = XLSX.utils.sheet_to_json(ws, { defval: '', header: 0, range: 2 });
          console.log('Filas detectadas desde fila 3:', rows.slice(0, 5));

          const byMuelle = {};
          for (const r of rows) {
            const muelle = parseInt(r.MUELLE);
            if (!(muelle >= MUELLE_MIN && muelle <= MUELLE_MAX)) continue;

            const transportista = (r.TRANSPORTISTA || '').trim();
            const destino = (r.DESTINO || '').trim();
            const llegada = (r.LLEGADA || '').trim();
            const salida = (r.SALIDA || '').trim();
            const salidaTope = (r['SALIDA TOPE'] || '').trim();
            const estado = (r.ESTADO || '').trim();
            const obs = (r.OBSERVACIONES || '').trim();
            const matricula = (r.MATRICULA || '').trim();

            byMuelle[muelle] = {
              id: `${muelle}-${matricula}-${salida}`,
              empresa: transportista || '—',
              carga: destino || '—',
              matricula: matricula || '—',
              precinto: estado || '',
              horaLlegada: toISOFromHHMM(llegada),
              horaSalidaLimite: toISOFromHHMM(salidaTope || salida),
              muelle,
              observaciones: obs,
              fuente: 'excel',
              actualizadoEn: new Date().toISOString()
            };
          }

          const merged = mergeInto(data, byMuelle);
          setData(merged);
          saveData(merged);
          alert(`Se han importado ${Object.keys(byMuelle).length} muelles desde el Excel.`);
        } catch (err) {
          alert('Error leyendo Excel: ' + err);
          console.error(err);
        }
        if (fileRef.current) fileRef.current.value = '';
      };
      reader.readAsBinaryString(f);
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
        React.createElement('button', { onClick: () => { if (confirm('¿Borrar datos locales?')) { setData({}); saveData({}); } }, className: 'card hover:shadow-md' }, 'Limpiar'),
        React.createElement('button', { onClick: () => setTv(v => !v), className: 'card hover:shadow-md' }, tv ? 'Salir modo TV' : 'Modo TV')
      ),
      React.createElement(
        'div',
        { className: 'controls flex flex-wrap gap-2 items-center' },
        React.createElement('input', { placeholder: 'Filtrar por transportista', value: filtroEmpresa, onChange: e => setFiltroEmpresa(e.target.value), className: 'card w-64' }),
        React.createElement('label', { className: 'flex items-center gap-2' },
          React.createElement('input', { type: 'checkbox', checked: soloAlertas, onChange: e => setSoloAlertas(e.target.checked) }),
          'Solo alertas/retrasos'
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
        'SPA estática · Datos en localStorage · Importa Excel (fila 3) · Drag & Drop · Modo TV')
    );
  }

  window.Components = { App, MuelleCard };
})();
