import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";

const passwordRule = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^\w\s]).{8,}$/;
const emailRule = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

async function ask(question) {
  const rl = createInterface({ input: stdin, output: stdout });
  const answer = await rl.question(question);
  rl.close();
  return answer.trim();
}

function askHidden(question) {
  return new Promise((resolve) => {
    stdout.write(question);
    let value = "";
    stdin.setRawMode?.(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    const onData = (char) => {
      if (char === "\r" || char === "\n") {
        stdin.setRawMode?.(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (char === "\u0003") {
        process.exit(1);
      } else if (char === "\u007f" || char === "\b") {
        value = value.slice(0, -1);
      } else {
        value += char;
      }
    };
    stdin.on("data", onData);
  });
}

const prisma = new PrismaClient();

try {
  const email = (process.env.ADMIN_EMAIL || (await ask("E-mail do administrador: "))).toLowerCase();

  if (!emailRule.test(email)) {
    throw new Error("E-mail invalido.");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (existing) {
    await prisma.user.update({ where: { id: existing.id }, data: { accountType: "ADMIN" } });
    console.log(`Conta existente ${email} promovida a ADMIN. A senha nao foi alterada.`);
  } else {
    const name = process.env.ADMIN_NAME || (await ask("Nome do administrador: "));
    const password = process.env.ADMIN_PASSWORD || (await askHidden("Senha (nao aparece ao digitar): "));

    if (name.length < 2) {
      throw new Error("Informe um nome.");
    }

    if (!passwordRule.test(password)) {
      throw new Error("A senha precisa ter 8 caracteres, letra maiuscula, minuscula, numero e simbolo.");
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await bcrypt.hash(password, 12),
        accountType: "ADMIN",
        privacyAcceptedAt: new Date()
      }
    });
    console.log(`Conta de administrador criada para ${email}. Entre pelo login normal do app.`);
  }
} catch (error) {
  console.error(`Erro: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
