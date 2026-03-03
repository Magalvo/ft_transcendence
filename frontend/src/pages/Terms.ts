import { AbstractComponent } from '../core/Component';

export class TermsPage extends AbstractComponent {
  constructor() {
    super('section', 'min-h-screen bg-black py-12 px-4 sm:px-6 flex flex-col items-center font-sans');
  }

  public render(): void {
    this.element.innerHTML = `
      <div class="w-full max-w-4xl bg-[#111] border border-neutral-800 rounded-2xl shadow-[0_0_40px_rgba(0,255,255,0.05)] overflow-hidden flex flex-col mt-8">
        
        <div class="bg-[#0a0a0a] px-8 py-6 border-b border-neutral-800 flex justify-between items-end">
          <div>
            <h1 class="text-3xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500 uppercase tracking-wider">
              Terms & Conditions
            </h1>
            <p class="text-sm text-neutral-400 mt-2">Last updated: March 02, 2026</p>
          </div>
        </div>

        <div class="px-8 py-8 space-y-8 text-neutral-300 leading-relaxed max-h-[60vh] overflow-y-auto">
          
          <div>
            <p class="text-lg text-neutral-200 font-medium mb-4">Please read these terms and conditions carefully before using Our Service.</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              Interpretation and Definitions
            </h3>
            <p class="mb-2">The words whose initial letters are capitalized have meanings defined under the following conditions.</p>
            <ul class="list-disc pl-6 space-y-2 text-neutral-400 mt-4">
              <li><strong class="text-neutral-200">Application:</strong> means the software program provided by the Company downloaded by You on any electronic device, named Transcendence.</li>
              <li><strong class="text-neutral-200">Country:</strong> refers to Portugal.</li>
              <li><strong class="text-neutral-200">Company:</strong> refers to Transcendence.</li>
              <li><strong class="text-neutral-200">Service:</strong> refers to the Application.</li>
            </ul>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              Acknowledgment
            </h3>
            <p class="mb-2">These are the Terms and Conditions governing the use of this Service and the agreement between You and the Company. These Terms and Conditions set out the rights and obligations of all users regarding the use of the Service.</p>
            <p>Your access to and use of the Service is conditioned on Your acceptance of and compliance with these Terms and Conditions.</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              Termination
            </h3>
            <p>We may terminate or suspend Your access immediately, without prior notice or liability, for any reason whatsoever, including without limitation if You breach these Terms and Conditions.</p>
          </div>

          <div>
            <h3 class="text-xl font-bold text-white mb-3 flex items-center gap-2">
              <span class="w-2 h-6 bg-cyan-500 rounded-full inline-block"></span>
              Governing Law
            </h3>
            <p>The laws of the Country, excluding its conflicts of law rules, shall govern these Terms and Your use of the Service.</p>
          </div>

        </div>

      </div>
    `;
  }
}