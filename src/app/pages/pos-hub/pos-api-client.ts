export async function posRequest(api: string, path: string, method = 'GET', body?: any, signal?: AbortSignal) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45000);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort, {once:true});
  if (signal?.aborted) controller.abort();
  try {
    const response = await fetch(api + path, {method, signal:controller.signal,
      headers:{'Content-Type':'application/json',Authorization:'Bearer '+(sessionStorage.getItem('systemlab-pos-token') || '')},
      ...(body === undefined ? {} : {body:JSON.stringify(body)})});
    const data = await response.json();
    if (!response.ok) throw Error(typeof data.detail === 'string' ? data.detail : 'Revisá los campos de la operación.');
    return data;
  } catch (error:any) {
    if (error.name === 'AbortError') throw Error('La consulta tardó demasiado. Reintentá; no se duplicará la operación.');
    throw error;
  } finally {clearTimeout(timer);signal?.removeEventListener('abort',abort);}
}
export function localPosInput(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA',{timeZone:'America/Costa_Rica',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
  const value=(key:string)=>parts.find(part=>part.type===key)?.value;
  return `${value('year')}-${value('month')}-${value('day')}T${value('hour')}:${value('minute')}`;
}
