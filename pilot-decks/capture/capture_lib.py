"""
Shared Playwright helpers for the Atlas pilot screenshot pipeline.

Drives the real app at http://localhost:5173 against the live Supabase project:
sign in as a pilot identity, set the role-switcher view, navigate top-nav tabs,
and screenshot. Used by capture_screens.py.
"""
import os
import time
from playwright.sync_api import sync_playwright

BASE = "http://localhost:5173"
PW = "AtlasPilot2026!"
LOGINS = {
    "Administrator": "pilot.admin@atlas.test",
    "Navigator": "pilot.navigator@atlas.test",
    "Supervisor": "pilot.supervisor@atlas.test",
    "Partner": "pilot.partner@atlas.test",
}
ROLE_VIEW = {  # role-switcher <select> option labels
    "Administrator": "administrator",
    "Navigator": "navigator",
    "Supervisor": "supervisor",
    "Partner": "partner",
}
VIEWPORT = {"width": 1600, "height": 900}  # 16:9, matches the 13.333x7.5in deck


def launch(p):
    browser = p.chromium.launch(headless=True)
    ctx = browser.new_page(viewport=VIEWPORT)
    ctx.set_default_timeout(20000)
    return browser, ctx


def login(page, role):
    """Sign in as the pilot identity for `role` and wait for the workspace."""
    page.goto(f"{BASE}/app", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.fill("input[type=email]", LOGINS[role])
    page.fill("input[type=password]", PW)
    page.get_by_role("button", name="sign in with email").click()
    page.wait_for_function("() => !document.querySelector('input[type=password]')", timeout=30000)
    # Bootstrap fetches run after auth; wait for real content (body text grows).
    _wait_for_content(page)


def _wait_for_content(page, min_len=120, timeout_s=30):
    deadline = time.time() + timeout_s
    while time.time() < deadline:
        if page.evaluate("() => document.body.innerText.length") >= min_len:
            page.wait_for_load_state("networkidle")
            page.wait_for_timeout(800)
            return
        page.wait_for_timeout(800)
    page.wait_for_timeout(800)


def open_account_settings(page):
    page.locator("button:has-text('account settings')").first.click()
    page.wait_for_timeout(800)


def set_role_view(page, role):
    """Open account settings, set the role-switcher select, close the panel."""
    open_account_settings(page)
    # The role-view select is the only one offering all four role options; this
    # distinguishes it from workspace selects like "Assigned enrollees".
    sel = page.locator(
        "select:has(option:has-text('administrator')):has(option:has-text('partner'))"
    ).first
    sel.select_option(label=ROLE_VIEW[role])
    page.wait_for_timeout(600)
    # Close the panel (X / close button), fall back to Escape.
    for sel_btn in ["button:has-text('close')", "button[aria-label='close']"]:
        try:
            page.locator(sel_btn).first.click(timeout=2500)
            break
        except Exception:
            continue
    else:
        page.keyboard.press("Escape")
    page.wait_for_timeout(800)
    _wait_for_content(page)


def nav_labels(page):
    return page.evaluate(
        """() => [...document.querySelectorAll('nav button, nav a, [role=tablist] button, header + * button')]
              .map(e => (e.innerText||'').trim()).filter(Boolean).slice(0, 40)"""
    )


def click_nav(page, label):
    """Click a top-nav tab/button by (case-insensitive, partial) text. Returns True if clicked."""
    try:
        page.get_by_role("button", name=label, exact=False).first.click(timeout=4000)
        page.wait_for_timeout(1200)
        return True
    except Exception:
        pass
    try:
        page.get_by_text(label, exact=False).first.click(timeout=4000)
        page.wait_for_timeout(1200)
        return True
    except Exception:
        return False


def close_modal(page):
    """Best-effort dismissal of any open modal/overlay so later nav clicks land.
    Safe to call when nothing is open."""
    for sel in [
        "button[aria-label='close']",
        "button:has-text('\u00d7')",
        "button:has-text('close')",
    ]:
        try:
            loc = page.locator(sel).first
            if loc.is_visible(timeout=600):
                loc.click(timeout=1500)
                page.wait_for_timeout(400)
                return
        except Exception:
            continue
    try:
        page.keyboard.press("Escape")
        page.wait_for_timeout(300)
    except Exception:
        pass


def select_menu(page, aria_label, option_text):
    """Pick an option from a labeled nav <select> (the admin grouped menus).
    Returns True on success."""
    try:
        sel = page.locator(f"select[aria-label='{aria_label}']").first
        sel.select_option(label=option_text)
        page.wait_for_timeout(1200)
        _wait_for_content(page)
        return True
    except Exception:
        return False


def shot(page, path):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    page.wait_for_timeout(400)
    page.screenshot(path=path)
