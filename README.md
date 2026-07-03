# Kapru — Sri Lanka's AI Shopping Friend

> Built for the **Kapruka Agent Challenge 2026**

A full-screen conversational AI shopping agent for [Kapruka.com](https://www.kapruka.com) that understands **English, Tamil, Sinhala, and Tanglish** — helping customers discover products, get gift recommendations, and complete a real checkout, all through natural conversation.

---

## Live Demo

🔗 **[kapru-project.vercel.app](https://kapru-project.vercel.app)**

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 + TypeScript |
| Styling | Tailwind CSS + shadcn/ui |
| AI | Google Gemini API (`gemini-2.5-flash`) |
| Commerce | Kapruka MCP (Model Context Protocol) |
| Deployment | Vercel |

---

## Features

- 🌐 **Multilingual conversational shopping** — English, Tamil, Sinhala, and Tanglish
- 🔍 **Real-time product search** with visual product cards and images
- 🛒 **Cart management** — add, remove, and adjust quantities
- 📦 **Full guest checkout flow** → real Kapruka order creation via MCP
- 📱 **Mobile-responsive design** — works great on phones over Wi-Fi

---

## Getting Started Locally

1. **Clone the repo and install dependencies**
   ```bash
   git clone https://github.com/MIM-Isfak/kapru-project.git
   cd kapru-project
   npm install
   ```

2. **Create a `.env.local` file** in the project root:
   ```
   GEMINI_API_KEY=your_key_here
   ```

3. **Start the dev server**
   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000)

---

## How It Works

1. The user types a message (e.g. *"I need a birthday gift for my mom under Rs. 3000"*)
2. Gemini processes the message and calls the appropriate **Kapruka MCP tool** (`kapruka_search_products`, `kapruka_get_product`, etc.)
3. Results are parsed and displayed as interactive **product cards**
4. The user adds items to their **cart**, fills in delivery details, and places a real order through the **Kapruka checkout API**

---

## Project Structure

```
app/
  page.tsx          # Landing page
  chat/             # Chat interface
  checkout/         # Guest checkout flow
  api/
    chat/           # Gemini + MCP orchestration
    checkout/       # Order creation via MCP
    cities/         # Delivery city autocomplete
components/
  chat/             # MessageBubble, ChatInput, ChatWindow
  cart/             # CartDrawer
  products/         # ProductCard
lib/
  gemini.ts         # Gemini client + system prompt
  mcp-client.ts     # Kapruka MCP client
  types.ts          # Shared TypeScript types
  cart-context.tsx  # Cart state (React context)
```

---

## Built By

**Mohamed Isfak** — Computer Science undergraduate, University of Jaffna
