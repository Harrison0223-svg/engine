/**
 * Calculates the integer-scaled screen rectangle in drawing-buffer pixels.
 *
 * @param {number} width - Canvas width.
 * @param {number} height - Canvas height.
 * @param {number} screenWidth - Low-resolution width.
 * @param {number} screenHeight - Low-resolution height.
 * @returns {{ scale: number, left: number, top: number, cameraX: number, cameraY: number }} Screen layout.
 */
function getPixelScreenLayout(width, height, screenWidth, screenHeight) {
    const scale = Math.max(1, Math.floor(Math.min(width / screenWidth, height / screenHeight)));
    const horizontalPadding = (width - screenWidth * scale) / 2;
    const verticalPadding = (height - screenHeight * scale) / 2;
    const left = Math.floor(horizontalPadding);
    const top = Math.ceil(verticalPadding);

    return { scale, left, top, cameraX: horizontalPadding - left, cameraY: top - verticalPadding };
}

export { getPixelScreenLayout };
