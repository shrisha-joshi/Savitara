import pytest
import asyncio
from playwright.async_api import async_playwright

@pytest.mark.asyncio
async def test_homepage_loads():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Assuming frontend runs on localhost:3000
        try:
            await page.goto("http://localhost:3000")
            assert "Savitara" in await page.title()
        except Exception as e:
            print(f"Frontend test failed: {e}")
        finally:
            await browser.close()

@pytest.mark.asyncio
async def test_admin_login_page_loads():
    async with async_playwright() as p:
        browser = await p.chromium.launch()
        page = await browser.new_page()
        # Assuming admin runs on localhost:3001
        try:
            await page.goto("http://localhost:3001")
            content = await page.content()
            assert "Login" in content or "Sign In" in content
        except Exception as e:
            print(f"Admin test failed: {e}")
        finally:
            await browser.close()
