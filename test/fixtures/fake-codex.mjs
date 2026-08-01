process.stdout.write(JSON.stringify({ type: 'thread.started', thread_id: '019faa3e-b7af-7e13-8335-4f651c989e27' }) + '\n');
process.on('SIGINT', () => process.exit(0));
