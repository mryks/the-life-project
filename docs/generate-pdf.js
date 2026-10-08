const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const inputHtml = path.resolve(__dirname, 'proposal.html');
const outputPdf = path.resolve(__dirname, 'product-design-proposals.pdf');

console.log('Generating PDF: The Life Project - 7 Product & Design Proposals...');
console.log('Source:', inputHtml);
console.log('Destination:', outputPdf);

if (!fs.existsSync(edgePath)) {
  console.error('Edge executable not found at:', edgePath);
  process.exit(1);
}

try {
  const stdout = execFileSync(edgePath, [
    '--headless=new',
    '--disable-gpu',
    '--no-pdf-header-footer',
    `--print-to-pdf=${outputPdf}`,
    `file://${inputHtml.replace(/\\/g, '/')}`
  ]);

  if (fs.existsSync(outputPdf)) {
    const stats = fs.statSync(outputPdf);
    console.log(`Successfully generated PDF!`);
    console.log(`File size: ${(stats.size / 1024).toFixed(1)} KB (${stats.size} bytes)`);
    console.log(`Location: ${outputPdf}`);
  } else {
    console.error('PDF file was not created.');
    process.exit(1);
  }
} catch (err) {
  console.error('Error generating PDF:', err);
  process.exit(1);
}
