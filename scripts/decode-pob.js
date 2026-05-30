// Decode a PoB / poe.ninja import code → XML. Reads code from argv[2] file.
const fs = require('fs');
const zlib = require('zlib');
const raw = fs.readFileSync(process.argv[2], 'utf8').trim();
const b64 = raw.replace(/-/g, '+').replace(/_/g, '/');
const buf = Buffer.from(b64, 'base64');
let xml;
try { xml = zlib.inflateSync(buf).toString('utf8'); }
catch (e) {
  try { xml = zlib.inflateRawSync(buf).toString('utf8'); }
  catch (e2) { console.error('inflate failed:', e.message, '/', e2.message); process.exit(1); }
}
fs.writeFileSync(process.argv[3] || '/tmp/pob.xml', xml);
console.log('decoded XML length:', xml.length);
console.log(xml.slice(0, 800));
