# ft_transcendence
Há coisas que transcendem a compreensão humana, como o facto de ser mais provável sermos atingidos por um relâmpago do que alguma vez ganharmos o Euromilhões. Pergunto-me se valerá a pena testar as probabilidades...


1º - npm install
Em 2 terminais separados
    No 1º - npm run server
    no 2º - npm run dev

Abrir no browser o link do 2º terminal

ft_transcendence/
├── .env                  # Environment variables (API keys, URLs) - DO NOT COMMIT [cite: 113]
├── .gitignore
├── Dockerfile            # Container definition [cite: 66]
├── docker-compose.yml    # Orchestration [cite: 66]
├── package.json          # Dependencies (Tailwind, TypeScript, Vite/Webpack)
├── tsconfig.json         # TypeScript configuration
├── tailwind.config.js    # Tailwind configuration (if using the module)
├── vite.config.ts        # Bundler config (Recommended over Webpack for speed)
└── src/                  # Source code
    ├── main.ts           # Entry point (initializes Router & App)
    ├── style.css         # Global styles & Tailwind directives
    ├── index.html        # Main HTML template (Root div)
    ├── assets/           # Static assets (images, fonts, 3D models)
    ├── core/             # Core architecture (The "Framework" you build)
    ├── components/       # Reusable UI elements
    ├── pages/            # Full page views
    ├── game/             # Pong Game Logic (Canvas/Math)
    ├── services/         # API & Socket communication
    ├── types/            # TypeScript interfaces
    └── utils/            # Helper functions