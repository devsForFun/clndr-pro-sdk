import React from 'react';
import { renderToString } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import DefaultMarkdownRenderer from './default-markdown-renderer';

describe('DefaultMarkdownRenderer', () => {
  it('renders headings, paragraphs, and emphasis from markdown source', () => {
    const html = renderToString(
      <DefaultMarkdownRenderer content={'# Welcome\n\nBook a **30-minute** intro chat.'} />,
    );
    expect(html).toContain('<h1');
    expect(html).toContain('Welcome');
    expect(html).toContain('<p');
    expect(html).toContain('<strong');
    expect(html).toContain('30-minute');
  });

  it('renders GFM tables (remark-gfm extension)', () => {
    const html = renderToString(
      <DefaultMarkdownRenderer
        content={'| col |\n| --- |\n| val |'}
      />,
    );
    expect(html).toContain('<table');
    expect(html).toContain('val');
  });

  it('renders links with safe rel/target attributes', () => {
    const html = renderToString(
      <DefaultMarkdownRenderer content={'[clndr.pro](https://clndr.pro)'} />,
    );
    expect(html).toContain('href="https://clndr.pro"');
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it('applies a caller-supplied className to the wrapper', () => {
    const html = renderToString(
      <DefaultMarkdownRenderer content="hi" className="custom-wrapper" />,
    );
    expect(html).toContain('class="custom-wrapper"');
  });
});
