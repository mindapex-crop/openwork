/**
 * Code Templates Library - Framework starter templates for code generation.
 * 
 * Pure TypeScript module (no React dependencies) providing template metadata
 * and file generation functions. Easy to extend by adding new entries to
 * TEMPLATES array.
 */

export interface TemplateFile {
  path: string;
  content: string;
}

export interface TemplateDefinition {
  id: string;
  name: string;
  description: string;
  techStack: string[];
  icon: string;
  files: TemplateFile[];
  dependencies: string[];
  devDependencies?: string[];
}

// ============================================================================
// Template Definitions
// ============================================================================

const REACT_VITE_TEMPLATE: TemplateDefinition = {
  id: "react-vite",
  name: "React + TypeScript + Vite",
  description: "React SPA with Tailwind CSS, shadcn/ui setup, and component structure",
  techStack: ["React", "TypeScript", "Vite", "Tailwind CSS"],
  icon: "⚛️",
  dependencies: [
    "react",
    "react-dom",
    "@radix-ui/react-slot",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ],
  devDependencies: [
    "@types/react",
    "@types/react-dom",
    "@vitejs/plugin-react",
    "autoprefixer",
    "postcss",
    "tailwindcss",
    "typescript",
    "vite",
  ],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-react-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "@vitejs/plugin-react": "^4.2.1",
    "autoprefixer": "^10.4.16",
    "postcss": "^8.4.32",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.3.3",
    "vite": "^5.0.10"
  }
}`,
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
}`,
    },
    {
      path: "tsconfig.node.json",
      content: `{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})`,
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
}`,
    },
    {
      path: "postcss.config.js",
      content: `export default {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    },
    {
      path: "index.html",
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My React App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>`,
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
)`,
    },
    {
      path: "src/index.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`,
    },
    {
      path: "src/App.tsx",
      content: `import { useState } from 'react'
import { Button } from './components/ui/button'

function App() {
  const [count, setCount] = useState(0)

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center space-y-4">
        <h1 className="text-4xl font-bold">Welcome to Your React App</h1>
        <p className="text-muted-foreground">
          Start building by editing{' '}
          <code className="bg-muted px-1 rounded">src/App.tsx</code>
        </p>
        <div className="space-x-2">
          <Button onClick={() => setCount((c) => c + 1)}>
            Count is {count}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default App`,
    },
    {
      path: "src/lib/utils.ts",
      content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`,
    },
    {
      path: "src/components/ui/button.tsx",
      content: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`,
    },
  ],
};

const NODE_EXPRESS_TEMPLATE: TemplateDefinition = {
  id: "node-express",
  name: "Node.js + Express + TypeScript",
  description: "REST API boilerplate with routing, middleware, and error handling",
  techStack: ["Node.js", "Express", "TypeScript"],
  icon: "🚀",
  dependencies: [
    "express",
    "cors",
    "helmet",
    "dotenv",
    "zod",
  ],
  devDependencies: [
    "@types/express",
    "@types/cors",
    "@types/node",
    "typescript",
    "tsx",
    "nodemon",
  ],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-api",
  "version": "0.1.0",
  "description": "REST API with Express and TypeScript",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1",
    "zod": "^3.22.4"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cors": "^2.8.17",
    "@types/node": "^20.10.6",
    "typescript": "^5.3.3",
    "tsx": "^4.7.0",
    "nodemon": "^3.0.2"
  }
}`,
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
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}`,
    },
    {
      path: ".env.example",
      content: `PORT=3000
NODE_ENV=development`,
    },
    {
      path: "src/index.ts",
      content: `import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { router } from './routes';
import { errorHandler } from './middleware/error-handler';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api', router);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

app.listen(PORT, () => {
  console.log(\`Server running on http://localhost:\${PORT}\`);
});

export default app;`,
    },
    {
      path: "src/routes/index.ts",
      content: `import { Router } from 'express';
import { exampleRouter } from './example';

export const router = Router();

// Mount routes
router.use('/example', exampleRouter);

// Example endpoint
router.get('/', (_req, res) => {
  res.json({ message: 'API is running', version: '1.0.0' });
});`,
    },
    {
      path: "src/routes/example.ts",
      content: `import { Router } from 'express';
import { z } from 'zod';

const router = Router();

const exampleSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
});

router.get('/', (_req, res) => {
  res.json({ 
    message: 'Example endpoint',
    data: [
      { id: 1, name: 'Item 1' },
      { id: 2, name: 'Item 2' },
    ]
  });
});

router.post('/', (req, res) => {
  try {
    const validated = exampleSchema.parse(req.body);
    res.status(201).json({ 
      message: 'Created successfully',
      data: validated 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ 
        message: 'Validation failed',
        errors: error.errors 
      });
    } else {
      throw error;
    }
  }
});

export { router as exampleRouter };`,
    },
    {
      path: "src/middleware/error-handler.ts",
      content: `import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: ApiError,
  _req: Request,
  res: Response,
  _next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  console.error('Error:', err);

  res.status(statusCode).json({
    success: false,
    error: {
      message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
    },
  });
};`,
    },
  ],
};

