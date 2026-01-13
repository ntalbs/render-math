#!/usr/bin/env node

import { program } from 'commander';
import { render } from './math-renderer.js';

program
  .description('MathJax renderer. Read HTML and render math formula to SVG.')
  .option('--src-dir <path>', 'source directory', `${process.env.BLOG_BASE_DIR}/public`)
  .option('--dest-dir <path>', 'destination directory', `${process.env.BLOG_BASE_DIR}/rendered-public`)
  .option('-f, --force', 'force render')
  .option('-q, --quite', 'print render message only')
  .option('--quieter', 'do not print per file message')
  .action((options) => {
    render(options.srcDir, options.destDir, options);
  })
  .parse(process.argv);
