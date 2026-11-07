"""The news shortcut and its screen."""

from __future__ import annotations

from .test_page import mount
from .test_panels import add_entity

SCREEN = "home-dashboard-news"
ARTICLE = {"title": "Tytuł", "text": "Treść", "rating": 4.44, "votes": 108, "source": "Gazeta", "source_url": "https://a.test/", "url": "https://b.test/"}
SHORTCUT = {"kind": "news", "name": "Wiadomości", "icon": "mdi:newspaper", "sections": [
    {"title": "Polska", "entity": "sensor.home"}, {"title": "Świat", "entity": "sensor.world"},
]}


def open_news(page, home: list, world: list | None = None) -> None:
    add_entity(page, "sensor.home", "x", {"news": home, "release": "Wydanie 1", "attribution": "Dane: test"})
    add_entity(page, "sensor.world", "x", {"news": world or []})
    mount(page, {"shortcuts": [SHORTCUT]})
    page.locator("home-dashboard-page [data-shortcut='Wiadomości']").click()
    page.wait_for_selector(f"home-dashboard-sheet {SCREEN}")


def test_each_section_shows_its_title_and_articles(phone):
    open_news(phone, [ARTICLE, {**ARTICLE, "title": "Drugi"}], [{**ARTICLE, "title": "Trzeci"}])
    assert phone.locator(f"{SCREEN} h3").all_inner_texts() == ["Polska", "Świat"]
    assert phone.locator(f"{SCREEN} h4").all_inner_texts() == ["Tytuł", "Drugi", "Trzeci"]


def test_a_section_without_news_is_left_out(phone):
    open_news(phone, [ARTICLE])
    assert phone.locator(f"{SCREEN} h3").all_inner_texts() == ["Polska"]


def test_an_article_shows_its_rating_and_links(phone):
    open_news(phone, [ARTICLE])
    assert "4,4 (108)" in phone.locator(f"{SCREEN} [data-news-rating]").inner_text()
    assert phone.locator(f"{SCREEN} [data-news-link='source']").get_attribute("href") == "https://a.test/"
    assert phone.locator(f"{SCREEN} [data-news-link='article']").get_attribute("target") == "_blank"


def test_the_edition_and_the_owner_of_the_news_are_named(phone):
    open_news(phone, [ARTICLE])
    text = phone.locator(f"{SCREEN} .content").inner_text()
    assert "Wydanie 1" in text
    assert "Dane: test" in text


def test_a_short_article_needs_only_a_title(phone):
    open_news(phone, [{"title": "Sam tytuł"}])
    assert phone.locator(f"{SCREEN} [data-news-article] p").count() == 0
    assert phone.locator(f"{SCREEN} [data-news-link]").count() == 0


def test_a_script_address_gets_no_link(phone):
    open_news(phone, [{**ARTICLE, "url": "javascript:alert(1)", "source_url": "javascript:alert(1)"}])
    assert phone.locator(f"{SCREEN} [data-news-link]").count() == 0
    assert "Gazeta" in phone.locator(f"{SCREEN} footer").inner_text()


def test_no_news_says_so(phone):
    open_news(phone, [])
    assert phone.locator(f"{SCREEN} [data-news-empty]").count() == 1


def test_a_sensor_that_is_gone_breaks_nothing(phone):
    mount(phone, {"shortcuts": [SHORTCUT]})
    phone.locator("home-dashboard-page [data-shortcut='Wiadomości']").click()
    phone.wait_for_selector(f"{SCREEN} [data-news-empty]")
