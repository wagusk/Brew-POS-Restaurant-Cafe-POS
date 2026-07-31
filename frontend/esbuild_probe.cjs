const esbuild = require('esbuild');
async function run(name, src) {
  try {
    const r = await esbuild.transform(src, {loader: 'tsx'});
    console.log(name, 'OK');
  } catch (e) {
    const loc = e.errors && e.errors[0] && e.errors[0].location;
    console.log(name, 'ERR:', e.errors?.[0]?.text, loc ? `line ${loc.line} col ${loc.column} text="${loc.lineText}"` : '');
  }
}
(async () => {
  // No comment, just a Box+children
  await run('no-comment-box', 'const X = () => <Box>{children}</Box>;');
  // No comment, with div wrap
  await run('no-comment-div', 'const X = () => (\n  <div>\n    <Box>{children}</Box>\n  </div>\n);');
  // With ASCII comment before
  await run('ascii-comment-div', 'const X = () => (\n  <div>\n    {/* hi */}\n    <Box>{children}</Box>\n  </div>\n);');
  // With box-drawing comment before
  await run('u2500-comment-div', 'const X = () => (\n  <div>\n    {/* \u2500\u2500 hi \u2500 */}\n    <Box>{children}</Box>\n  </div>\n);');
  // Without div wrap
  await run('u2500-comment-nodiv', 'const X = () => (\n    {/* \u2500 hi \u2500 */}\n    <Box>{children}</Box>\n);');
  // Lots of U+2500
  await run('many-u2500', 'const X = () => (\n    {/* \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 hi \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500 */}\n    <Box>{children}</Box>\n);');
})();
