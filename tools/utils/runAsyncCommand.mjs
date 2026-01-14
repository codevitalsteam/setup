import { execSync, spawn } from "node:child_process";

export const runAsyncCommand = (cmd, args, cwd) => {
  console.log(`\n> ${cmd} ${args.join(" ")}`);
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      cwd,
      env: process.env,
      shell: true,
      stdio: ["ignore", "ignore", "pipe"], // keep spinner clean; keep stderr for errors
    });

    let err = "";
    child.stderr.on("data", (d) => (err += d.toString()));

    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(err || `${cmd} exited with code ${code}`));
    });
  });
}