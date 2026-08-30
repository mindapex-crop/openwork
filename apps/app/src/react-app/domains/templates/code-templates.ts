/**
 * Code template library for common project scaffolding
 * Provides starter templates for React, Node.js, Python, and other frameworks
 */

export interface CodeTemplate {
  id: string;
  name: string;
  description: string;
  language: string;
  files: Array<{ path: string; content: string }>;
}

const REACT_VITE_TEMPLATE: CodeTemplate = {
  id: "react-vite",
  name: "React + Vite",
  description: "Modern React app with Vite bundler, TypeScript, and Tailwind CSS",
  language: "typescript",
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-react-app",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.0",
    "@types/react-dom": "^18.2.0",
    "@vitejs/plugin-react": "^4.0.0",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.2.0",
    "vite": "^5.0.0"
  }
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
`,
    },
    {
      path: "tailwind.config.js",
      content: `/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
`,
    },
    {
      path: "src/main.tsx",
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: "src/App.tsx",
      content: `function App() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <h1 className="text-3xl font-bold text-gray-900">Hello, OpenWork!</h1>
    </div>
  )
}

export default App
`,
    },
    {
      path: "src/index.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;
`,
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OpenWork React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
  ],
};

const NODE_EXPRESS_TEMPLATE: CodeTemplate = {
  id: "node-express",
  name: "Node.js + Express API",
  description: "RESTful API server with Express, TypeScript, and Jest testing",
  language: "typescript",
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-api-server",
  "version": "1.0.0",
  "description": "",
  "main": "dist/server.js",
  "scripts": {
    "dev": "tsx watch src/server.ts",
    "build": "tsc",
    "start": "node dist/server.js",
    "test": "jest"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.0",
    "@types/jest": "^29.5.0",
    "jest": "^29.7.0",
    "tsx": "^4.6.0",
    "typescript": "^5.3.0"
  }
}
`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src/**/*"]
}
`,
    },
    {
      path: "src/server.ts",
      content: `import express, { Request, Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/message', (_req: Request, res: Response) => {
  res.json({ message: 'Hello from OpenWork API!' });
});

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});
`,
    },
    {
      path: ".env",
      content: `PORT=3000
NODE_ENV=development
`,
    },
  ],
};

const PYTHON_FASTAPI_TEMPLATE: CodeTemplate = {
  id: "python-fastapi",
  name: "Python FastAPI",
  description: "High-performance async API with FastAPI, Pydantic, and Uvicorn",
  language: "python",
  files: [
    {
      path: "requirements.txt",
      content: `fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
pytest==7.4.4
httpx==0.26.0
`,
    },
    {
      path: "main.py",
      content: `from fastapi import FastAPI
from pydantic import BaseModel
from datetime import datetime

app = FastAPI(title="OpenWork API")


class Message(BaseModel):
    content: str
    timestamp: str | None = None


@app.get("/health")
def health_check():
    return {"status": "ok", "timestamp": datetime.now().isoformat()}


@app.post("/api/message")
def create_message(message: Message):
    return {
        "message": message.content,
        "received_at": datetime.now().isoformat()
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
`,
    },
    {
      path: "README.md",
      content: `# FastAPI Project

## Setup

\`\`\`bash
pip install -r requirements.txt
\`\`\`

## Run

\`\`\`bash
python main.py
\`\`\`

## Test

\`\`\`bash
pytest
\`\`\`
`,
    },
  ],
};

export const CODE_TEMPLATES: CodeTemplate[] = [
  REACT_VITE_TEMPLATE,
  NODE_EXPRESS_TEMPLATE,
  PYTHON_FASTAPI_TEMPLATE,
];

export function getTemplateById(id: string): CodeTemplate | undefined {
  return CODE_TEMPLATES.find((t) => t.id === id);
}

export function listTemplates(): Pick<CodeTemplate, "id" | "name" | "description" | "language">[] {
  return CODE_TEMPLATES.map(({ id, name, description, language }) => ({
    id,
    name,
    description,
    language,
  }));
}
