import { AbstractComponent } from "../core/Component";
import { i18n, t } from "../services/I18nService";

const privacyContent = {
  en: {
    interpretation:
      "The words whose initial letters are capitalized have meanings defined below. The same definitions apply whether they appear in singular or plural form.",
    definitions: [
      { label: "Account", text: "A unique account created for you to access the service and its features." },
      { label: "Application", text: "Transcendence, the software platform provided by the company." },
      { label: "Company", text: 'Transcendence, also referred to as "we", "us", or "our".' },
      { label: "Country", text: "Portugal." },
      { label: "Personal Data", text: "Any information that relates to an identified or identifiable person." },
      { label: "Service", text: "The Transcendence application and related features." },
    ],
    personalData:
      "While using the service, we may collect information you provide directly, such as account details, profile data, and support communications.",
    usageData:
      "We may also collect technical and usage information automatically, including device data, browser details, IP address, visited pages, and timestamps needed for security, diagnostics, and product improvement.",
    applicationInfo:
      "If you choose to use optional features such as avatar uploads, we may request access to images or files from your device. You can manage these permissions through your device settings.",
    usePersonalData: [
      "Provide, operate, and maintain the service.",
      "Manage your account, authentication, and game-related features.",
      "Communicate with you about updates, support, and security issues.",
      "Improve reliability, moderation, and the overall player experience.",
      "Comply with legal obligations and protect the platform from abuse.",
    ],
    retention:
      "We retain personal data only for as long as necessary to provide the service, meet legal obligations, resolve disputes, and enforce our policies. When appropriate, data may be deleted, aggregated, or anonymized.",
    transfer:
      "Your data may be processed in the locations where we or our service providers operate. When required, we apply reasonable safeguards for international transfers.",
    delete:
      "You may request access to, correction of, or deletion of your personal data. Some information may be retained when we are legally required or otherwise permitted to do so.",
    businessTransactions:
      "If the company is involved in a merger, acquisition, or asset sale, personal data may be transferred as part of that transaction.",
    lawEnforcement:
      "We may disclose personal data when required by law or in response to valid requests from public authorities.",
    otherLegal:
      "We may also disclose information to protect our rights, investigate misuse, prevent harm, or defend against legal claims.",
    security:
      "We work to protect personal data with reasonable technical and organizational measures, but no transmission or storage method is completely secure.",
    children:
      "The service is not directed to children under 16, and we do not knowingly collect personal data from them without the required consent.",
    links:
      "The service may contain links to third-party websites. We are not responsible for their content or privacy practices, and we encourage you to review their policies.",
    changes:
      "We may update this Privacy Policy from time to time. When we do, we will post the updated version on this page and revise the last updated date.",
  },
  pt: {
    interpretation:
      "As palavras com inicial maiuscula tem os significados definidos abaixo. As mesmas definicoes aplicam-se tanto no singular como no plural.",
    definitions: [
      { label: "Conta", text: "Uma conta unica criada para acederes ao servico e respetivas funcionalidades." },
      { label: "Aplicacao", text: "Transcendence, a plataforma de software fornecida pela empresa." },
      { label: "Empresa", text: 'Transcendence, tambem referida como "nos", "nosso" ou "nossa".' },
      { label: "Pais", text: "Portugal." },
      { label: "Dados Pessoais", text: "Qualquer informacao relacionada com uma pessoa identificada ou identificavel." },
      { label: "Servico", text: "A aplicacao Transcendence e as funcionalidades associadas." },
    ],
    personalData:
      "Ao utilizares o servico, podemos recolher informacoes fornecidas diretamente por ti, como dados de conta, dados de perfil e comunicacoes de suporte.",
    usageData:
      "Tambem podemos recolher automaticamente informacoes tecnicas e de utilizacao, incluindo dados do dispositivo, navegador, endereco IP, paginas visitadas e datas necessarias para seguranca, diagnostico e melhoria do produto.",
    applicationInfo:
      "Se optares por usar funcionalidades opcionais, como carregamento de avatar, podemos pedir acesso a imagens ou ficheiros do teu dispositivo. Podes gerir estas permissoes nas definicoes do teu dispositivo.",
    usePersonalData: [
      "Fornecer, operar e manter o servico.",
      "Gerir a tua conta, autenticacao e funcionalidades relacionadas com o jogo.",
      "Comunicar contigo sobre atualizacoes, suporte e questoes de seguranca.",
      "Melhorar a fiabilidade, moderacao e experiencia geral dos jogadores.",
      "Cumprir obrigacoes legais e proteger a plataforma contra abuso.",
    ],
    retention:
      "Conservamos dados pessoais apenas durante o tempo necessario para prestar o servico, cumprir obrigacoes legais, resolver disputas e aplicar as nossas politicas. Quando adequado, os dados podem ser eliminados, agregados ou anonimizados.",
    transfer:
      "Os teus dados podem ser processados nos locais onde nos ou os nossos prestadores operam. Quando exigido, aplicamos salvaguardas razoaveis para transferencias internacionais.",
    delete:
      "Podes pedir acesso, correcao ou eliminacao dos teus dados pessoais. Algumas informacoes podem ser conservadas quando somos legalmente obrigados ou autorizados a faze-lo.",
    businessTransactions:
      "Se a empresa estiver envolvida numa fusao, aquisicao ou venda de ativos, os dados pessoais podem ser transferidos como parte dessa operacao.",
    lawEnforcement:
      "Podemos divulgar dados pessoais quando isso for exigido por lei ou em resposta a pedidos validos de autoridades publicas.",
    otherLegal:
      "Tambem podemos divulgar informacoes para proteger os nossos direitos, investigar abusos, prevenir danos ou defender-nos de reclamacoes legais.",
    security:
      "Trabalhamos para proteger os dados pessoais com medidas tecnicas e organizacionais razoaveis, mas nenhum metodo de transmissao ou armazenamento e totalmente seguro.",
    children:
      "O servico nao e dirigido a menores de 16 anos e nao recolhemos conscientemente dados pessoais desses utilizadores sem o consentimento exigido.",
    links:
      "O servico pode conter links para websites de terceiros. Nao somos responsaveis pelo respetivo conteudo nem pelas suas praticas de privacidade, e recomendamos que leias as suas politicas.",
    changes:
      "Podemos atualizar esta Politica de Privacidade periodicamente. Quando isso acontecer, publicaremos a versao atualizada nesta pagina e reveremos a data da ultima atualizacao.",
  },
} as const;

