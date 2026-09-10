const KEY_STORAGE = "agenda_phone_aes256_key_v1";
const b64 = bytes => { let s=""; bytes.forEach(b=>s+=String.fromCharCode(b)); return btoa(s); };
const bytes = s => Uint8Array.from(atob(s), c=>c.charCodeAt(0));

async function getKey() {
  const saved = localStorage.getItem(KEY_STORAGE);
  if (saved) return crypto.subtle.importKey("raw", bytes(saved), {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
  const raw = crypto.getRandomValues(new Uint8Array(32));
  localStorage.setItem(KEY_STORAGE, b64(raw));
  return crypto.subtle.importKey("raw", raw, {name:"AES-GCM"}, false, ["encrypt","decrypt"]);
}
export async function encryptPhone(phone) {
  const key=await getKey(), iv=crypto.getRandomValues(new Uint8Array(12));
  const encrypted=await crypto.subtle.encrypt({name:"AES-GCM",iv,tagLength:128},key,new TextEncoder().encode(phone));
  const out=new Uint8Array(12+encrypted.byteLength); out.set(iv); out.set(new Uint8Array(encrypted),12); return b64(out);
}
export async function decryptPhone(value) {
  const key=await getKey(), all=bytes(value), iv=all.slice(0,12), encrypted=all.slice(12);
  const plain=await crypto.subtle.decrypt({name:"AES-GCM",iv,tagLength:128},key,encrypted);
  return new TextDecoder().decode(plain);
}