const PYTHON_FASTAPI_TEMPLATE: TemplateDefinition = {
  id: "python-fastapi",
  name: "Python + FastAPI",
  description: "Async API with Pydantic models, CORS setup, and dependency injection",
  techStack: ["Python", "FastAPI", "Pydantic", "Uvicorn"],
  icon: "⚡",
  dependencies: [
    "fastapi",
    "uvicorn[standard]",
    "pydantic",
    "python-dotenv",
  ],
  devDependencies: [
    "pytest",
    "httpx",
  ],
  files: [
    {
      path: "requirements.txt",
      content: `fastapi==0.109.0
uvicorn[standard]==0.27.0
pydantic==2.5.3
python-dotenv==1.0.0`,
    },
    {
      path: "requirements-dev.txt",
      content: `-r requirements.txt
pytest==7.4.4
httpx==0.26.0`,
    },
    {
      path: ".env.example",
      content: `APP_NAME=My FastAPI App
DEBUG=True
PORT=8000`,
    },
    {
      path: "main.py",
      content: `from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import os
from dotenv import load_dotenv

load_dotenv()

from api.routes import router as api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events."""
    # Startup
    print(f"Starting {os.getenv('APP_NAME', 'FastAPI App')}")
    yield
    # Shutdown
    print("Shutting down application")


app = FastAPI(
    title=os.getenv("APP_NAME", "My FastAPI App"),
    description="REST API with FastAPI",
    version="0.1.0",
    lifespan=lifespan,
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Configure appropriately for production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(api_router, prefix="/api")


@app.get("/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "version": "0.1.0"}


if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", "8000"))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)`,
    },
    {
      path: "api/__init__.py",
      content: `# API package`,
    },
    {
      path: "api/routes.py",
      content: `from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, EmailStr
from typing import List

router = APIRouter()


class Item(BaseModel):
    """Example item model."""
    id: int
    name: str
    description: str | None = None


class ItemCreate(BaseModel):
    """Request model for creating items."""
    name: str
    description: str | None = None
    
    class Config:
        json_schema_extra = {
            "example": {
                "name": "Example Item",
                "description": "This is an example item"
            }
        }


@router.get("/items", response_model=List[Item])
def get_items():
    """Get all items."""
    return [
        Item(id=1, name="Item 1", description="First item"),
        Item(id=2, name="Item 2", description="Second item"),
    ]


@router.get("/items/{item_id}", response_model=Item)
def get_item(item_id: int):
    """Get a specific item by ID."""
    if item_id not in [1, 2]:
        raise HTTPException(status_code=404, detail="Item not found")
    
    return Item(id=item_id, name=f"Item {item_id}")


@router.post("/items", response_model=Item, status_code=201)
def create_item(item: ItemCreate):
    """Create a new item."""
    # In a real app, save to database
    return Item(id=3, name=item.name, description=item.description)`,
    },
    {
      path: "tests/__init__.py",
      content: `# Tests package`,
    },
    {
      path: "tests/test_main.py",
      content: `from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health_check():
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_get_items():
    """Test getting all items."""
    response = client.get("/api/items")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 2


def test_get_item():
    """Test getting a specific item."""
    response = client.get("/api/items/1")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == 1


def test_get_item_not_found():
    """Test getting non-existent item."""
    response = client.get("/api/items/999")
    assert response.status_code == 404


def test_create_item():
    """Test creating a new item."""
    payload = {
        "name": "Test Item",
        "description": "A test item"
    }
    response = client.post("/api/items", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == "Test Item"`,
    },
  ],
};

