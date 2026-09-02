🌾 Babay Dee Atta Chakki

A modern, full-featured e-commerce platform built for Babay Dee Atta Chakki, an organic grocery store serving customers across Rawalpindi and Islamabad, Pakistan.

The platform provides customers with a smooth shopping experience while giving administrators a centralized system for managing products, orders, deliveries, and sales.

🚀 Live Website

Website: https://babaydeeattachakki.com/

📌 Project Overview

Babay Dee Atta Chakki is designed specifically for a local grocery and organic food business.

Customers can:

Browse available products
View product details and pricing
Add products to their cart
Place Cash on Delivery orders
Provide their delivery information
Select their delivery location
Calculate delivery charges
Track their orders
Receive order confirmation and notifications

The platform also includes an administrative dashboard for managing the store's day-to-day operations.

✨ Features
🛒 Customer Store
Modern responsive e-commerce interface
Product categories
Product search and filtering
Product details
Shopping cart
Quantity management
Checkout system
Cash on Delivery
Customer contact information
Delivery address collection
Order placement
Order tracking
📍 Location & Delivery
Interactive map integration
Customer location selection
Latitude and longitude storage
Distance calculation
Delivery-area management
Automatic delivery charge calculation
Support for Rawalpindi and Islamabad delivery
📦 Order Management

Orders can be managed through the administrative system with different order statuses, including:

Pending
Accepted
Rejected
Processing
Out for Delivery
Delivered

Order information can include:

Customer name
Phone number
Email
Delivery address
Location coordinates
Ordered products
Quantities
Subtotal
Delivery charges
Total amount
Order status
👨‍💼 Admin Dashboard

The administration system provides tools for:

Product management
Order management
Delivery management
Sales monitoring
Order status updates
Customer order information
Pending orders
Completed orders
Order notifications
🔔 Notifications

The project supports real-time order notifications using ntfy, allowing administrators to receive notifications when new orders are submitted.

🤖 AI Integration

The application includes integration with Google's Gemini AI services for AI-powered functionality.

🛠️ Technology Stack
Frontend
React 19
TypeScript
Vite
Tailwind CSS
Motion
GSAP
Anime.js
Lucide React
3D & Animation
Three.js
React Three Fiber
React Three Drei
Backend
Node.js
Express.js
TypeScript
tsx
esbuild
Database & Backend Services
Supabase
PostgreSQL
Supabase JavaScript Client
APIs & Services
Google Maps Platform
Google Gemini AI
ntfy
📂 Project Structure
Babay-dee-atta-chakki/
│
├── api/                    # API-related functionality
├── public/                 # Static public assets
├── scripts/                # Utility and project scripts
├── src/                    # Main frontend source code
│
├── server.ts               # Express backend server
├── index.html              # Application entry point
├── metadata.json           # Application metadata
│
├── .env.example            # Environment variable template
├── .gitignore
├── package.json
├── package-lock.json
├── bun.lock
└── README.md
⚙️ Requirements

Before running the project locally, make sure you have:

Node.js 18+
npm
A Supabase project
Required API credentials
Google Maps API access if map functionality is enabled
Gemini API key if AI functionality is enabled
🔧 Installation
1. Clone the repository
git clone https://github.com/SobanHaroon/Babay-dee-atta-chakki-.git
2. Navigate into the project
cd Babay-dee-atta-chakki-
3. Install dependencies
npm install
4. Configure environment variables

Create a .env file in the project root.

Use .env.example as the template:

cp .env.example .env

Then configure the required credentials.

Example:

GEMINI_API_KEY=your_gemini_api_key
APP_URL=http://localhost:3000

NTFY_TOPIC=your_ntfy_topic

SUPABASE_URL=your_supabase_url
SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
SUPABASE_SECRET_KEY=your_supabase_secret_key
SUPABASE_JWKS_URL=your_supabase_jwks_url

GOOGLE_MAPS_PLATFORM_KEY=your_google_maps_key
GOOGLE_MAPS_API_KEY=your_google_maps_key

Never commit real API keys, database secrets, or private credentials to GitHub.

▶️ Running the Project

Start the development server:

npm run dev

The application will start using the project's development server configuration.

🏗️ Production Build

Create a production build:

npm run build

Start the production server:

npm start
🧹 Clean Build

To remove generated build files:

npm run clean
🔍 Type Checking

Run TypeScript checking with:

npm run lint
💳 Payment Method

The current platform uses:

Cash on Delivery (COD)

Customers can place orders online and pay when their order is delivered.

🚚 Delivery System

The website is designed around local delivery in:

Rawalpindi
Islamabad

The delivery system can use the customer's selected coordinates to determine the distance and calculate the applicable delivery charges.

🗺️ Maps Integration

Google Maps services are used for location-related functionality such as:

Interactive maps
Location selection
Places/autocomplete
Route calculation
Driving distance
Delivery charge calculation

API keys should be restricted to the required APIs and appropriate domains before deploying the application.

🔐 Security

For production deployments:

Never expose Supabase secret/service credentials in frontend code.
Never commit .env files.
Keep API keys in environment variables.
Restrict Google Maps API keys by API and application.
Use Supabase Row Level Security where appropriate.
Validate customer input on both client and server.
Validate order totals on the server.
Protect administrative functionality with proper authentication and authorization.
📱 Responsive Design

The website is designed to provide a responsive shopping experience across:

📱 Mobile devices
📲 Tablets
💻 Laptops
🖥️ Desktop displays
🎨 Design Philosophy

The interface follows an organic grocery / traditional chakki aesthetic, combining modern web design with the visual identity of a local grocery business.

The design focuses on:

Clean layouts
Smooth animations
Natural visual elements
Product-focused UI
Easy navigation
Mobile-first responsiveness
Fast interactions
Clear checkout flow
📊 Admin Operations

The administrative system is designed around the complete order lifecycle:

New Order
    ↓
Pending
    ↓
Accepted / Rejected
    ↓
Processing
    ↓
Out for Delivery
    ↓
Delivered

This allows store management to monitor and update orders throughout the delivery process.

🌐 Deployment

The project can be deployed using platforms capable of running the Vite frontend and Node.js/Express backend.

Before deployment:

Configure production environment variables.
Configure the Supabase project.
Configure Google Maps APIs.
Configure Gemini API access if required.
Configure ntfy notifications.
Restrict production API keys.
Run the production build.
Verify checkout and order management.
Test delivery calculations.
Test the admin dashboard.
📈 Future Improvements

Potential future improvements include:

Online payment integration
WhatsApp order notifications
Customer accounts
Customer order history
Product reviews
Discount and coupon system
Inventory management
Advanced analytics
Automated invoices
Delivery rider dashboard
Real-time delivery tracking
Progressive Web App (PWA)
SEO improvements
Advanced admin permissions
👨‍💻 Developer

Developed by Soban Haroon.

GitHub

github.com/SobanHaroon

Portfolio

msoban.netlify.app

DevOps Services

devopsservices-seven.vercel.app

📄 License

This project is developed for Babay Dee Atta Chakki.

Unless otherwise stated, the source code, branding, product information, images, and business assets are not licensed for unauthorized commercial redistribution.

⭐ Support

If you find this project useful, consider giving the repository a ⭐ on GitHub.

Babay Dee Atta Chakki — Fresh, Natural & Trusted. 🌾

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Run the app:
   `npm run dev`
