"""
Sign in as the admin pilot, wait for bootstrap data, then open the nav menu and
inspect the role-switcher / menu selectors before scripting full captures.
Run: python3 pilot-decks/capture/_inspect_workspace.py
"""
import json
import os
import sys
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "_smoke_out")
os.makedirs(OUT, exist_ok=True)
EMAIL = "pilot.admin@atlas.test"
PW = "AtlasPilot2026!"


def login(page):
    page.goto(f"{BASE}/app", wait_until="networkidle")
    page.wait_for_timeout(1200)
    page.fill("input[type=email]", EMAIL)
    page.fill("input[type=password]", PW)
    page.get_by_role("button", name="sign in with email").click()
    page.wait_for_function("() => !document.querySelector('input[type=password]')", timeout=30000)
    # Wait for skeleton/shimmer placeholders to clear (best effort).
    try:
        page.wait_for_function(
            "() => document.querySelectorAll('.animate-pulse').length === 0",
            timeout=30000,
        )
    except Exception:
        pass
    page.wait_for_load_state("networkidle")
    page.wait_for_timeout(2500)


def dump(page, tag):
    info = page.evaluate(
        """() => {
          const pick = (el) => ({
            tag: el.tagName.toLowerCase(),
            text: (el.innerText || el.value || '').trim().slice(0, 50),
            aria: el.getAttribute('aria-label'),
            title: el.getAttribute('title'),
          });
          return {
            url: location.href,
            bodyLen: document.body.innerText.length,
            pulse: document.querySelectorAll('.animate-pulse').length,
            buttons: [...document.querySelectorAll('button,[role=button],[role=tab],[role=menuitem],a,nav *')]
              .map(pick).filter(b => b.text || b.aria).slice(0, 160),
            headings: [...document.querySelectorAll('h1,h2,h3')].map(e => e.innerText.trim()).slice(0, 40),
          };
        }"""
    )
    with open(os.path.join(OUT, f"{tag}.json"), "w") as f:
        json.dump(info, f, indent=2)
    print(f"== {tag} :: bodyLen={info['bodyLen']} pulse={info['pulse']}")
    print("  headings:", info["headings"][:20])
    uniq = []
    for b in info["buttons"]:
        label = b["text"] or b["aria"]
        if label and label not in uniq:
            uniq.append(label)
    print("  labels:", uniq[:80])


def main():
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.set_default_timeout(20000)
        login(page)
        page.screenshot(path=os.path.join(OUT, "workspace_admin.png"))
        dump(page, "workspace_admin_loaded")

        # Open the nav / account menu (the hamburger on the top-right).
        for sel in ["button:has-text('account settings')", "header button", "nav button"]:
            try:
                page.locator(sel).first.click(timeout=4000)
                page.wait_for_timeout(1200)
                break
            except Exception:
                continue
        page.screenshot(path=os.path.join(OUT, "workspace_admin_menu.png"))
        dump(page, "workspace_admin_menu")
        browser.close()
    print("\nwrote to", OUT)


if __name__ == "__main__":
    sys.exit(main())
