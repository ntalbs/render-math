const fs = require('fs');
const path = require('path');
const glob = require('glob');
const { JSDOM } = require('jsdom');
const { mathjax } = require('mathjax-full/js/mathjax.js');
const { TeX } = require('mathjax-full/js/input/tex.js');
const { SVG } = require('mathjax-full/js/output/svg.js');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor.js');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html.js');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages.js');

// --- MathJax Initialization ---
const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);
const tex = new TeX({ packages: AllPackages });
const svg = new SVG({ fontCache: 'local' });
const mjPage = mathjax.document('', { InputJax: tex, OutputJax: svg });

const blogRoot = '/Users/ntalbs/Blog';
const publicDir = path.join(blogRoot, 'public');
const htmlFiles = glob.sync(`${publicDir}/**/*`);

console.log(`Found ${htmlFiles.length} HTML files. Processing math...`);

htmlFiles.forEach(f => process(f));


function process(sourcePath) {
  let targetPath = getTargetPathFrom(sourcePath);

  let sourcePathStat = fs.statSync(sourcePath);
  if (sourcePathStat.isDirectory()) {
    ensureDir(targetPath);
  } else {
    if (sourcePath.endsWith('.md5')) {
      return;
    }

    if (!isSrcNewer(sourcePath, targetPath)) {
      console.log(`${targetPath} is up-to-date.`);
      return;
    }

    ensureDir(path.dirname(targetPath));
    if (sourcePath.endsWith('.html')) {
      processHtml(sourcePath, targetPath);
    } else {
      console.log(`copying ${sourcePath}`);
      fs.copyFileSync(sourcePath, targetPath);
    }
  }
}

function isSrcNewer(src, target) {
  if (!fs.existsSync(target)) {
    return true;
  }

  const statSrc = fs.statSync(src);
  const statTarget = fs.statSync(target);

  return statSrc.mtimeMs > statTarget.mtimeMs;
}

function processHtml(sourcePath, targetPath) {
  const html = fs.readFileSync(sourcePath, 'utf8');
  const dom = new JSDOM(html);
  const document = dom.window.document;
  const body = document.body;
  let needsUpdate = false;

  processNode(body);

  if (needsUpdate) {
    // Add the required MathJax CSS to the <head>
    const styleTag = document.createElement('style');
    styleTag.setAttribute('id', 'MJX-SVG-styles');
    styleTag.innerHTML = adaptor.innerHTML(svg.styleSheet(mjPage));
    document.head.appendChild(styleTag);
    fs.writeFileSync(targetPath, dom.serialize());
    console.log(`✅ Rendered math in: ${path.relative(publicDir, sourcePath)}`);
  } else {
    fs.copyFileSync(sourcePath, targetPath);
    conslog.log(`No math in ${sourcePath}, copied.`);
  }

  function processNode(node) {
    // Regex for $$...$$ and $...$
    const displayRegex = /\$\$(.*?)\$\$/gs;
    const inlineRegex = /(?<!\\)\$([^\$]+?)\$/g;

    if (node.nodeType === 3) { // Text node
      let text = node.textContent;
      if (displayRegex.test(text) || inlineRegex.test(text)) {
        needsUpdate = true;

        // Render Display Math
        text = text.replace(displayRegex, (_, texStr) => {
          const output = mjPage.convert(texStr, { display: true });
          const svg = adaptor.innerHTML(output);
          return `<mjx-container display="true" style="display: block; text-align: center; margin: 1em 0;">${svg}</mjx-container>`;
        });

        // Render Inline Math
        text = text.replace(inlineRegex, (_, texStr) => {
          const output = mjPage.convert(texStr, { display: false });
          return adaptor.innerHTML(output);
        });

        // Create a temporary container to hold the new HTML
        const wrapper = document.createElement('div');
        wrapper.innerHTML = text;
        node.replaceWith(...wrapper.childNodes);
      }
    } else if (node.className === 'latex-block') {
      needsUpdate = true;

      let texStr = node.textContent;

      // Render Display Math
      const output = mjPage.convert(texStr, { display: true });
      const svg = adaptor.innerHTML(output);
      let text = `<mjx-container display="true" style="display: block; text-align: center; margin: 1em 0;">${svg}</mjx-container>`;

      // Create a temporary container to hold the new HTML
      const wrapper = document.createElement('div');
      wrapper.innerHTML = text;
      node.replaceWith(...wrapper.childNodes);
    } else if (node.nodeName !== 'SCRIPT' && node.nodeName !== 'CODE' && node.nodeName !== 'PRE') {
      // Recursively check children, skipping code blocks
      Array.from(node.childNodes).forEach(processNode);
    }
  }
}

function getTargetPathFrom(sourcePath) {
  return sourcePath.replace('public', 'mathjax3');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}