const NEXTJS_TEMPLATE: TemplateDefinition = {
  id: "nextjs-app-router",
  name: "Next.js App Router",
  description: "Full-stack app with server actions, API routes, and Tailwind CSS",
  techStack: ["Next.js", "React", "TypeScript", "Tailwind CSS"],
  icon: "▲",
  dependencies: [
    "next",
    "react",
    "react-dom",
    "@radix-ui/react-slot",
    "class-variance-authority",
    "clsx",
    "tailwind-merge",
  ],
  devDependencies: [
    "@types/node",
    "@types/react",
    "@types/react-dom",
    "typescript",
    "tailwindcss",
    "postcss",
    "autoprefixer",
  ],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-nextjs-app",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.1.0",
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "@radix-ui/react-slot": "^1.0.2",
    "class-variance-authority": "^0.7.0",
    "clsx": "^2.1.0",
    "tailwind-merge": "^2.2.0"
  },
  "devDependencies": {
    "@types/node": "^20.10.6",
    "@types/react": "^18.2.43",
    "@types/react-dom": "^18.2.17",
    "typescript": "^5.3.3",
    "tailwindcss": "^3.4.0",
    "postcss": "^8.4.32",
    "autoprefixer": "^10.4.16"
  }
}`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}`,
    },
    {
      path: "next.config.js",
      content: `/** @type {import('next').NextConfig} */
const nextConfig = {
  /* config options here */
}

module.exports = nextConfig`,
    },
    {
      path: "tailwind.config.ts",
      content: `import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
export default config`,
    },
    {
      path: "postcss.config.js",
      content: `module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}`,
    },
    {
      path: "src/app/globals.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

@layer base {
  :root {
    --background: 0 0% 100%;
    --foreground: 222.2 84% 4.9%;
  }
  
  .dark {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}`,
    },
    {
      path: "src/app/layout.tsx",
      content: `import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'My Next.js App',
  description: 'Built with Next.js App Router',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  )
}`,
    },
    {
      path: "src/app/page.tsx",
      content: `import Link from 'next/link'

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 max-w-5xl w-full items-center justify-between font-mono text-sm">
        <h1 className="text-4xl font-bold text-center mb-8">
          Welcome to Next.js
        </h1>
        <p className="text-center text-muted-foreground mb-8">
          Get started by editing{' '}
          <code className="bg-muted px-2 py-1 rounded">src/app/page.tsx</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-2xl mx-auto">
          <Link 
            href="/api/hello" 
            className="p-6 border rounded-lg hover:border-primary transition-colors"
          >
            <h2 className="text-lg font-semibold mb-2">API Route →</h2>
            <p className="text-sm text-muted-foreground">
              Try the /api/hello endpoint
            </p>
          </Link>
          <div className="p-6 border rounded-lg">
            <h2 className="text-lg font-semibold mb-2">Server Action</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Submit a form with server-side processing
            </p>
            <form action={async (formData) => {
              'use server'
              const name = formData.get('name')
              console.log('Submitted:', name)
            }}>
              <input
                name="name"
                placeholder="Your name"
                className="w-full px-3 py-2 border rounded mb-2"
              />
              <button 
                type="submit"
                className="w-full px-4 py-2 bg-primary text-primary-foreground rounded"
              >
                Submit
              </button>
            </form>
          </div>
        </div>
      </div>
    </main>
  )
}`,
    },
    {
      path: "src/app/api/hello/route.ts",
      content: `import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json({
    message: 'Hello from Next.js API route!',
    timestamp: new Date().toISOString(),
  })
}`,
    },
    {
      path: "src/lib/utils.ts",
      content: `import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}`,
    },
    {
      path: "src/components/ui/button.tsx",
      content: `import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }`,
    },
  ],
};

const VUE_VITE_TEMPLATE: TemplateDefinition = {
  id: "vue-vite",
  name: "Vue 3 + TypeScript + Vite",
  description: "Vue composition API with Pinia state management and Vue Router",
  techStack: ["Vue 3", "TypeScript", "Vite", "Pinia", "Vue Router"],
  icon: "💚",
  dependencies: [
    "vue",
    "vue-router",
    "pinia",
  ],
  devDependencies: [
    "@vitejs/plugin-vue",
    "@vue/tsconfig",
    "typescript",
    "vite",
    "vue-tsc",
  ],
  files: [
    {
      path: "package.json",
      content: `{
  "name": "my-vue-app",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vue-tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "vue": "^3.4.0",
    "vue-router": "^4.2.5",
    "pinia": "^2.1.7"
  },
  "devDependencies": {
    "@vitejs/plugin-vue": "^5.0.2",
    "@vue/tsconfig": "^0.5.1",
    "typescript": "^5.3.3",
    "vite": "^5.0.10",
    "vue-tsc": "^1.8.27"
  }
}`,
    },
    {
      path: "tsconfig.json",
      content: `{
  "extends": "@vue/tsconfig/tsconfig.dom.json",
  "include": ["env.d.ts", "src/**/*", "src/**/*.vue"],
  "compilerOptions": {
    "composite": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}`,
    },
    {
      path: "vite.config.ts",
      content: `import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})`,
    },
    {
      path: "env.d.ts",
      content: `/// <reference types="vite/client" />`,
    },
    {
      path: "index.html",
      content: `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" href="/favicon.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>My Vue App</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>`,
    },
    {
      path: "src/main.ts",
      content: `import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import router from './router'
import './style.css'

const app = createApp(App)

app.use(createPinia())
app.use(router)

app.mount('#app')`,
    },
    {
      path: "src/style.css",
      content: `@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --color-primary: #42b883;
  --color-secondary: #35495e;
}

body {
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
}`,
    },
    {
      path: "src/App.vue",
      content: `<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>

<template>
  <div class="min-h-screen flex items-center justify-center">
    <div class="text-center space-y-4">
      <h1 class="text-4xl font-bold text-[var(--color-primary)]">
        Welcome to Vue 3
      </h1>
      <p class="text-gray-600">
        Start building by editing 
        <code class="bg-gray-100 px-1 rounded">src/App.vue</code>
      </p>
      <div class="space-x-4">
        <button 
          @click="counter.increment()"
          class="px-4 py-2 bg-[var(--color-primary)] text-white rounded hover:opacity-90"
        >
          Count: {{ counter.count }}
        </button>
        <RouterLink 
          to="/about" 
          class="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50"
        >
          Go to About
        </RouterLink>
      </div>
    </div>
  </div>
</template>`,
    },
    {
      path: "src/router/index.ts",
      content: `import { createRouter, createWebHistory } from 'vue-router'
import Home from '@/views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: Home
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('@/views/AboutView.vue')
    }
  ]
})

export default router`,
    },
    {
      path: "src/stores/counter.ts",
      content: `import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export const useCounterStore = defineStore('counter', () => {
  const count = ref(0)
  const doubleCount = computed(() => count.value * 2)
  
  function increment() {
    count.value++
  }
  
  function reset() {
    count.value = 0
  }
  
  return { count, doubleCount, increment, reset }
})`,
    },
    {
      path: "src/views/HomeView.vue",
      content: `<script setup lang="ts">
import { useCounterStore } from '@/stores/counter'

const counter = useCounterStore()
</script>

<template>
  <div>
    <h2>Home View</h2>
    <p>Current count: {{ counter.count }}</p>
    <p>Double count: {{ counter.doubleCount }}</p>
  </div>
</template>`,
    },
    {
      path: "src/views/AboutView.vue",
      content: `<template>
  <div class="max-w-2xl mx-auto p-8">
    <h2 class="text-2xl font-bold mb-4">About This App</h2>
    <p class="text-gray-600 mb-4">
      This is a Vue 3 application built with:
    </p>
    <ul class="list-disc list-inside space-y-2 text-gray-600">
      <li>Vue 3 Composition API</li>
      <li>TypeScript</li>
      <li>Vite</li>
      <li>Pinia for state management</li>
      <li>Vue Router</li>
    </ul>
  </div>
</template>`,
    },
  ],
};

