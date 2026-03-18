const sharp = require('sharp');

sharp('temp/page-1.png').metadata().then(metadata => {
    console.log(`Width: ${metadata.width}px`);
    console.log(`Height: ${metadata.height}px`);
});
