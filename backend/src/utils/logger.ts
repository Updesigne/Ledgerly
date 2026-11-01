// Terminal color formatting utilities for hackathon pitch demo visibility
const c = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",
  cyan: "\x1b[36m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  red: "\x1b[31m",
  bgCyan: "\x1b[46m\x1b[30m",
  bgGreen: "\x1b[42m\x1b[30m",
  bgYellow: "\x1b[43m\x1b[30m",
  bgBlue: "\x1b[44m\x1b[37m",
  bgMagenta: "\x1b[45m\x1b[37m",
  gray: "\x1b[90m",
};

export function logPitchStep(title: string, details: Record<string, unknown>) {
  const timestamp = new Date().toLocaleTimeString();
  console.log(`\n${c.cyan}┌─── [HACKATHON EVENT] ${c.bright}${title.toUpperCase()}${c.reset}${c.cyan} ───────────────────────────────────────${c.reset}`);
  console.log(`${c.cyan}│${c.reset} ${c.gray}Time:${c.reset} ${timestamp}`);
  
  for (const [key, val] of Object.entries(details)) {
    if (val === undefined || val === null) continue;
    let formattedVal = val;
    if (typeof val === "object") {
      formattedVal = JSON.stringify(val);
    }
    console.log(`${c.cyan}│${c.reset} ${c.yellow}${key}:${c.reset} ${c.green}${formattedVal}${c.reset}`);
  }
  console.log(`${c.cyan}└────────────────────────────────────────────────────────────────────────┘${c.reset}\n`);
}

export function logPitchSuccess(action: string, summary: string, meta?: Record<string, unknown>) {
  console.log(`${c.bgGreen} SUCCESS ${c.reset} ${c.bright}${action}${c.reset} -> ${summary}`);
  if (meta && Object.keys(meta).length > 0) {
    for (const [k, v] of Object.entries(meta)) {
      console.log(`   ${c.gray}•${c.reset} ${c.dim}${k}:${c.reset} ${typeof v === "object" ? JSON.stringify(v) : v}`);
    }
  }
}

export function logPitchError(endpoint: string, message: string, extra?: unknown) {
  console.log(`\n${c.red}┌─── [API ERROR] ${endpoint} ─────────────────────────────────────${c.reset}`);
  console.log(`${c.red}│${c.reset} ${c.red}${message}${c.reset}`);
  if (extra) {
    console.log(`${c.red}│${c.reset} ${c.gray}Details: ${JSON.stringify(extra)}${c.reset}`);
  }
  console.log(`${c.red}└──────────────────────────────────────────────────────────────────┘${c.reset}\n`);
}
