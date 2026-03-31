import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export async function convertPdfToJpg(pdfPath: string, outputDir: string, mergePages: boolean = true, targetWidth: number = 2000, jpgQuality: number = 90, outputBaseName?: string): Promise<string | string[]> {
    const pdfName = outputBaseName ?? path.basename(pdfPath, '.pdf').replace(/\s+/g, '-');
    const tempDir = path.join(outputDir, 'temp_' + Date.now());

    console.log(`Processing: ${pdfName}.pdf`);

    // Create temp folder
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const DPI_FOR_TARGET = Math.ceil(targetWidth / 8.27 * 3.5); // ~1048 DPI
    
    try {
        const pdfFullPath = path.resolve(pdfPath);
        const outputPrefix = path.join(tempDir, 'page');
        
        // Path to pdftoppm executable in pdf-poppler package
        const pdftoppmPath = path.join(
            process.cwd(), 
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
        const files = fs.readdirSync(tempDir)
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

        // Process each page
        const processedImages = [];
        for (const file of files) {
            const filePath = path.join(tempDir, file);
            const image = sharp(filePath);
            const metadata = await image.metadata();

            const resizedBuffer = await image
                .resize(targetWidth, null, {
                    fit: 'inside',
                    withoutEnlargement: false,
                    kernel: sharp.kernel.lanczos3
                })
                .jpeg({ 
                    quality: jpgQuality, 
                    chromaSubsampling: '4:4:4',
                    mozjpeg: true,
                    force: true
                })
                .toBuffer();

            const resizedImage = sharp(resizedBuffer);
            const resizedMetadata = await resizedImage.metadata();

            processedImages.push({
                buffer: resizedBuffer,
                width: resizedMetadata.width!,
                height: resizedMetadata.height!
            });

            console.log(`Page ${processedImages.length}: ${resizedMetadata.width}x${resizedMetadata.height}px`);
        }

        // Ensure output folder exists
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        if (!mergePages) {
            // Save each page as an individual file
            const outputNames: string[] = [];
            for (let i = 0; i < processedImages.length; i++) {
                const pageName = `${pdfName}_page_${i + 1}.jpg`;
                const pagePath = path.join(outputDir, pageName);
                await sharp(processedImages[i].buffer).toFile(pagePath);
                outputNames.push(pageName);
                console.log(`✓ Saved page ${i + 1}: ${pagePath}`);
            }

            // Clean up temp files
            files.forEach(file => {
                fs.unlinkSync(path.join(tempDir, file));
            });
            fs.rmSync(tempDir, { recursive: true });

            return outputNames;
        }

        // Merge: combine images vertically
        const outputName = `${pdfName}.jpg`;
        const outputPath = path.join(outputDir, outputName);

        let finalImage;
        if (processedImages.length === 1) {
            finalImage = processedImages[0].buffer;
            console.log('Single page PDF - no combining needed');
        } else {
            const totalHeight = processedImages.reduce((sum, img) => sum + img.height, 0);
            const width = processedImages[0].width;

            console.log(`Combining ${processedImages.length} pages into ${width}x${totalHeight}px image`);

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
                    quality: jpgQuality,
                    chromaSubsampling: '4:4:4',
                    mozjpeg: true,
                    force: true
                })
                .toBuffer();
        }

        // Save final image
        await sharp(finalImage).toFile(outputPath);

        console.log(`✓ Successfully saved: ${outputPath}`);

        // Clean up temp files
        files.forEach(file => {
            fs.unlinkSync(path.join(tempDir, file));
        });
        fs.rmSync(tempDir, { recursive: true });

        return outputName;

    } catch (error) {
        // Clean up temp files on error
        if (fs.existsSync(tempDir)) {
            fs.rmSync(tempDir, { recursive: true });
        }
        console.error(`Error processing ${pdfName}.pdf:`, error);
        throw error;
    }
}