export function startSpinner(label) {
  // If not an interactive terminal, just return no-op handlers
if (!process.stdout.isTTY) {
    return {
      succeed: (msg) => console.log(`✅ ${msg}`),
      fail: (msg) => console.error(`❌ ${msg}`)
    };
  }

  const frames = ["|", "/", "-", "\\"];
  let i = 0;

  // hide cursor
  process.stdout.write("\x1B[?25l");

  const render = () => {
    process.stdout.write(`\r${frames[i % frames.length]} ${label}`);
    i++;
  };

  render(); // IMPORTANT: show immediately

  const timer = setInterval(render, 90);

  const stop = () => {
    clearInterval(timer);
    process.stdout.write("\r");
    process.stdout.write("\x1B[?25h"); // show cursor
  };

  return {
    succeed(msg) {
      stop();
      process.stdout.write(`✅ ${msg}\n`);
    },
    fail(msg) {
      stop();
      process.stdout.write(`❌ ${msg}\n`);
    }
  };
}
