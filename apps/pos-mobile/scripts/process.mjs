import { spawn } from "node:child_process";

export function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: false,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`${command} was terminated by signal ${signal}.`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`${command} exited with code ${code}.`));
        return;
      }
      resolve();
    });
  });
}
