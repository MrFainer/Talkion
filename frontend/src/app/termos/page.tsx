import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Termos de Uso — Talkion",
  description:
    "Regras de uso da plataforma Talkion: cadastro, planos e créditos, cancelamento, uso aceitável e responsabilidades.",
  alternates: { canonical: "/termos" },
  robots: { index: true, follow: true },
};

export default function TermosPage() {
  return (
    <LegalLayout
      titulo="Termos de Uso"
      resumo="Estes termos valem para o uso do Talkion por professores, escolas e cursos de idiomas. Ao criar uma conta, você concorda com o que está aqui."
    >
      <section>
        <h2>1. O que é o Talkion</h2>
        <p>
          O Talkion é um serviço de software que organiza a prática diária de idiomas pelo WhatsApp. Ele envia
          o conteúdo do dia, aplica o quiz, recebe o áudio de speaking do aluno e devolve a correção, além de
          mostrar a evolução no painel do professor. O Talkion é uma ferramenta de apoio: a condução
          pedagógica e a relação com o aluno continuam sendo do professor.
        </p>
      </section>

      <section>
        <h2>2. Cadastro e conta</h2>
        <ul>
          <li>É preciso ter 18 anos ou mais e capacidade civil para contratar.</li>
          <li>Os dados informados devem ser verdadeiros e atualizados; o e-mail precisa ser confirmado.</li>
          <li>
            A senha é pessoal e intransferível. Você é responsável pelas ações feitas com a sua conta e deve
            avisar o Talkion em caso de uso indevido.
          </li>
          <li>
            Uma conta pode ser usada por uma pessoa; o uso por equipe exige o plano que prevê mais professores.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Planos, créditos e pagamento</h2>
        <ul>
          <li>
            Os planos, limites de alunos e valores vigentes estão na{" "}
            <a href="/#plans">tabela de planos</a>; prevalece o valor exibido no momento da contratação.
          </li>
          <li>
            Os recursos de inteligência artificial consomem créditos. Os créditos do plano são renovados a cada
            ciclo; pacotes extras comprados à parte não expiram.
          </li>
          <li>
            A assinatura é mensal e renovada automaticamente até que você cancele. A cobrança é processada por
            um provedor de pagamentos; a nota ou recibo é emitida por ele.
          </li>
          <li>
            Alunos acima do limite do plano são cobrados por aluno adicional, conforme o valor informado na
            contratação.
          </li>
          <li>Mudança de plano é proporcional aos dias restantes do ciclo em curso.</li>
        </ul>
      </section>

      <section>
        <h2>4. Cancelamento e direito de arrependimento</h2>
        <p>
          Você pode cancelar a assinatura a qualquer momento no painel; o acesso pago continua até o fim do
          ciclo já pago e não há nova cobrança. Nas contratações feitas pela internet, o Código de Defesa do
          Consumidor (art. 49) garante o direito de desistir em até 7 dias corridos da compra, com devolução do
          valor pago. Para exercer, basta pedir pelo canal de contato informado no site.
        </p>
        <p>
          O plano gratuito não tem prazo de validade e não exige cartão de crédito.
        </p>
      </section>

      <section>
        <h2>5. Uso aceitável</h2>
        <p>Ao usar o Talkion, você concorda em não:</p>
        <ul>
          <li>enviar mensagens em massa a pessoas que não são seus alunos ou que não esperam o contato;</li>
          <li>usar a plataforma para conteúdo ilegal, ofensivo, discriminatório ou que viole direitos de terceiros;</li>
          <li>tentar acessar áreas, dados ou contas de outros usuários;</li>
          <li>copiar, revender ou explorar comercialmente a plataforma sem autorização.</li>
        </ul>
        <p>
          O descumprimento pode levar à suspensão da conta, com aviso quando possível, sem prejuízo das medidas
          legais cabíveis.
        </p>
      </section>

      <section>
        <h2>6. Responsabilidade sobre os dados dos alunos</h2>
        <p>
          O professor ou a escola que cadastra alunos é responsável por ter base legal para isso — inclusive
          autorização de pais ou responsáveis, quando o aluno for menor de idade — e por manter esses dados
          corretos. O Talkion trata esses dados conforme a{" "}
          <a href="/privacidade">Política de Privacidade</a> e apenas para prestar o serviço.
        </p>
      </section>

      <section>
        <h2>7. Conteúdo gerado por inteligência artificial</h2>
        <p>
          As correções, transcrições e sugestões são geradas automaticamente e podem conter erros. Elas não
          substituem a avaliação do professor. Recomendamos revisar o feedback antes de usar o conteúdo como
          avaliação formal do aluno.
        </p>
      </section>

      <section>
        <h2>8. WhatsApp e serviços de terceiros</h2>
        <p>
          A entrega das mensagens depende do WhatsApp e de provedores de infraestrutura, que têm regras e
          disponibilidade próprias. O Talkion não controla essas plataformas e não responde por bloqueios,
          mudanças de política ou indisponibilidades originadas nelas, mas trabalha para restabelecer o serviço
          o quanto antes.
        </p>
      </section>

      <section>
        <h2>9. Propriedade intelectual</h2>
        <p>
          O software, a marca, os textos e os materiais do Talkion pertencem ao Talkion. O conteúdo que você
          cadastra (dados da turma, materiais próprios) continua seu, e você autoriza o uso apenas para operar
          o serviço.
        </p>
      </section>

      <section>
        <h2>10. Disponibilidade e limite de responsabilidade</h2>
        <p>
          Trabalhamos para manter o serviço disponível, mas ele pode passar por manutenções programadas ou
          interrupções pontuais. Na medida permitida pela lei, o Talkion não responde por lucros cessantes ou
          danos indiretos decorrentes de indisponibilidade, e a responsabilidade total fica limitada ao valor
          pago nos 12 meses anteriores ao evento. Nada aqui afasta direitos do consumidor previstos em lei.
        </p>
      </section>

      <section>
        <h2>11. Alterações destes termos</h2>
        <p>
          Podemos ajustar estes termos para refletir mudanças no produto ou na lei. Mudanças relevantes são
          avisadas no painel ou por e-mail antes de valerem; continuar usando o serviço depois disso significa
          concordar com a versão vigente.
        </p>
      </section>

      <section>
        <h2>12. Legislação e foro</h2>
        <p>
          Estes termos seguem a legislação brasileira. Fica eleito o foro do domicílio do usuário consumidor
          para resolver eventuais controvérsias, sem prejuízo de solução amigável pelo canal de contato.
        </p>
      </section>
    </LegalLayout>
  );
}
