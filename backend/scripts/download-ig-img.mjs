import https from 'https';
import fs from 'fs';
import path from 'path';

const imgUrl = 'https://scontent-bog2-2.cdninstagram.com/v/t39.30808-6/467026319_18470372749062653_8123675939495218808_n.jpg?stp=c221.0.663.663a_dst-jpg_e35_s640x640_tt6&_nc_cat=101&_nc_map=urlgen_bucketless&ccb=7-5&_nc_sid=18de74&efg=eyJlZmdfdGFnIjoiRkVFRC5iZXN0X2ltYWdlX3VybGdlbi5DMyJ9&_nc_ohc=P6usBUtcV78Q7kNvwFLbWfh&_nc_oc=AdoVyjIh2VaxTrXpm59xBrVVcl7GwZ5FXbqH83fUls3fyjz5jXO3U6Fs9kyRpKq4Qzs&_nc_zt=23&_nc_ht=scontent-bog2-2.cdninstagram.com&_nc_gid=6L1RqwgTROrUW4od2Bj-kw&_nc_ss=70a02&_nc_ct=RQosPBUKFQIAAAA&oh=00_AQRSKC0l_6_TVVdgcdKwpb7FgvoY7mvXBCS86LBsdYAAJg&oe=6AFE70AA';

const targetDirs = [
  'c:/devJose/View_Info/frontend/public',
  'c:/devJose/View_Info/frontend/src/assets'
];

https.get(imgUrl, res => {
  if (res.statusCode !== 200) {
    console.error('Failed to download image, status:', res.statusCode);
    return;
  }
  const chunks = [];
  res.on('data', chunk => chunks.push(chunk));
  res.on('end', () => {
    const buffer = Buffer.concat(chunks);
    for (const dir of targetDirs) {
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, 'clinica-esperanza-post.jpg'), buffer);
    }
    console.log('Saved clinica-esperanza-post.jpg! Size:', buffer.length);
  });
}).on('error', err => console.error(err));
