// A screen for reading news. Each section is a sensor that keeps its articles in a `news` attribute.

import { LitElement, css, html, nothing } from "../vendor/lit-all.min.js";
import { translate } from "./i18n.js";
import { tokens } from "./styles.js";

const WEB_ADDRESS = /^https?:\/\//;

export function newsSections(hass, sections) {
  return (sections ?? []).flatMap(({ title, entity }) => {
    const attributes = hass.states[entity]?.attributes;
    const news = Array.isArray(attributes?.news) ? attributes.news : [];
    return news.length ? [{ title, entity, news, release: attributes.release, attribution: attributes.attribution }] : [];
  });
}

export class HomeDashboardNews extends LitElement {
  static properties = {
    hass: { attribute: false },
    item: { attribute: false },
  };

  _renderLink(url, label, data) {
    return WEB_ADDRESS.test(url ?? "") && label
      ? html`<a href=${url} target="_blank" rel="noreferrer" data-news-link=${data}>${label}</a>`
      : nothing;
  }

  _renderArticle({ title, text, rating, votes, source, source_url: sourceUrl, url }) {
    const { language } = this.hass;
    const score = typeof rating === "number" ? rating.toLocaleString(language, { maximumFractionDigits: 1 }) : null;
    return html`
      <article data-news-article>
        <h4>${title}</h4>
        ${text ? html`<p>${text}</p>` : nothing}
        <footer>
          ${score
            ? html`<span class="rating" data-news-rating><ha-icon icon="mdi:star"></ha-icon>${score}${votes ? ` (${votes})` : ""}</span>`
            : nothing}
          ${WEB_ADDRESS.test(sourceUrl ?? "") ? this._renderLink(sourceUrl, source, "source") : source ? html`<span>${source}</span>` : nothing}
          ${this._renderLink(url, translate(language, "news_read"), "article")}
        </footer>
      </article>
    `;
  }

  render() {
    if (!this.hass || !this.item) return nothing;
    const sections = newsSections(this.hass, this.item.sections);
    if (!sections.length) {
      return html`<p class="empty" data-news-empty>${translate(this.hass.language, "news_none")}</p>`;
    }
    const [{ release, attribution }] = sections;
    return html`
      <div class="content">
        ${release ? html`<small class="release" data-news-release>${release}</small>` : nothing}
        ${sections.map(
          ({ title, entity, news }) => html`
            <section data-news-section=${entity}>
              ${title ? html`<h3>${title}</h3>` : nothing} ${news.map((article) => this._renderArticle(article))}
            </section>
          `,
        )}
        ${attribution ? html`<small class="release">${attribution}</small>` : nothing}
      </div>
    `;
  }

  static styles = [
    tokens,
    css`
      .content {
        display: flex;
        flex-direction: column;
        gap: 16px;
        max-width: 720px;
        margin: 0 auto;
        padding: 0 16px 16px;
        color: var(--hd-text);
      }
      section {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      h3 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
      }
      article {
        display: flex;
        flex-direction: column;
        gap: 8px;
        padding: 14px;
        border-radius: var(--hd-radius);
        background: var(--hd-off);
      }
      h4 {
        margin: 0;
        font-size: 16px;
        font-weight: 500;
        line-height: 22px;
      }
      p {
        margin: 0;
        font-size: 15px;
        line-height: 22px;
        overflow-wrap: anywhere;
      }
      footer {
        display: flex;
        flex-wrap: wrap;
        align-items: center;
        gap: 4px 12px;
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .rating {
        display: inline-flex;
        align-items: center;
        gap: 2px;
        --mdc-icon-size: 15px;
      }
      .rating ha-icon {
        color: var(--hd-light-chip);
      }
      a {
        color: var(--hd-media-accent);
      }
      small {
        color: var(--hd-text-muted);
        font-size: 13px;
      }
      .release {
        text-align: center;
      }
      /* A tablet: the whole width, the news in two columns so a line stays easy to read. */
      @media (min-width: 900px) {
        .content {
          max-width: none;
        }
        section {
          display: block;
          column-count: 2;
          column-gap: 16px;
        }
        section h3 {
          margin-bottom: 8px;
          column-span: all;
        }
        article {
          margin-bottom: 12px;
          break-inside: avoid;
        }
      }
      .empty {
        margin: 48px 16px;
        color: var(--hd-text-muted);
        text-align: center;
      }
    `,
  ];
}