// ============================================================================
// Template Registry
// ============================================================================

const TEMPLATES: TemplateDefinition[] = [
  REACT_VITE_TEMPLATE,
  NODE_EXPRESS_TEMPLATE,
  PYTHON_FASTAPI_TEMPLATE,
  NEXTJS_TEMPLATE,
  VUE_VITE_TEMPLATE,
];

// ============================================================================
// Public API
// ============================================================================

/**
 * Get a specific template by ID
 * @param templateId - The template identifier
 * @returns The template definition or undefined if not found
 */
export function getTemplate(templateId: string): TemplateDefinition | undefined {
  return TEMPLATES.find((template) => template.id === templateId);
}

/**
 * List all available templates (metadata only, without full file contents)
 * Useful for displaying template options in UI
 * @returns Array of template metadata
 */
export function listTemplates(): Omit<TemplateDefinition, 'files'>[] {
  return TEMPLATES.map(({ files, ...metadata }) => metadata);
}

/**
 * Generate all files for a specific template
 * @param templateId - The template identifier
 * @returns Array of template files with paths and content
 * @throws Error if template not found
 */
export function generateFiles(templateId: string): TemplateFile[] {
  const template = getTemplate(templateId);
  if (!template) {
    throw new Error(`Template "${templateId}" not found`);
  }
  return template.files;
}
