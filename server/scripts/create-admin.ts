/**
 * Create an admin account, or turn an existing account into an admin and set its password.
 * Also the way to get back in if an admin forgets their password.
 *
 *   npm run create-admin
 *   npm run create-admin -- --email owner@example.com --name "Owner" --password "secret123"
 *
 * Anything not passed as a flag is asked for. The password is hidden while you type.
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import readline from "node:readline";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function flag(name: string): string | undefined {
  const args = process.argv.slice(2);
  const i = args.indexOf(`--${name}`);
  if (i !== -1) return args[i + 1];
  const inline = args.find((a) => a.startsWith(`--${name}=`));
  return inline?.slice(name.length + 3);
}

// One readline for the whole script: piped input (echo ... | npm run create-admin) is read line by line.
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: process.stdin.isTTY });
const lines = rl[Symbol.asyncIterator]();
let muted = false;
const rlOut = rl as unknown as { _writeToOutput: (s: string) => void; output: NodeJS.WriteStream };
const write = rlOut._writeToOutput.bind(rl);
rlOut._writeToOutput = (s: string) => {
  if (!muted) return write(s);
  if (s.includes("\n") || s.includes("\r")) rlOut.output.write("\n");
  else rlOut.output.write("*".repeat(s.length));
};

async function ask(question: string, hidden = false): Promise<string> {
  process.stdout.write(question);
  muted = hidden && !!process.stdin.isTTY;
  const { value, done } = await lines.next();
  muted = false;
  if (!process.stdin.isTTY) process.stdout.write("\n");
  if (done) throw new Error("No input");
  return String(value).trim();
}

async function askUntil(question: string, check: (v: string) => string | null, hidden = false): Promise<string> {
  for (;;) {
    const value = await ask(question, hidden);
    const problem = check(value);
    if (!problem) return value;
    console.log(`  ${problem}`);
  }
}

const emailProblem = (v: string) => (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v) ? null : "Enter a valid email.");
const passwordProblem = (v: string) => (v.length >= 6 && v.length <= 100 ? null : "Password must be 6 to 100 characters.");
const nameProblem = (v: string) => (v.length >= 2 ? null : "Name is too short.");

async function main() {
  console.log("\nPlant Point Mart · create an admin\n");

  let email = flag("email")?.trim().toLowerCase();
  if (email && emailProblem(email)) throw new Error(emailProblem(email)!);
  if (!email) email = (await askUntil("Email: ", emailProblem)).toLowerCase();

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    const what = existing.role === "ADMIN" ? "an admin already" : "a customer";
    console.log(`\n${email} is ${what} (${existing.name}). Continuing will make it an admin and set a new password.`);
    if (!process.argv.includes("--yes")) {
      const ok = await ask("Continue? (y/N): ");
      if (!/^y(es)?$/i.test(ok)) {
        console.log("Nothing changed.");
        return;
      }
    }
  }

  let name = flag("name")?.trim();
  if (name && nameProblem(name)) throw new Error(nameProblem(name)!);
  if (!name && !existing) name = await askUntil("Full name: ", nameProblem);

  let password = flag("password");
  if (password !== undefined && passwordProblem(password)) throw new Error(passwordProblem(password)!);
  if (password === undefined) {
    for (;;) {
      password = await askUntil("Password (min 6 characters): ", passwordProblem, true);
      const again = await ask("Type it again: ", true);
      if (again === password) break;
      console.log("  The passwords don't match. Try again.");
    }
  }
  const hash = await bcrypt.hash(password, 10);

  if (existing) {
    await prisma.user.update({
      where: { id: existing.id },
      data: {
        role: "ADMIN",
        password: hash,
        ...(name ? { name } : {}),
        isBlocked: false,
        mustChangePassword: false,
        sessionVersion: { increment: 1 }, // signs out old sessions
      },
    });
    console.log(`\n✔ ${email} is now an admin with the new password.`);
  } else {
    await prisma.user.create({ data: { name: name!, email, password: hash, role: "ADMIN" } });
    console.log(`\n✔ Admin created: ${name} <${email}>`);
  }
  console.log("  Sign in on the website and open the Admin panel from your account menu.\n");
}

main()
  .catch((e) => {
    console.error(`\n✖ ${e instanceof Error ? e.message : e}\n`);
    process.exitCode = 1;
  })
  .finally(async () => {
    rl.close();
    await prisma.$disconnect();
  });
