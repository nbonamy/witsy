
import MarkdownIt from 'markdown-it';
import MarkdownItKatex from '@iktakahiro/markdown-it-katex'
import MarkdownItMark from 'markdown-it-mark'
import MarkdownItDiagram from 'markdown-it-diagram'
import hljs from 'highlight.js'

const mdOptions: MarkdownIt.Options = {
  html: false,
  highlight: function (str: string, lang: string) {
    try {
      let code = '<pre class="hljs"><code class="hljs variable-font-size">';
      if (lang && hljs.getLanguage(lang)) {
        code += hljs.highlight(str, { language: lang, ignoreIllegals: true }).value;
      } else {
        code += hljs.highlightAuto(str).value;
      }
      code += '</code></pre>';
      code += '<p><a onclick="navigator.clipboard.writeText(window.api.base64.decode(\'' + Buffer.from(str).toString('base64') + '\'));';
      code += 'this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy">Copy code</a></p>';
      return code;
    } catch (error) {
      console.log(error)
    }
    return '' // use external default escaping
  }
}

const mdPreprocess = (markdown: string) => {
  // for katex processing, we need to replace \[ and \] with $$ to trigger processing
  // we also need to handle inline equations \(x\) and \( x \)
  // until https://github.com/iktakahiro/markdown-it-katex/pull/13 is merged
  let preprocessed = markdown.replaceAll('\\[', '$$$$').replaceAll('\\]', '$$$$')
  preprocessed = preprocessed.replaceAll('\\( ', '$').replaceAll(' \\)', '$')
  preprocessed = preprocessed.replaceAll('\\(', '$').replaceAll('\\)', '$')
  return preprocessed
}

const mdPostprocess = (html: string) => {
  // we want to preserve ollama <think> content as-is
  // restore the <think> and </think> tags
  let postprocessed = html
  postprocessed = postprocessed.replaceAll('&lt;think&gt;', '<think>').replace(/&lt;\/think&gt;/g, '</think>')
  return postprocessed
}
  
let md: MarkdownIt | null = null

export const renderMarkdown = (markdown: string): string => {
  
  // init
  if (!md) {

    md = new MarkdownIt(mdOptions)

    // add support for file:// links
    const validateLink = md.validateLink
    md.validateLink = (url) =>  url.startsWith('file://') ? true : validateLink(url)

    // plugins
    md.use(MarkdownItKatex)
    md.use(MarkdownItMark)
    md.use(MarkdownItDiagram)
  
  }

  // do it
  return mdPostprocess(md.render(mdPreprocess(markdown)))
}
