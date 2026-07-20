import chokidar from 'chokidar';
import { renderAll } from './render-previews';

async function main() {
  console.log('Initial render...');
  await renderAll();

  let rendering = false;

  const watcher = chokidar.watch(
    ['**/*.mustache', 'src/preview/**/*.ts'],
    {
      ignored: /node_modules/,
      persistent: true,
      ignoreInitial: true,
    },
  );

  watcher.on('change', async (filePath: string) => {
    if (rendering) { return; }
    rendering = true;
    console.log(`Changed: ${filePath}`);
    try {
      await renderAll();
    } catch (err) {
      console.error('Render error:', err);
    } finally {
      rendering = false;
    }
  });

  console.log('\nWatching for changes in *.mustache and src/preview/**...');
  console.log('Open preview/*.html in your browser.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
