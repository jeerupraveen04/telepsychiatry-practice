const fs = require('fs');
const path = require('path');

const indexPath = path.join(__dirname, '..', 'frontend', 'index.html');
let html = fs.readFileSync(indexPath, 'utf8');

// Section 8 fixes: Add "None of the above" to checklists.

function addNoneOption(match) {
  if (match.includes('value="None of the above"')) return match;
  return match.replace(/<\/div>\s*<\/div>\s*<div style="margin-top:/g, '</div>\n<div class="option-item"><input type="checkbox" name="noneOfAbove" value="None of the above"> <label>None of the above</label></div>\n</div>\n<div style="margin-top:');
}
// This needs to be carefully handled manually or via a better script.
