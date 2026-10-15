#!/usr/bin/env python3
"""Check public crawl readiness without credentials or Google's indexing API."""
from __future__ import annotations
import sys
import time
from html.parser import HTMLParser
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

BASE = "https://portfolio-gustavo-chi.vercel.app"
PATHS = ("/", "/robots.txt", "/sitemap.xml")
ERRORS = []
REPORT = []

def get(path: str) -> tuple[str, str]:
    url = BASE + path
    for attempt in range(3):
        try:
            request = Request(url, headers={
                "User-Agent": "GustavoPortfolioSearchHealth/1.0 (+monitoramento de disponibilidade)"
            })
            with urlopen(request, timeout=22) as response:
                status = response.status
                location = response.geturl()
                raw = response.read(3_000_000)
                media = response.headers.get("Content-Type", "")
            if status != 200:
                raise ValueError(f"HTTP {status}")
            if not location.startswith(BASE + "/") and location != BASE:
                raise ValueError(f"Redirecionamento externo inesperado: {location}")
            return raw.decode("utf-8", errors="replace"), media
        except (HTTPError, URLError, ValueError, TimeoutError) as exc:
            if attempt == 2:
                ERRORS.append(f"{path}: falha de acesso público: {exc}")
                return "", ""
            time.sleep(3 * (attempt + 1))
    return "", ""

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.title = ""
        self.in_title = False
        self.robots = []
        self.canonical = ""
    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == "title":
            self.in_title = True
        if tag == "meta" and attrs.get("name", "").lower() == "robots":
            self.robots.append(attrs.get("content", "").lower())
        if tag == "link" and "canonical" in attrs.get("rel", "").lower().split():
            self.canonical = attrs.get("href", "")
    def handle_endtag(self, tag):
        if tag == "title":
            self.in_title = False
    def handle_data(self, data):
        if self.in_title:
            self.title += data

home, html_type = get("/")
robots, robots_type = get("/robots.txt")
sitemap, sitemap_type = get("/sitemap.xml")

if home:
    doc = Page()
    doc.feed(home)
    if not doc.title.strip():
        ERRORS.append("Página inicial: título ausente.")
    if not doc.canonical.startswith(BASE):
        ERRORS.append("Página inicial: canonical não aponta para o domínio principal.")
    if any("noindex" in value for value in doc.robots):
        ERRORS.append("Página inicial: meta robots contém noindex.")
    if "html" not in html_type.lower():
        ERRORS.append(f"Página inicial: Content-Type inesperado: {html_type}")
    if "vercel authentication" in home.lower() or "authentication required" in home.lower():
        ERRORS.append("Página inicial: possível tela de autenticação da Vercel.")
    REPORT.append(f"Página inicial: {doc.title.strip()}")

if robots:
    if "user-agent:" not in robots.lower():
        ERRORS.append("robots.txt: regras de robôs não identificadas.")
    if "disallow: /" in robots.lower().splitlines():
        ERRORS.append("robots.txt: bloqueio global de rastreamento.")
    if BASE + "/sitemap.xml" not in robots:
        ERRORS.append("robots.txt: referência ao sitemap não encontrada.")
    REPORT.append("robots.txt: encontrado e referencia o sitemap")

if sitemap:
    try:
        root = ElementTree.fromstring(sitemap)
        locations = [
            element.text.strip() for element in root.iter()
            if element.tag.endswith("loc") and element.text
        ]
        if BASE + "/" not in locations:
            ERRORS.append("sitemap.xml: página inicial ausente.")
        if any(not url.startswith(BASE + "/") for url in locations):
            ERRORS.append("sitemap.xml: contém URL de domínio diferente.")
        REPORT.append(f"sitemap.xml: {len(locations)} URL(s)")
    except ElementTree.ParseError as exc:
        ERRORS.append(f"sitemap.xml: XML inválido: {exc}")

if ERRORS:
    print("PROBLEMAS DE RASTREABILIDADE DETECTADOS:")
    for entry in ERRORS:
        print("::error::" + entry)
    sys.exit(1)

print("Verificações públicas OK. Isso NÃO significa que o Google indexou o site.")
for entry in REPORT:
    print("- " + entry)
