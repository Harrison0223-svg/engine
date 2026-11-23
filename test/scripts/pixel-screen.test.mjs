import { expect } from 'chai';

import { getPixelScreenLayout } from '../../scripts/esm/camera/pixel-screen-layout.mjs';

describe('PixelScreen layout', function () {
    it('selects the largest fitting integer scale', function () {
        expect(getPixelScreenLayout(760, 515, 192, 256)).to.deep.equal({
            scale: 2, left: 188, top: 2, cameraX: 0, cameraY: 0.5
        });
    });

    it('aligns edges when the game and canvas have different parity', function () {
        expect(getPixelScreenLayout(8, 9, 5, 4)).to.deep.equal({
            scale: 1, left: 1, top: 3, cameraX: 0.5, cameraY: 0.5
        });
    });

    it('centers the crop without downscaling a too-small canvas', function () {
        expect(getPixelScreenLayout(3, 3, 6, 6)).to.deep.equal({
            scale: 1, left: -2, top: -1, cameraX: 0.5, cameraY: 0.5
        });
    });
});
