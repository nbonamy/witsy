
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
      code += 'this.innerHTML = \'Copied!\'; setTimeout(() => this.innerHTML = \'Copy code\', 1000); return false;" class="copy-code">Copy code</a></p>';
      return code;
    } catch (error) {
      console.log(error)
    }
    return '' // use external default escaping
  }
}

// function addSourceOffsets(md: MarkdownIt) {
//   const originalParse = md.parse.bind(md);

//   md.parse = (srcText, env) => {
//     const tokens = originalParse(srcText, env);
//     const lines = srcText.split('\n');

//     for (const token of tokens) {
//       if (token.map) {
//         const [startLine, endLine] = token.map;
//         const startOffset = lines.slice(0, startLine).join('\n').length + (startLine > 0 ? 1 : 0);
//         const endOffset = lines.slice(0, endLine).join('\n').length;
//         token.attrSet('data-md-start', startOffset.toString());
//         token.attrSet('data-md-end', endOffset.toString());
//       }

//       if (token.children) {
//         let offset = token.attrGet('data-md-start') ? parseInt(token.attrGet('data-md-start')!) : 0;
//         for (const child of token.children) {
//           const len = child.content.length;
//           child.attrSet('data-md-start', offset.toString());
//           child.attrSet('data-md-end', (offset + len).toString());
//           offset += len;
//         }
//       }
//     }

//     return tokens;
//   };

//   const originalRenderToken = md.renderer.renderToken.bind(md.renderer);

//   md.renderer.renderToken = function (tokens, idx, options) {
//     const token = tokens[idx];
//     if (token.attrs) {
//       const start = token.attrGet('data-md-start');
//       const end = token.attrGet('data-md-end');
//       if (start && end) {
//         token.attrSet('data-md-start', start);
//         token.attrSet('data-md-end', end);
//       }
//     }
//     return originalRenderToken(tokens, idx, options);
//   };
// }

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
  // we want to preserve ollama <think> content as-is: <think>...</think>
  // and our own <tool> content as-is: <tool>...</tool>
  let postprocessed = html
  postprocessed = postprocessed.replace(/&lt;think&gt;/g, '<think>').replace(/&lt;\/think&gt;/g, '</think>')
  postprocessed = postprocessed.replace(/&lt;tool (id|index)=&quot;(\d+)&quot;&gt;/g, '<tool $1="$2">').replace(/&lt;\/tool&gt;/g, '</tool>')
  postprocessed = postprocessed.replace(/&lt;tool (id|index)=&quot;(\d+)&quot;&gt;/g, '<tool $1="$2">').replace(/&lt;\/tool&gt;/g, '</tool>')
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
    // addSourceOffsets(md)
  
  }

  // do it
  return mdPostprocess(md.render(mdPreprocess(markdown)))
}
