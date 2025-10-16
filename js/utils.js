(function(){
  const MUELLE_MIN = 312; const MUELLE_MAX = 370;

  function range(a,b){ return Array.from({length:b-a+1}, (_,i)=>a+i); }
  function fmt(iso){ if(!iso) return '—'; const d=new Date(iso); if(isNaN(d)) return '—'; return d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}); }
  function estadoDe(camion){
    if(!camion) return 'libre';
    const limite = camion.horaSalidaLimite? new Date(camion.horaSalidaLimite):null;
    if(!limite||isNaN(limite)) return 'ocupado';
    const diff=(limite.getTime()-Date.now())/60000;
    if(diff<0) return 'retraso';
    if(diff<=30) return 'alerta-30';
    return 'ocupado';
  }
  function clsEstado(e){
    if(e==='retraso') return 'badge bg-red-100 text-red-700';
    if(e==='alerta-30') return 'badge bg-yellow-100 text-yellow-800';
    if(e==='ocupado') return 'badge bg-blue-100 text-blue-700';
    return 'badge bg-green-100 text-green-700';
  }
  function toISOFromHHMM(hhmm){
    if(!hhmm) return undefined;
    const m=String(hhmm).match(/(\\d{1,2}):(\\d{2})/);
    if(!m) return undefined;
    const d=new Date();
    d.setHours(Number(m[1])||0, Number(m[2])||0, 0, 0);
    return d.toISOString();
  }
  function normStr(s){ return (s??'').toString().trim(); }
  function normMat(s){ const v=normStr(s).toUpperCase().replace(/[^A-Z0-9]/g,''); return v||undefined; }
  function normPrec(s){ const v=normStr(s).toUpperCase().replace(/\\s+/g,''); return v||undefined; }

  window.Utils = { MUELLE_MIN, MUELLE_MAX, range, fmt, estadoDe, clsEstado, toISOFromHHMM, normStr, normMat, normPrec };
})();
