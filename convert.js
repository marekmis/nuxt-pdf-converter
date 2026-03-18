const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const sharp = require('sharp');

const INPUT_FOLDER = './input';
const OUTPUT_FOLDER = './output';
const TEMP_FOLDER = './temp';
const TARGET_WIDTH = 2000;
const JPG_QUALITY = 90;

async function convertPdfToJpg(pdfPath) {
    const pdfName = path.basename(pdfPath, '.pdf');
    const outputName = `${pdfName}_converted.jpg`;
    const outputPath = path.join(OUTPUT_FOLDER, outputName);

    console.log(`Processing: ${pdfName}.pdf`);

    // Create temp folder if it doesn't exist
    if (!fs.existsSync(TEMP_FOLDER)) {
        fs.mkdirSync(TEMP_FOLDER, { recursive: true });
    }

    // Calculate the DPI needed: For A4 (8.27 inches), 2480/8.27 = 300 DPI  
    // We'll use even higher for maximum quality
    const DPI_FOR_TARGET = Math.ceil(TARGET_WIDTH / 8.27 * 3.5); // ~1048 DPI
    
    try {
        // Use pdftoppm directly for better control over DPI
        const pdfFullPath = path.resolve(pdfPath);
        const tempFullPath = path.resolve(TEMP_FOLDER);
        const outputPrefix = path.join(tempFullPath, 'page');
        
        // Path to pdftoppm executable in pdf-poppler package
        const pdftoppmPath = path.join(
            __dirname, 
            'node_modules', 
            'pdf-poppler', 
            'lib', 
            'win', 
            'poppler-0.51', 
            'bin', 
            'pdftoppm.exe'
        );
        
        console.log(`Converting with ${DPI_FOR_TARGET} DPI...`);
        
        // Run pdftoppm directly with explicit DPI
        const command = `"${pdftoppmPath}" -png -r ${DPI_FOR_TARGET} "${pdfFullPath}" "${outputPrefix}"`;
        execSync(command, { stdio: 'inherit' });

        // Get all generated page images
        const files = fs.readdirSync(TEMP_FOLDER)
            .filter(f => f.startsWith('page') && (f.endsWith('.jpg') || f.endsWith('.png')))
            .sort((a, b) => {
                const numA = parseInt(a.match(/\d+/)?.[0] || '0');
                const numB = parseInt(b.match(/\d+/)?.[0] || '0');
                return numA - numB;
            });

        if (files.length === 0) {
            throw new Error('No pages were converted');
        }

        console.log(`Converted ${files.length} page(s)`);

        // Process each page to ensure exact width and get metadata
        const processedImages = [];
        for (const file of files) {
            const filePath = path.join(TEMP_FOLDER, file);
            const image = sharp(filePath);
            const metadata = await image.metadata();

            // Resize to exact width while maintaining aspect ratio
            // Use high-quality Lanczos3 resampling
            const resizedBuffer = await image
                .resize(TARGET_WIDTH, null, {
                    fit: 'inside',
                    withoutEnlargement: false,
                    kernel: sharp.kernel.lanczos3 // Best quality resampling
                })
                .jpeg({ 
                    quality: JPG_QUALITY, 
                    chromaSubsampling: '4:4:4', // No chroma subsampling for best quality
                    mozjpeg: true,
                    force: true
                })
                .toBuffer();

            const resizedImage = sharp(resizedBuffer);
            const resizedMetadata = await resizedImage.metadata();

            processedImages.push({
                buffer: resizedBuffer,
                width: resizedMetadata.width,
                height: resizedMetadata.height
            });

            console.log(`Page ${processedImages.length}: ${resizedMetadata.width}x${resizedMetadata.height}px`);
        }

        // Combine images vertically if multiple pages
        let finalImage;
        if (processedImages.length === 1) {
            finalImage = processedImages[0].buffer;
            console.log('Single page PDF - no combining needed');
        } else {
            // Calculate total height
            const totalHeight = processedImages.reduce((sum, img) => sum + img.height, 0);
            const width = processedImages[0].width;

            console.log(`Combining ${processedImages.length} pages into ${width}x${totalHeight}px image`);

            // Create composite image
            const compositeImages = [];
            let currentTop = 0;

            for (const img of processedImages) {
                compositeImages.push({
                    input: img.buffer,
                    top: currentTop,
                    left: 0
                });
                currentTop += img.height;
            }

            // Create blank canvas and composite all images
            finalImage = await sharp({
                create: {
                    width: width,
                    height: totalHeight,
                    channels: 3,
                    background: { r: 255, g: 255, b: 255 }
                }
            })
                .composite(compositeImages)
                .jpeg({ 
                    quality: JPG_QUALITY, 
                    chromaSubsampling: '4:4:4', // No chroma subsampling
                    mozjpeg: true,
                    force: true
                })
                .toBuffer();
        }

        // Ensure output folder exists
        if (!fs.existsSync(OUTPUT_FOLDER)) {
            fs.mkdirSync(OUTPUT_FOLDER, { recursive: true });
        }

        // Save final image
        await sharp(finalImage).toFile(outputPath);

        console.log(`✓ Successfully saved: ${outputPath}`);

        // Clean up temp files
        files.forEach(file => {
            fs.unlinkSync(path.join(TEMP_FOLDER, file));
        });
        fs.rmdirSync(TEMP_FOLDER);

    } catch (error) {
        console.error(`Error processing ${pdfName}.pdf:`, error.message);
        throw error;
    }
}

async function processAllPdfs() {
    try {
        // Check if input folder exists
        if (!fs.existsSync(INPUT_FOLDER)) {
            console.error(`Input folder not found: ${INPUT_FOLDER}`);
            return;
        }

        // Get all PDF files from input folder
        const pdfFiles = fs.readdirSync(INPUT_FOLDER)
            .filter(f => f.toLowerCase().endsWith('.pdf'))
            .map(f => path.join(INPUT_FOLDER, f));

        if (pdfFiles.length === 0) {
            console.log('No PDF files found in input folder');
            return;
        }

        console.log(`Found ${pdfFiles.length} PDF file(s) to process\n`);

        // Process each PDF
        for (const pdfPath of pdfFiles) {
            await convertPdfToJpg(pdfPath);
            console.log('---');
        }

        console.log('All PDFs processed successfully!');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

// Run the converter
processAllPdfs();
