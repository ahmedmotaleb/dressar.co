// Runs Shopify Theme Check and writes the offenses as JSON.
// usage: node tests/theme-check.js [themeRoot] [outJson]
const path = require('path');
const { themeCheckRun } = require('@shopify/theme-check-node');
const root = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const out = process.argv[3] || 'theme-check.json';
themeCheckRun(root, undefined, () => {}).then(({ offenses }) => {
  const rows = offenses.map((o) => ({
    check: o.check, severity: o.severity, file: path.relative(root, o.uri.replace('file://', '')),
    line: o.start ? o.start.line + 1 : null, message: o.message,
  }));
  require('fs').writeFileSync(out, JSON.stringify(rows, null, 1));
  console.log(`offenses: ${rows.length}`);
}).catch((e) => { console.error(e); process.exit(1); });
