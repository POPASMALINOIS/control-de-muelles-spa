(function(){
const carga = window.Utils.normStr(r.CARGA ?? r.carga ?? r['Carga']);
const llegada = window.Utils.toISOFromHHMM(r.LLEGADA ?? r['Hora llegada'] ?? r['LLEGADA HH:MM']);
const salida = window.Utils.toISOFromHHMM(r.SALIDA ?? r['Hora límite'] ?? r['SALIDA HH:MM']);
byMuelle[muelle] = {
id: r.ID || r.CMR || `${empresa}-${muelle}-${r.SALIDA||''}`,
empresa, carga,
matricula: window.Utils.normMat(r.MATRICULA || r['Matrícula']),
precinto: window.Utils.normPrec(r.PRECINTO || r['Precinto']),
horaLlegada: llegada,
horaSalidaLimite: salida,
muelle,
fuente: 'excel'
};
}
const merged = mergeInto(data, byMuelle); setData(merged); saveData(merged);
}catch(err){ alert('Error leyendo Excel: '+ err); }
if(fileRef.current) fileRef.current.value = '';
};
reader.readAsBinaryString(f);
}


async function fetchURL(){
const url = prompt('Pega la URL (debe permitir CORS en navegador):'); if(!url) return;
try{
const res = await fetch(url); const text = await res.text();
let byMuelle = {}; try{ byMuelle = parseJson(JSON.parse(text)); } catch{ byMuelle = parseHtml(text); }
const merged = mergeInto(data, byMuelle); setData(merged); saveData(merged);
}catch(err){ alert('No se pudo traer la URL (posible CORS). Usa "Pegar datos".'); }
}


function pegarDatos(){
try{
const raw = pegarRaw.trim(); if(!raw) return; let patch = {};
try { patch = parseJson(JSON.parse(raw)); } catch { patch = parseHtml(raw); }
const merged = mergeInto(data, patch); setData(merged); saveData(merged); setPegarRaw('');
}catch(err){ alert('Datos no reconocidos: ' + err); }
}


useEffect(()=>{
if(typeof Notification==='undefined' || Notification.permission!=='granted') return;
for(const muelle of Object.keys(data)){
const c = data[muelle]; if(!c?.horaSalidaLimite) continue;
const diff=(new Date(c.horaSalidaLimite).getTime()-Date.now())/60000;
if(diff<=30 && diff>29) new Notification(`Muelle ${muelle}: salida en 30 min`, { body: `${c.empresa||''} · ${c.carga||''}` });
}
});


return React.createElement('div', { className: 'max-w-7xl mx-auto p-6 space-y-4' },
React.createElement('header', { className: 'flex flex-wrap gap-2 items-center' },
React.createElement('h1', { className: 'text-xl font-semibold mr-auto' }, 'Control de Muelles 312–370'),
React.createElement('input', { ref: fileRef, type: 'file', accept: '.xlsx,.xls', onChange: handleExcel, className: 'block' }),
React.createElement('button', { onClick: fetchURL, className: 'card hover:shadow-md' }, 'Traer desde URL'),
React.createElement('button', { onClick: ()=>{ if(confirm('¿Borrar datos locales?')){ setData({}); saveData({}); } }, className: 'card hover:shadow-md' }, 'Limpiar')
),
React.createElement('div', { className: 'flex flex-wrap gap-2 items-center' },
React.createElement('input', { placeholder: 'Filtrar por empresa', value: filtroEmpresa, onChange: e=>setFiltroEmpresa(e.target.value), className: 'card w-64' }),
React.createElement('label', { className: 'flex items-center gap-2' },
React.createElement('input', { type: 'checkbox', checked: soloAlertas, onChange: e=>setSoloAlertas(e.target.checked) }),
'Solo alertas/retrasos'
)
),
React.createElement('details', { className: 'card' },
React.createElement('summary', null, 'Pegar datos (alternativa sin CORS)'),
React.createElement('p', { className: 'text-sm text-slate-600 mb-2' }, 'Pega aquí JSON (array o {items:[]}) o HTML de una tabla.'),
React.createElement('textarea', { value: pegarRaw, onChange: e=>setPegarRaw(e.target.value), rows: 6, className: 'w-full p-2 border rounded' }),
React.createElement('div', { className: 'mt-2 flex justify-end' },
React.createElement('button', { onClick: pegarDatos, className: 'card hover:shadow-md' }, 'Importar')
)
),
React.createElement('section', { className: 'grid-muelles' },
muellesFiltrados.map(m => React.createElement(MuelleCard, { key: m, muelle: m, camion: data[m] }))
),
React.createElement('footer', { className: 'text-xs text-slate-500 py-6' }, 'SPA estática · Datos en localStorage · Importa Excel/URL/pegar contenido')
);
}


window.Components = { App, MuelleCard };
})();