export class PrivacyPage extends AbstractComponent {
  constructor() {
    super("section", "min-h-screen bg-black px-4 py-12 sm:px-6 flex flex-col items-center font-sans");
  }

  public render(): void {
    const content =
      privacyContent[i18n.getLocale() as keyof typeof privacyContent] ??
      privacyContent.en;
    const definitionItems = content.definitions
      .map(
        (item) =>
          `<li><strong class="text-neutral-200">${item.label}:</strong> ${item.text}</li>`
      )
      .join("");
    const useItems = content.usePersonalData
      .map((item) => `<li>${item}</li>`)
      .join("");

    this.element.innerHTML = `
      <div class="w-full max-w-4xl bg-[#111] border border-neutral-800 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.05)] overflow-hidden flex flex-col mt-8">
        <div class="bg-[#0a0a0a] px-8 py-6 border-b border-neutral-800 flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider">
              ${t("privacy.title")}
            </h1>
            <p class="text-sm text-neutral-400 mt-2">${t("privacy.lastUpdated")}</p>
          </div>
        </div>

        <div class="px-8 py-8 text-neutral-300 leading-relaxed max-h-[60vh] overflow-y-auto">
          <div class="mb-8">
            <p class="mb-4">${t("privacy.intro1")}</p>
            <p class="mb-4">
              ${t("privacy.intro2Prefix")}
              <a href="https://www.termsfeed.com/privacy-policy-generator/" target="_blank" rel="noreferrer" class="text-cyan-400 hover:text-cyan-300 underline">
                ${t("privacy.intro2Link")}
              </a>
              ${t("privacy.intro2Suffix")}
            </p>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.interpretation")}
            </h2>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-4">${t("privacy.subsection.interpretation")}</h3>
            <p class="mb-4">${content.interpretation}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.definitions")}</h3>
            <p class="mb-2">${t("privacy.definitionsIntro")}</p>
            <ul class="list-disc pl-6 space-y-3 text-neutral-400 mb-4">${definitionItems}</ul>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.collecting")}
            </h2>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-4">${t("privacy.subsection.typesCollected")}</h3>

            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-4">${t("privacy.subsection.personalData")}</h4>
            <p class="mb-4">${content.personalData}</p>

            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-4">${t("privacy.subsection.usageData")}</h4>
            <p class="mb-4">${content.usageData}</p>

            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-4">${t("privacy.subsection.applicationInfo")}</h4>
            <p class="mb-4">${content.applicationInfo}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.usePersonalData")}</h3>
            <ul class="list-disc pl-6 space-y-2 text-neutral-400 mb-4">${useItems}</ul>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.retention")}</h3>
            <p class="mb-4">${content.retention}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.transfer")}</h3>
            <p class="mb-4">${content.transfer}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.delete")}</h3>
            <p class="mb-4">${content.delete}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.disclosure")}</h3>
            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-2">${t("privacy.subsection.businessTransactions")}</h4>
            <p class="mb-4">${content.businessTransactions}</p>

            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-2">${t("privacy.subsection.lawEnforcement")}</h4>
            <p class="mb-4">${content.lawEnforcement}</p>

            <h4 class="text-base font-semibold text-neutral-200 mb-2 mt-2">${t("privacy.subsection.otherLegal")}</h4>
            <p class="mb-4">${content.otherLegal}</p>

            <h3 class="text-lg font-semibold text-cyan-300 mb-2 mt-6">${t("privacy.subsection.security")}</h3>
            <p class="mb-4">${content.security}</p>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.children")}
            </h2>
            <p class="mb-4">${content.children}</p>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.links")}
            </h2>
            <p class="mb-4">${content.links}</p>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.changes")}
            </h2>
            <p class="mb-4">${content.changes}</p>
          </div>

          <div class="mb-8">
            <h2 class="text-xl font-bold text-white mb-4 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("privacy.section.contact")}
            </h2>
            <p class="mb-2">${t("privacy.contactIntro")}</p>
            <ul class="list-disc pl-6 space-y-1 text-neutral-400 mb-4">
              <li>${t("privacy.contactEmailLabel")} <a href="mailto:office@mail.com" class="text-cyan-400 hover:text-cyan-300 hover:underline transition">office@mail.com</a></li>
            </ul>
          </div>
        </div>

        <div class="bg-[#0a0a0a] px-8 py-5 border-t border-neutral-800 flex justify-end">
          <button id="btn-go-back" class="group relative px-6 py-2 bg-neutral-800 hover:bg-neutral-700 text-white font-semibold rounded-lg transition-all duration-300 border border-neutral-700 hover:border-cyan-500 overflow-hidden">
            <span class="relative z-10 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5 transition-transform group-hover:-translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              ${t("privacy.goBack")}
            </span>
          </button>
        </div>
      </div>
    `;

    const btnGoBack = this.element.querySelector("#btn-go-back");
    if (btnGoBack) {
      btnGoBack.addEventListener("click", () => {
        if (window.history.length > 1) {
          window.history.back();
        } else {
          window.history.pushState({}, "", "/");
          window.dispatchEvent(new PopStateEvent("popstate"));
        }
      });
    }
  }
}
