# 🤖 Kapru — Sri Lanka's AI Shopping Friend

<p align="center">
  <b>A multilingual conversational AI shopping assistant powered by Gemini and Model Context Protocol (MCP)</b>
</p>

<p align="center">
  Built for the <b>Kapruka Agent Challenge 2026</b>
</p>

<p align="center">
  <a href="https://kapru-project.vercel.app"><b>🌐 Live Demo</b></a>
  •
  <a href="https://github.com/MIM-Isfak/kapru-project"><b>💻 Source Code</b></a>
</p>

---

## 📌 Overview

**Kapru** is a conversational AI shopping assistant designed for the Sri Lankan e-commerce experience.

Instead of manually browsing categories and applying multiple filters, users can simply describe what they are looking for in natural language.

For example:

> "I need a birthday gift for my mom under Rs. 3000."

Kapru interprets the user's request, uses **Google Gemini** for conversational intelligence, interacts with **Kapruka commerce services through Model Context Protocol (MCP)**, and presents relevant products through an interactive shopping interface.

The assistant supports **English, Tamil, Sinhala, and Tanglish**, enabling a more natural shopping experience for multilingual users.

---

## 🌐 Live Demo

🚀 **Production:** [kapru-project.vercel.app](https://kapru-project.vercel.app)

The application is deployed on **Vercel** and can be tested directly without any local installation.

---

## 🎯 The Problem

Traditional e-commerce search often requires users to know the correct product names, categories, or filters.

This becomes more difficult when users:

- 🎁 are searching for gifts
- 💰 have a specific budget
- 🤔 are unsure exactly what product they want
- 💬 prefer conversational queries
- 🌐 communicate using multiple languages or Tanglish

Kapru explores how **Conversational AI + MCP-based commerce tools** can make product discovery more natural and accessible.

---

## ✨ Key Features

- 🌐 **Multilingual conversations** — English, Tamil, Sinhala, and Tanglish
- 🤖 **AI-powered intent understanding** using Google Gemini
- 🔍 **Real-time product discovery** through Kapruka MCP
- 🖼️ **Interactive product cards** with product details and images
- 💰 **Budget-aware product discovery**
- 🎁 **Natural-language gift recommendations**
- 🛒 **Cart management** — add, remove, and update quantities
- 📦 **Guest checkout workflow** with Kapruka order integration
- 📱 **Responsive UI** for desktop and mobile
- ⚠️ **Graceful API error and quota handling**

---

## 🧠 System Architecture

```text
┌──────────────────────────┐
│          User            │
│ English / Tamil / Sinhala│
│       / Tanglish         │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│     Next.js Frontend     │
│   Conversational Chat UI │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│   Server-side API Layer  │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│      Google Gemini       │
│  Intent Understanding &  │
│      Tool Selection      │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│    Kapruka MCP Client    │
└────────────┬─────────────┘
             │
      ┌──────┼────────┐
      │      │        │
      ▼      ▼        ▼
   Product  Product  Checkout /
   Search   Details  Order Tools
      │      │        │
      └──────┼────────┘
             │
             ▼
┌──────────────────────────┐
│ Kapruka Commerce Services│
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│ Product Cards / Cart /   │
│        Checkout          │
└──────────────────────────┘
```

---

## 🔄 Example Workflow

A typical interaction looks like this:

```text
User
 │
 │ "I need a birthday gift for my mom
 │  under Rs. 3000"
 ▼
Gemini
 │
 ├── Intent    → Gift Search
 ├── Recipient → Mother
 └── Budget    → Rs. 3000
 │
 ▼
MCP Tool Selection
 │
 ▼
Kapruka Product Search
 │
 ▼
Structured Product Results
 │
 ▼
Interactive Product Cards
 │
 ▼
Add to Cart
 │
 ▼
Guest Checkout
```

This allows the application to combine **natural-language interaction with real commerce operations**.

---

## 🔌 Model Context Protocol (MCP)

One of the key parts of Kapru is its integration with **Model Context Protocol (MCP)**.

Instead of relying on the language model to generate product information itself, the AI layer can interact with structured commerce capabilities.

```text
Natural Language Request
          ↓
     Google Gemini
          ↓
      Tool Selection
          ↓
       MCP Client
          ↓
  Kapruka Commerce Tool
          ↓
 Structured Product Data
          ↓
    Shopping Interface
```

This architecture separates **AI reasoning** from **commerce operations**, allowing the conversational assistant to work with actual product and checkout functionality.

---

## 🛠️ Tech Stack

| Area | Technology |
|---|---|
| Framework | Next.js 16 |
| Language | TypeScript |
| Frontend | React |
| Styling | Tailwind CSS + shadcn/ui |
| AI | Google Gemini API |
| AI Model | Gemini 2.5 Flash |
| Commerce Integration | Model Context Protocol (MCP) |
| State Management | React Context |
| Deployment | Vercel |

---

## 📂 Project Structure

```text
app/
├── page.tsx                 # Landing page
├── chat/                    # Conversational chat interface
├── checkout/                # Guest checkout flow
└── api/
    ├── chat/                # Gemini + MCP orchestration
    ├── checkout/            # Order creation through MCP
    └── cities/              # Delivery city autocomplete

components/
├── chat/                    # Chat UI components
├── cart/                    # Shopping cart components
└── products/                # Product cards

lib/
├── gemini.ts                # Gemini integration and system prompt
├── mcp-client.ts            # Kapruka MCP client
├── types.ts                 # Shared TypeScript types
└── cart-context.tsx         # Cart state management
```

---

## 👨‍💻 What I Built

Through this project, I worked on the end-to-end development of a conversational AI shopping experience, including:

- 🤖 integrating Google Gemini with the application backend
- 🔌 connecting commerce functionality through MCP
- 🔍 implementing conversational product discovery
- 🛒 developing cart management functionality
- 📦 implementing the guest checkout workflow
- 🌐 handling multilingual user queries
- 🎨 building a responsive conversational interface
- ⚠️ handling API failures and quota-related errors gracefully
- 🚀 deploying the application to Vercel

The project gave me practical experience connecting an **LLM to external tools and real application workflows**, rather than using the model only for text generation.

---

## 🛡️ Reliability & Security

Kapru includes defensive handling for external AI service failures and API usage limitations.

If an external AI request fails or the configured usage limit is reached, the application handles the failure gracefully and returns a user-friendly response instead of exposing raw backend errors.

Sensitive configuration such as API credentials is managed through **environment variables** rather than being stored directly in the client-side source code.

---

## 💻 Development Setup

The production application is already available through the **Vercel live demo**.

For developers who want to run the project locally:

### 1. Clone the repository

```bash
git clone https://github.com/MIM-Isfak/kapru-project.git
cd kapru-project
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the project root:

```env
GEMINI_API_KEY=your_api_key_here
```

> ⚠️ Never commit API keys or other credentials to the repository.

### 4. Start the development server

```bash
npm run dev
```

Open:

```text
http://localhost:3000
```

---

## 📚 What I Learned

Building Kapru gave me hands-on experience with:

- 🤖 LLM-powered application development
- 🔌 Model Context Protocol (MCP)
- 🛠️ AI tool calling and orchestration
- 💬 conversational AI workflows
- 🌐 multilingual user interactions
- ⚡ Next.js server-side APIs
- 🔷 TypeScript application development
- 🔗 third-party service integration
- ⚠️ API error handling
- 🚀 production deployment with Vercel

---

## 🔮 Future Improvements

Potential improvements include:

- 🧠 improved semantic product ranking
- 💾 conversation memory for shopping preferences
- 🎯 more advanced recommendation logic
- 🧪 automated testing for AI tool calls
- 📊 structured logging and observability
- 📈 AI response and tool-call evaluation
- ⚙️ CI/CD pipeline improvements
- ☁️ improved production monitoring

These improvements would move the project toward a more robust **production-oriented AI system**.

---

## 👤 Author

**Mohamed Isfak**  
Computer Science Undergraduate  
University of Jaffna, Sri Lanka

[LinkedIn](https://www.linkedin.com/in/mohamed-isfak-8a239b344) • [GitHub](https://github.com/MIM-Isfak)

---

<p align="center">
  <b>Built to explore how conversational AI and MCP can make online shopping more natural and accessible.</b>
</p>
