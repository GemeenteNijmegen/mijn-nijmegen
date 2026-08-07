import chokidar from 'chokidar';

const RENDER_PREVIEWS_PATH = require.resolve('./render-previews');

// ts-node/require cache the modules pulled in by render-previews.ts (including
// .mustache files, which are read once via mustache-register.js). Without
// busting the cache, watch would keep re-rendering the same stale content
// forever, so every source file under src/ is dropped from the cache first.
function clearSourceRequireCache(): void {
  for (const id of Object.keys(require.cache)) {
    if (!id.includes('node_modules')) {
      delete require.cache[id];
    }
  }
}

async function renderAll(): Promise<void> {
  clearSourceRequireCache();
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const fresh = require(RENDER_PREVIEWS_PATH);
  await fresh.renderAll();
}

async function main() {
  console.log('Initial render...');
  await renderAll();

  let rendering = false;

  // chokidar 4+ dropped glob support for watch paths, so a real directory is
  // watched and non-.mustache/.ts files are filtered out via `ignored`.
  const watcher = chokidar.watch(
    'src',
    {
      ignored: (filePath: string, stats?: { isFile(): boolean }) =>
        !!stats?.isFile() && !filePath.endsWith('.mustache') && !filePath.endsWith('.ts'),
      persistent: true,
      ignoreInitial: true,
      // /workspace is a host-shared bind mount (fakeowner) that doesn't propagate
      // native inotify events into the container, so change events never fire
      // without polling.
      usePolling: true,
      interval: 300,
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

  console.log('\nWatching for changes in src/**/*.mustache and .ts files...');
  console.log('Open preview/*.html in your browser.');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
