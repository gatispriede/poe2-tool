const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../PathOfBuilding-PoE2/src/Data/ModItem.lua');
const outputPath = path.join(__dirname, 'test-output.txt');

let output = '';
output += 'Checking file: ' + filePath + '\n';
output += 'Exists: ' + fs.existsSync(filePath) + '\n';

if (fs.existsSync(filePath)) {
  const content = fs.readFileSync(filePath, 'utf-8');
  output += 'Content length: ' + content.length + '\n';
  output += 'First 500 chars:\n';
  output += content.substring(0, 500) + '\n';
}

fs.writeFileSync(outputPath, output);
console.log('Done - check ' + outputPath);

