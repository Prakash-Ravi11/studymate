import { sanitizeNoteHtml } from '../sanitize';
const attacks = [
  ['script tag', '<p>hi</p><script>alert(1)</script>'],
  ['img onerror', '<img src=x onerror="alert(1)">'],
  ['svg onload', '<svg onload="alert(1)"></svg>'],
  ['javascript: href', '<a href="javascript:alert(1)">click</a>'],
  ['data: href', '<a href="data:text/html,<script>alert(1)</script>">x</a>'],
  ['iframe', '<iframe src="https://evil.test"></iframe>'],
  ['onclick attr', '<p onclick="alert(1)">text</p>'],
  ['style expression', '<p style="background:url(javascript:alert(1))">t</p>'],
  ['form', '<form action="https://evil.test"><input name=p></form>'],
  ['nested obfuscation', '<<SCRIPT>alert("x");//<</SCRIPT>'],
  ['meta refresh', '<meta http-equiv="refresh" content="0;url=https://evil.test">'],
  ['object', '<object data="https://evil.test"></object>'],
  ['legit content kept', '<p>Real <strong>note</strong> with <a href="https://ok.test">link</a></p>'],
];
let bad = 0;
for (const [name, input] of attacks) {
  const out = sanitizeNoteHtml(input);
  const dangerous = /<script|onerror|onload|onclick|javascript:|<iframe|<object|<form|<meta|data:text\/html/i.test(out);
  if (dangerous) bad++;
  console.log(`${dangerous ? 'DANGEROUS' : 'clean    '}  ${name.padEnd(20)} -> ${JSON.stringify(out).slice(0,90)}`);
}
console.log(bad === 0 ? '\nAll payloads neutralised.' : `\n${bad} PAYLOAD(S) SURVIVED`);
process.exit(bad === 0 ? 0 : 1);
