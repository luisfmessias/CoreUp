import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { legal } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Politica de Privacidade | CoreUp",
  description: "Como o CoreUp coleta, usa e protege os seus dados"
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh px-4 py-8">
      <main className="glass-strong mx-auto w-full max-w-[680px] rounded-3xl p-6 md:p-10">
        <Link className="text-sm font-medium text-accent transition hover:text-accent-strong" href="/">
          ← Voltar ao CoreUp
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight">Política de Privacidade</h1>
        <p className="mt-2 text-sm text-white/50">Última atualização: {legal.policyUpdatedAt}</p>

        <Section title="1. Quem somos">
          <p>
            O CoreUp é um aplicativo que monta a sua rotina semanal de treino e acompanha a sua evolução. Esta política
            explica quais dados pessoais tratamos, por que, com quem compartilhamos e como você exerce os seus direitos,
            conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018, LGPD).
          </p>
          <p>
            Para qualquer assunto sobre os seus dados, fale com o responsável pelo CoreUp pelo e-mail{" "}
            <Email />.
          </p>
        </Section>

        <Section title="2. Dados que coletamos">
          <ul>
            <li>
              <strong>Dados de cadastro:</strong> nome e e-mail. A senha nunca é guardada em texto: armazenamos apenas
              uma versão criptografada (hash) que não pode ser revertida.
            </li>
            <li>
              <strong>Dados de saúde:</strong> altura, peso e percentual de gordura, quando você os informa. A LGPD
              classifica esses dados como sensíveis.
            </li>
            <li>
              <strong>Dados de uso do app:</strong> plano de treino, preferências do gerador (objetivo, nível, dias,
              tempo, equipamentos), exercícios favoritos e registros de treinos realizados.
            </li>
            <li>
              <strong>Dados de segurança:</strong> endereço IP e e-mail usados em tentativas de login e cadastro,
              guardados por pouco tempo apenas para bloquear tentativas abusivas.
            </li>
          </ul>
          <p>
            O CoreUp não usa cookies de publicidade nem ferramentas de rastreamento. O seu navegador guarda apenas um
            token de sessão para manter você conectado.
          </p>
        </Section>

        <Section title="3. Para que usamos e com qual base legal">
          <ul>
            <li>
              <strong>Criar e manter a sua conta e gerar o seu treino:</strong> execução do serviço que você contratou
              (art. 7º, V).
            </li>
            <li>
              <strong>Dados de saúde:</strong> usados somente para exibir a sua evolução, com o seu consentimento
              específico e destacado, dado no cadastro (art. 11, I). Você pode revogá-lo a qualquer momento excluindo
              a conta.
            </li>
            <li>
              <strong>Segurança da conta e prevenção de fraudes:</strong> legítimo interesse (art. 7º, IX).
            </li>
          </ul>
          <p>Não vendemos os seus dados e não os usamos para publicidade.</p>
        </Section>

        <Section title="4. Com quem compartilhamos">
          <p>Os dados são processados apenas pelos fornecedores necessários para o app funcionar:</p>
          <ul>
            <li>
              <strong>Vercel Inc.:</strong> hospedagem do aplicativo. É uma empresa dos Estados Unidos, então pode
              haver transferência internacional de dados, feita com as garantias exigidas pela LGPD (art. 33).
            </li>
            <li>
              <strong>Neon:</strong> banco de dados onde as informações ficam armazenadas, em servidores localizados
              em São Paulo.
            </li>
          </ul>
          <p>Também poderemos compartilhar dados quando a lei ou uma ordem judicial exigir.</p>
        </Section>

        <Section title="5. Por quanto tempo guardamos">
          <p>
            Os seus dados ficam guardados enquanto a sua conta existir. Quando você exclui a conta, todos os dados
            ligados a ela (cadastro, medidas, planos, histórico e sessões) são apagados do banco de dados na hora.
            Cópias de segurança automáticas do provedor podem manter esses dados por um curto período adicional, até
            serem substituídas.
          </p>
        </Section>

        <Section title="6. Os seus direitos">
          <p>
            Pela LGPD (art. 18), você pode pedir a confirmação de que tratamos os seus dados, acesso a eles, correção,
            anonimização, portabilidade, informações sobre compartilhamento, revogação do consentimento e eliminação.
          </p>
          <ul>
            <li>
              <strong>Excluir a conta:</strong> no próprio app, na aba Evolução, em &quot;Conta&quot;.
            </li>
            <li>
              <strong>Demais pedidos:</strong> pelo e-mail <Email />. Respondemos em até 15 dias.
            </li>
          </ul>
          <p>Você também pode registrar reclamação na Autoridade Nacional de Proteção de Dados (ANPD).</p>
        </Section>

        <Section title="7. Segurança">
          <p>
            Usamos conexão criptografada (HTTPS) entre o app e os servidores e entre os servidores e o banco de dados,
            guardamos senhas apenas como hash e limitamos tentativas de login para dificultar ataques. Nenhum sistema é
            totalmente imune a falhas; se ocorrer um incidente que possa trazer risco a você, avisaremos você e a ANPD.
          </p>
        </Section>

        <Section title="8. Menores de idade">
          <p>O CoreUp não é direcionado a menores de 18 anos.</p>
        </Section>

        <Section title="9. Mudanças nesta política">
          <p>
            Se esta política mudar, a data no topo da página será atualizada. Mudanças importantes serão avisadas no
            próprio app.
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 space-y-3 text-[15px] leading-relaxed text-white/70 [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-accent/70 [&_strong]:font-semibold [&_strong]:text-white [&_ul]:space-y-2">
      <h2 className="text-lg font-semibold text-white">{title}</h2>
      {children}
    </section>
  );
}

function Email() {
  return (
    <a className="font-medium text-accent underline underline-offset-2" href={`mailto:${legal.contactEmail}`}>
      {legal.contactEmail}
    </a>
  );
}
