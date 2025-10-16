(function(){
  const { MUELLE_MIN, MUELLE_MAX, normStr, normMat, normPrec, toISOFromHHMM } = window.Utils;

  function parseJson(j){
    const list = Array.isArray(j) ? j : (j.items || []);
    const out = {};
    for(const item of list){
      const muelle = Number(item.muelle ?? item.MUELLE);
      if(!(muelle>=MUELLE_MIN && muelle<=MUELLE_MAX)) continue;
      out[muelle] = {
        id: item.id || item.booking || `${item.empresa||''}-${muelle}-${item.salida||''}`,
        empresa: normStr(item.empresa || item.EMPRESA),
        carga: normStr(item.carga || item.CARGA),
        matricula: normMat(item.matricula || item.MATRICULA),
        precinto: normPrec(item.precinto || item.PRECINTO),
        horaLlegada: toISOFromHHMM(item.llegada || item.LLEGADA),
        horaSalidaLimite: toISOFromHHMM(item.salida || item.SALIDA),
        muelle
      };
    }
    return out;
  }

  function parseHtml(html){
    const out = {};
    const rowRe = /<tr[^>]*>([\\s\\S]*?)<\\/tr>/gi;
    let m;
    while((m=rowRe.exec(html))){
      const row = m[1];
      const cells = Array.from(row.matchAll(/<t[dh][^>]*>([\\s\\S]*?)<\\/t[dh]>/gi)).map(x=>x[1].replace(/<[^>]+>/g,'').trim());
      if(cells.length<3) continue;
      const muelle = Number(cells[0]);
      if(!(muelle>=MUELLE_MIN && muelle<=MUELLE_MAX)) continue;
      const empresa = normStr(cells[1]);
      const carga = normStr(cells[2]);
      const matricula = normMat(cells[3]);
      const precinto = normPrec(cells[4]);
      const llegada = toISOFromHHMM(cells[5]);
      const salida = toISOFromHHMM(cells[6]);
      out[muelle] = { id: `${empresa}-${muelle}-${cells[6]||''}`, empresa, carga, matricula, precinto, horaLlegada: llegada, horaSalidaLimite: salida, muelle };
    }
    return out;
  }

  window.Parsers = { parseJson, parseHtml };
})();
