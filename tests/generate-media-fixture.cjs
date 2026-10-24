// Optional: create a tiny six-second synthetic clip for LOCAL browser QA.
// Requires ffmpeg. Generated output is gitignored and never belongs in /docs.
const { spawnSync } = require('node:child_process');
const { mkdirSync } = require('node:fs');
const path = require('node:path');
const output = path.join(__dirname, '.generated');
mkdirSync(output, { recursive: true });
const result = spawnSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=0x454843:s=640x360:r=24', '-t', '6', '-vf', "drawtext=text='LOCAL TEST ONLY':fontcolor=white:fontsize=32:x=(w-text_w)/2:y=(h-text_h)/2", '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(output, 'fixture.mp4')], { stdio: 'inherit' });
if (result.error) console.error('ffmpeg is required for this optional fixture:', result.error.message);
process.exitCode = result.status ?? 1;
