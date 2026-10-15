# Gemini collaboration context — Portfolio Gustavo

## Purpose
This file is the durable project brief for a second AI reviewer (Gemini). Use it as project context whenever reviewing the repository. The goal is to improve the site continuously, with a premium, professional result, not to redesign randomly for the sake of novelty.

## Repository and deployment
- GitHub repository: https://github.com/gustavoeditor/portfolio-gustavo
- Production URL: https://portfolio-gustavo-chi.vercel.app/
- Main site is a static HTML page in index.html.
- Hosting is Vercel. A Vercel integration call previously returned a 403 scope/authorization error for team "gustavo-editor", so production deployment status must be verified rather than assumed.
- The site is for Gustavo, a video editor focused on CS2/gaming edits, cinematics, motion design, VFX, and YouTube content.
- Contact CTA uses WhatsApp: https://wa.me/5537988445372?text=Ol%C3%A1%2C%20Gustavo!%20Vi%20seu%20portf%C3%B3lio%20e%20gostaria%20de%20conversar%20sobre%20um%20projeto.

## Design direction
- Premium, modern, clean, minimal dark interface.
- Deep charcoal background, restrained violet ambient glow, subtle technical grid only in the lit areas.
- Keep visual effects sophisticated and understated; avoid excessive neon, sparks, glow, or decoration.
- Preserve generous negative space, legible hierarchy, consistent spacing, soft surfaces and restrained animation.
- Responsive and polished on desktop and mobile; preserve safe areas and avoid horizontal overflow.
- The site should feel like a high-quality editor/motion-design portfolio, not a generic template.
- Be proactive about identifying and fixing concrete issues, but don't change the established visual identity without a strong reason.

## Positioning and copy already in the site
Hero headline:
- "Gustavo"
- "Editor de vídeo."
Intro: "Edição, motion design e cinematics para transformar ideias em vídeos com identidade visual, ritmo e intenção."
Buttons: "Ver meu trabalho" and "Vamos conversar".
Differentiators section: "Por que trabalhar comigo?" with "Visual com propósito", "Edição que conduz", and "Atenção aos detalhes".
Projects heading: "Trabalhos em destaque". The projects area is a self-managed video library, not a Behance portfolio/embed section.

Hero side information must remain present:
- O que eu faço / Edição · Motion graphics · Cinematics
- Projetos / Games · YouTube · Conteúdo digital
- Disponibilidade / Aberto a novos projetos
- Base / Brasil · Trabalho remoto

## Implemented changes and known caveats
- SEO metadata, responsive styling, animation and accessibility have been improved.
- A WhatsApp contact popup was added in the lower-right with rotating messages, a launcher to reopen it, a 5-second auto-hide, and sessionStorage logic to avoid repeating the previous message when possible. It has a minimal robot/avatar, violet border glow, dark glass look, label "GUSTAVO · EDITOR DE VÍDEO" and "Disponível para projetos". It cannot read visitor interests; do not claim personalized AI targeting.
- Ambient violet glow and subtle technical grid were added to the hero. The grid opacity was recently reduced to about 20% desktop / 15% mobile and line opacity softened.
- A subtle divider was moved directly below the two hero buttons, inside the hero text column. Keep the hero-side information in its existing right column.
- The Behance embeds were removed by request. The projects gallery reads from root-level projetos.json and renders a responsive grid: three columns on desktop, two on medium screens, one on mobile. Categories are filterable; video entries can use local videos/ paths, public direct MP4/WebM links, YouTube URLs, or Vimeo URLs.
- A user-friendly manager lives at gerenciar-projetos.html. It supports adding projects, category selection, ordering, removal, importing/exporting projetos.json, and browser-local drafts. It cannot publish files on its own: video files and the exported JSON still need to be uploaded/committed to GitHub. Large videos should use a public video host rather than bloating the repository.
- The videos/ and capas/ folders contain README instructions. COMO-ADICIONAR-VIDEOS.md documents the full workflow.
- The favicon is a sharp-cornered white geometric G on a dark square, based on the user's description of their logo. The exact original standalone logo asset was not confidently identified in the available library, so do not claim this SVG is the original source file.
- After changes, validate the JSON schema, filter behavior, mobile grid, local and external video paths, empty state, and manager import/export flow. Do not claim the site is live until Vercel deployment is verified.
- Recent commit for softer grid and corrected hero divider: 0deb3b20c054fd077d5bcc6c3a2ccb1990a57ad3.
- Previous visual commit: c2ea4670719a1c27cc9eb6047bd3bfa936628e83.
- Previous popup polish commit: 5c53de665f183785fae8ce9bcbe717f81953fddf.

## Collaboration protocol for Gemini
1. Inspect the current index.html and relevant project files. Treat the repository as source of truth; this context may lag behind code.
2. Review accessibility, mobile layout, performance, semantics, SEO, contrast, typography, spacing, CTA usability, project presentation, loading behavior, and broken assets/links.
3. Prioritize findings by impact and confidence. Separate confirmed bugs from subjective design suggestions.
4. Recommend improvements that fit the established aesthetic. No gratuitous redesign, excessive glow, or adding features that do not serve portfolio conversion.
5. Do not modify repository files automatically from this review workflow. Produce an actionable review report only; changes should be implemented separately and checked.
6. For each finding, include: severity (critical/high/medium/low), evidence (file/selector or line where possible), proposed fix, expected benefit, and risk/regression to check.
7. Identify disagreements or uncertainty explicitly. Do not invent assets, deployment results, analytics, user research, or test results.
8. Suggest a small prioritized batch of the highest-value improvements rather than an endless list of cosmetic tweaks.
9. Protect secrets. Never ask for, print, or commit API keys, tokens, passwords, or private user data.
10. The owner wants continuous improvement and has authorized proactive fixes to the site, but production deployment and API secret setup must never be falsely reported as completed.

## What Gemini should return
- Short executive assessment.
- Top 5 prioritized findings.
- Specific recommended code/design changes, including snippets only when useful.
- Mobile/accessibility/performance/SEO checks.
- A "do not change" list to protect good existing decisions.
- A suggested next iteration with measurable acceptance criteria.
