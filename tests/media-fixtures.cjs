// Synthetic QA data. No real product media. Served only by preview-server.cjs.
const image = number => ({ src: `assets/fixture-${number}.svg`, alt: `로컬 테스트용 ${number}번 숫자 카드`, title: `테스트 이미지 ${number}`, caption: 'LOCAL TEST ONLY · 실제 제품 이미지가 아닙니다.' });
const video = number => ({ src: 'assets/fixture-video.mp4', poster: `assets/fixture-${number}.svg`, title: `테스트 영상 ${number}`, captions: 'assets/fixture-ko.vtt', captionLabel: '한국어 테스트', language: 'ko', transcript: 'assets/fixture-description.txt', caption: 'LOCAL TEST ONLY · 단색 테스트 영상' });
const mediaCases = {
  'media-empty': { images: [], videos: [] },
  'media-single': { images: [image(1)], videos: [video(1)] },
  'media-multiple': { images: [image(1), image(2), image(3)], videos: [video(1), video(2), video(3)] },
  'media-broken': { images: [{ ...image(1), src: 'assets/missing-fixture.svg' }], videos: [{ ...video(1), src: 'assets/missing-fixture.mp4' }] }
};
function fixtureSVG(number) {
  const colors = ['#ddded8', '#c4c7c0', '#a6aca3'];
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="${colors[number-1]}"/><text x="80" y="100" font-family="sans-serif" font-size="32" fill="#222">LOCAL TEST ONLY / NOT PRODUCT MEDIA</text><text x="800" y="600" text-anchor="middle" font-family="sans-serif" font-size="420" fill="#222">0${number}</text></svg>`;
}
module.exports = { mediaCases, fixtureSVG };
