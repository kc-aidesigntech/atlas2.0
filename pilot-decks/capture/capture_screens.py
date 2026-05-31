"""
Capture per-role, per-step screenshots of the live Atlas workspace for the
"with screenshots" pilot decks. Output: pilot-decks/screenshots/<role>/<key>.png

Each role logs in with its pilot identity, sets the role-switcher to the matching
view, and visits the real screen behind each deck step. Captures are best-effort
and resilient: a failed navigation still screenshots the current state and logs a
warning rather than aborting the whole run.

Run: python3 pilot-decks/capture/capture_screens.py
"""
import os
import sys
from playwright.sync_api import sync_playwright
import capture_lib as cl

ROOT = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(os.path.dirname(ROOT), "screenshots")

# Per role: an ordered capture plan. Each step is (key, [ops]) where each op is:
#   ("select", aria_label, option_text) - pick a grouped nav <select> option (admin)
#   ("click", label)                    - click a top-nav tab / button by text
#   ("settings",)                       - open the account-settings panel
# Ops run in order from a modal-cleared state; the final state is screenshotted.
PLANS = {
    "Administrator": [
        ("02_enrollees", [("select", "care delivery menus", "assigned enrollees")]),
        ("03_governance", [("select", "admin controls menus", "governance")]),
        ("04_system_operations", [("select", "admin controls menus", "system operations")]),
        ("05_route_planning", [("select", "care delivery menus", "route planning")]),
        ("06_account_settings", [("settings",)]),
    ],
    "Navigator": [
        ("02_enrollees", [("click", "enrollees")]),
        ("03_burden_survey", [("click", "enrollees"), ("click", "open burden survey")]),
        ("04_my_profile", [("click", "my profile")]),
        ("05_refer", [("click", "refer")]),
        ("06_my_station", [("click", "my station")]),
    ],
    "Supervisor": [
        ("02_assigned_navigators", [("click", "assigned navigators")]),
        ("03_navigator_assessments", [("click", "navigator assessments")]),
        ("04_team_burden", [("click", "team burden")]),
    ],
    "Partner": [
        ("02_capacity_overview", [("click", "referral portal")]),
        ("03_my_station", [("click", "my station")]),
        ("04_service_capacity", [("click", "service capacity")]),
    ],
}


def capture_signin(page, role, out):
    """Screenshot the sign-in card pre-filled with the pilot email (not submitted)."""
    page.goto(f"{cl.BASE}/app", wait_until="networkidle")
    page.wait_for_timeout(1000)
    page.fill("input[type=email]", cl.LOGINS[role])
    page.fill("input[type=password]", cl.PW)
    page.wait_for_timeout(300)
    cl.shot(page, out)


def capture_public_referral(page, out):
    """Logged-out public referral portal (anonymous persona)."""
    page.goto(f"{cl.BASE}/", wait_until="networkidle")
    page.wait_for_timeout(1500)
    cl.shot(page, out)


def _apply_op(page, op):
    kind = op[0]
    if kind == "select":
        return cl.select_menu(page, op[1], op[2])
    if kind == "click":
        return cl.click_nav(page, op[1])
    if kind == "settings":
        cl.open_account_settings(page)
        return True
    return False


def run_role(p, role):
    steps = PLANS[role]
    role_dir = os.path.join(SHOTS, role.lower())
    browser, page = cl.launch(p)
    try:
        # 01: sign-in card for this identity.
        capture_signin(page, role, os.path.join(role_dir, "01_signin.png"))
        # Authenticate and shape the UI to the role.
        cl.login(page, role)
        cl.set_role_view(page, role)
        for key, ops in steps:
            opened_settings = any(o[0] == "settings" for o in ops)
            try:
                cl.close_modal(page)  # clear any modal left open by a prior step
                for op in ops:
                    if not _apply_op(page, op):
                        print(f"  ! {role}/{key}: op failed {op}")
                if not opened_settings:
                    page.evaluate("() => window.scrollTo(0, 0)")
                cl.shot(page, os.path.join(role_dir, f"{key}.png"))
                if opened_settings:
                    page.keyboard.press("Escape")
                    page.wait_for_timeout(400)
                print(f"  ok {role}/{key}")
            except Exception as e:
                cl.shot(page, os.path.join(role_dir, f"{key}.png"))
                print(f"  ! {role}/{key}: {type(e).__name__}: {e}")
    finally:
        browser.close()


def main():
    with sync_playwright() as p:
        for role in ["Administrator", "Navigator", "Supervisor", "Partner"]:
            print(f"== {role}")
            run_role(p, role)
        # Anonymous public referral, shared into the Partner deck's closing step.
        browser, page = cl.launch(p)
        try:
            capture_public_referral(page, os.path.join(SHOTS, "partner", "05_public_referral.png"))
            capture_public_referral(page, os.path.join(SHOTS, "anon", "01_public_referral.png"))
            print("  ok public referral")
        finally:
            browser.close()
    print("done ->", SHOTS)


if __name__ == "__main__":
    sys.exit(main())
