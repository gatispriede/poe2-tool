const fs=require('fs');const p='src/passives/sample_passive_skills.json';if(fs.existsSync(p)){console.log('Exists size',fs.statSync(p).size);console.log('Content start',fs.readFileSync(p,'utf8').slice(0,200));}else console.log('Missing',p);

