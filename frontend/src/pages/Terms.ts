import { AbstractComponent } from "../core/Component";
import { t } from "../services/I18nService";

export class TermsPage extends AbstractComponent {
  constructor() {
    super("section", "min-h-screen bg-black px-4 py-12 sm:px-6 flex flex-col items-center font-sans");
  }

  public render(): void {
    this.element.innerHTML = `
      <div class="w-full max-w-4xl bg-[#111] border border-neutral-800 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.05)] overflow-hidden flex flex-col mt-8">
        <div class="bg-[#0a0a0a] px-8 py-6 border-b border-neutral-800 flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider">
              ${t("terms.title")}
            </h1>
            <p class="text-sm text-neutral-400 mt-2">${t("terms.lastUpdated")}</p>
          </div>
        </div>

        <div class="px-8 py-8 space-y-8 text-neutral-300 leading-relaxed max-h-[60vh] overflow-y-auto">
          <div>
            <p class="text-lg text-neutral-200 font-medium mb-4">${t("terms.intro")}</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("terms.section.interpretation")}
            </h3>
            <p class="mb-2">${t("terms.interpretationText")}</p>
            <ul class="list-disc pl-6 space-y-2 text-neutral-400 mt-4">
              <li><strong class="text-neutral-200">${t("terms.application")}</strong> ${t("terms.applicationText")}</li>
              <li><strong class="text-neutral-200">${t("terms.country")}</strong> ${t("terms.countryText")}</li>
              <li><strong class="text-neutral-200">${t("terms.company")}</strong> ${t("terms.companyText")}</li>
              <li><strong class="text-neutral-200">${t("terms.service")}</strong> ${t("terms.serviceText")}</li>
            </ul>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("terms.section.acknowledgment")}
            </h3>
            <p class="mb-2">${t("terms.acknowledgmentText1")}</p>
            <p>${t("terms.acknowledgmentText2")}</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("terms.section.termination")}
            </h3>
            <p>${t("terms.terminationText")}</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              ${t("terms.section.governingLaw")}
            </h3>
            <p>${t("terms.governingLawText")}</p>
          </div>
        </div>
      </div>
    `;
  }
}
