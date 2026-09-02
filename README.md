# GERS STYLES

A professional fashion and tailoring website for GERS STYLES, serving customers in Kampala and Fort Portal, Uganda.

## Live Website

[https://gersstyles.com](https://gersstyles.com)

## About

The website showcases GERS STYLES services and work across:

- Traditional wear
- Formal wear
- School uniforms
- Corporate and work uniforms
- Medical scrubs
- Sweaters and school wear
- Custom tailoring

## Features

- Responsive, semantic HTML5 layout
- Desktop and mobile navigation
- Service and collection showcase
- About section and image gallery
- Native, accessible FAQ accordion
- Customer inquiry and contact form
- WhatsApp contact integration
- Secure serverless contact form processing
- Branded thank-you and custom 404 pages
- Privacy Policy and Terms of Service
- Accessibility-conscious markup, focus states, and interactions
- Responsive image handling
- Production HTTPS and custom domain

## Contact Form Architecture

The inquiry flow is:

```text
Frontend form → Netlify Function → Resend → Business email
```

The frontend submits JSON to `/netlify/functions/contact`. The function validates and normalizes the request before sending it through Resend.

The deployment requires these environment variables by name:

- `RESEND_API_KEY`
- `CONTACT_EMAIL`
- `CONTACT_FROM_EMAIL`

Real values must remain in local or deployment environment configuration and must not be committed.

## Project Structure

```text
.
├── index.html
├── privacy-policy.html
├── terms-of-service.html
├── thank-you.html
├── 404.html
├── assets/
│   └── images/
├── css/
│   └── style.css
├── js/
│   └── main.js
├── netlify/
│   └── functions/
│       └── contact.js
├── test/
│   └── contact.test.js
├── .env.example
└── package.json
```

## Technologies

- HTML5
- CSS3
- Vanilla JavaScript
- Node.js test runner
- Netlify
- Netlify Functions
- Resend
- Cloudflare DNS and Email Routing

The website remains dependency-free at runtime.

## Local Development

Run the Netlify local development environment:

```powershell
npm run dev
```

Run the test suite:

```powershell
npm.cmd test
```

Local contact-form delivery requires the environment variables listed in `.env.example`.

## Testing

The repository includes a Node test suite for the contact function. It covers request methods, JSON parsing, field validation, honeypot handling, missing configuration, normalized email delivery, provider errors, allowed services, request-size limits, and content types.

```powershell
npm.cmd test
```

## Deployment

- Source is hosted on GitHub.
- Production is deployed through Netlify.
- Pushes to the production branch trigger deployment.
- The custom production domain is [https://gersstyles.com](https://gersstyles.com).

## Brand and Development Principles

The visual system uses burgundy, terracotta, sand, cream, and dark brown to support a premium African fashion and editorial direction. The primary responsive navigation breakpoint is 768px.

The project uses plain HTML, CSS, and JavaScript. Shared tokens and reusable component foundations live in `css/style.css`; dependencies and unconfirmed business information should not be introduced without approval.

## Business Contact

- Email: [hello@gersstyles.com](mailto:hello@gersstyles.com)
- Phone / WhatsApp: [+256 788 583 923](tel:+256788583923)
- Location: Kampala & Fort Portal, Uganda
- Opening hours: Monday–Saturday, 7:00 AM–6:00 PM

## Credits

Designed & Developed by [Elevate Business Solutions](https://elevatebusinesssolutions.dev)
