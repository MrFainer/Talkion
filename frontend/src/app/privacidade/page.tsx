import type { Metadata } from "next";
import LegalLayout from "@/components/legal/LegalLayout";

export const metadata: Metadata = {
  title: "Política de Privacidade — Talkion",
  description:
    "Como o Talkion coleta, usa, compartilha e protege os dados de professores e alunos, conforme a LGPD.",
  alternates: { canonical: "/privacidade" },
  robots: { index: true, follow: true },
};

export default function PrivacidadePage() {
  return (
    <LegalLayout
      titulo="Política de Privacidade"
      resumo="Esta política explica quais dados o Talkion trata, para quê, com quem compartilha e como você pode exercer os seus direitos. Ela vale para o site talkion.com.br e para o painel do professor."
    >
      <section>
        <h2>1. Quem trata os seus dados</h2>
        <p>
          O Talkion é uma plataforma que organiza a prática diária de idiomas pelo WhatsApp: envia o conteúdo
          do dia, aplica o quiz, recebe o áudio de speaking e devolve a correção. O tratamento dos dados
          descritos aqui é feito pelo próprio Talkion, na condição de controlador, nos termos da Lei
          13.709/2018 (LGPD).
        </p>
      </section>

      <section>
        <h2>2. Quais dados tratamos</h2>
        <ul>
          <li>
            <strong>Conta do professor:</strong> nome, e-mail, senha (armazenada apenas como hash), plano
            contratado, data de cadastro e código de indicação, quando houver.
          </li>
          <li>
            <strong>Dados dos alunos cadastrados pelo professor:</strong> nome, número de WhatsApp, idioma e
            nível. Esses dados são informados pelo professor, que é quem mantém a relação com o aluno.
          </li>
          <li>
            <strong>Conteúdo das interações:</strong> mensagens trocadas com o Talkion, respostas de quiz,
            áudios de speaking, transcrições e as correções geradas. Esse é o material usado para montar o
            histórico de evolução no painel.
          </li>
          <li>
            <strong>Pagamento:</strong> plano, status da assinatura e histórico de cobrança. Número completo
            de cartão não passa pelo Talkion — a cobrança é feita por um processador de pagamentos
            especializado.
          </li>
          <li>
            <strong>Registros de uso:</strong> acessos ao site e ao painel, com data, página visitada e
            código de indicação, para medir o funcionamento do produto e apurar problemas.
          </li>
        </ul>
      </section>

      <section>
        <h2>3. Para que usamos e com qual base legal</h2>
        <ul>
          <li>
            <strong>Executar o serviço contratado</strong> (enviar conteúdo, corrigir speaking, mostrar a
            evolução): execução de contrato, art. 7º, V da LGPD.
          </li>
          <li>
            <strong>Cobrar e manter a assinatura:</strong> execução de contrato e obrigações legais de
            registro.
          </li>
          <li>
            <strong>Segurança, prevenção a fraude e suporte:</strong> legítimo interesse, art. 7º, IX.
          </li>
          <li>
            <strong>Comunicações sobre o produto</strong> (aviso de mudança, novidade relevante): legítimo
            interesse, com opção de descadastro.
          </li>
        </ul>
        <p>
          O Talkion não vende dados pessoais e não usa o conteúdo das conversas dos alunos para publicidade.
        </p>
      </section>

      <section>
        <h2>4. Com quem compartilhamos</h2>
        <ul>
          <li>
            <strong>Infraestrutura de hospedagem e banco de dados:</strong> onde a aplicação e os dados ficam
            armazenados.
          </li>
          <li>
            <strong>Conexão com o WhatsApp:</strong> necessária para entregar as mensagens. O funcionamento
            depende das regras e da disponibilidade do WhatsApp, que não controlamos.
          </li>
          <li>
            <strong>Provedores de inteligência artificial:</strong> recebem o trecho de texto ou o áudio
            necessário para transcrever e corrigir, exclusivamente para gerar a resposta do aluno.
          </li>
          <li>
            <strong>Processador de pagamentos:</strong> para cobrar a assinatura e emitir o recibo.
          </li>
          <li>
            <strong>Serviço de verificação de cadastro e envio de e-mail:</strong> proteção contra cadastros
            automatizados e entrega do e-mail de confirmação.
          </li>
        </ul>
        <p>
          Também podemos compartilhar dados por determinação legal ou ordem judicial. Alguns desses
          fornecedores tratam dados fora do Brasil; nesses casos a transferência segue o art. 33 da LGPD, com
          cláusulas contratuais de proteção de dados.
        </p>
      </section>

      <section>
        <h2>5. Por quanto tempo guardamos</h2>
        <p>
          Os dados da conta e o histórico de prática ficam armazenados enquanto a conta existir. Ao pedir o
          encerramento, os dados são eliminados ou anonimizados, salvo o que a lei obriga a manter — por
          exemplo, registros fiscais de cobrança, que são guardados pelo prazo legal.
        </p>
      </section>

      <section>
        <h2>6. Seus direitos</h2>
        <p>
          A qualquer momento você pode pedir: confirmação de que tratamos seus dados; acesso aos dados;
          correção de dados incompletos ou desatualizados; anonimização, bloqueio ou eliminação de dados
          desnecessários; portabilidade; informação sobre compartilhamentos; e revogação de consentimento.
        </p>
        <p>
          Para o aluno, o caminho natural é o professor que o cadastrou, porque é ele quem mantém os dados no
          painel. Se o pedido chegar direto ao Talkion, ele é encaminhado e atendido no mesmo prazo.
        </p>
      </section>

      <section>
        <h2>7. Segurança</h2>
        <p>
          O acesso ao painel exige senha (guarda apenas em hash) e as conexões usam HTTPS. O acesso ao banco
          de dados é restrito à operação da plataforma e as credenciais ficam isoladas do código. Nenhum
          sistema é imune a incidentes; se ocorrer um incidente relevante, comunicamos os titulares afetados e
          a ANPD, conforme o art. 48 da LGPD.
        </p>
      </section>

      <section>
        <h2>8. Cookies</h2>
        <p>
          Usamos cookies essenciais: o de sessão, que mantém você autenticado, e o de indicação
          (<code>affiliate_ref</code>), que registra por 24 horas o código de quem indicou o Talkion para
          creditar a indicação. Não usamos cookies de publicidade nesta página.
        </p>
      </section>

      <section>
        <h2>9. Alunos menores de idade</h2>
        <p>
          Muitos alunos de idiomas são crianças e adolescentes. O cadastro é feito pelo professor ou pela
          escola, que declara ter autorização de quem é responsável pelo aluno para usar o serviço. Ao
          cadastrar um menor, use apenas os dados necessários (nome, WhatsApp, idioma e nível) e mantenha a
          autorização documentada.
        </p>
      </section>

      <section>
        <h2>10. Alterações desta política</h2>
        <p>
          Se o texto mudar de forma relevante, avisamos no painel ou por e-mail antes de a mudança valer. A
          data de atualização no topo indica a última revisão.
        </p>
      </section>
    </LegalLayout>
  );
}
