

import MarkdownIt from 'markdown-it';
import MarkdownItKatex from '@iktakahiro/markdown-it-katex'
import MarkdownItMark from 'markdown-it-mark'
import hljs from 'highlight.js'

const mdOptions: MarkdownIt.Options = {
  html: true,
  highlight: function (str: string, lang: string) {
    if (lang && hljs.getLanguage(lang)) {
      try {
        let code = '<pre class="hljs"><code class="hljs">';
        code += hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
        code += '</code></pre>';
        code += '<p><a href="#" onclick="navigator.clipboard.writeText(window.api.base64.decode(\'' + Buffer.from(str).toString('base64') + '\'));';
        code += 'this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>';
        return code;
      } catch (error) {
        console.log(error)
      }
    }
    return '' // use external default escaping
  }
}

const mdPreprocess = (markdown: string) => {
  // for katex processing, we need to replace \[ and \] with $$ to trigger processing
  // until https://github.com/iktakahiro/markdown-it-katex/pull/13 is merged
  return markdown.replaceAll('\\[', '$$$$').replaceAll('\\]', '$$$$')
}

export const renderMarkdown = (markdown: string): string => {
  const md = new MarkdownIt(mdOptions)
  md.use(MarkdownItKatex)
  md.use(MarkdownItMark)
  return md.render(mdPreprocess(markdown))
}
