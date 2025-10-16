(function(){
  const KEY = 'muelles-data-v1';
  function loadData(){ try{ return JSON.parse(localStorage.getItem(KEY)||'{}'); }catch{ return {}; } }
  function saveData(o){ localStorage.setItem(KEY, JSON.stringify(o)); }
  function mergeInto(current, patch){
    const out = { ...current };
    for(const k of Object.keys(patch)){
      const muelle = Number(k);
      const n = patch[k];
      const c = current[muelle];
      if(!c){
        out[muelle] = { ...n, fuente: n.fuente||'import', actualizadoEn: new Date().toISOString() };
        continue;
      }
      out[muelle] = { ...c, ...n,
        horaLlegada: c.horaLlegada || n.horaLlegada,
        horaSalidaLimite: c.horaSalidaLimite || n.horaSalidaLimite,
        matricula: c.matricula || n.matricula,
        precinto: c.precinto || n.precinto,
        fuente: 'merge',
        actualizadoEn: new Date().toISOString()
      };
    }
    return out;
  }
  window.State = { KEY, loadData, saveData, mergeInto };
})();
