import {
    ADDRESS_CLAMP_TO_EDGE, Color, Entity, FILTER_NEAREST, GAMMA_NONE, LAYERID_UI, Layer,
    PIXELFORMAT_RGBA8, PROJECTION_ORTHOGRAPHIC, RENDERTARGET_ORIGIN_TOP, RenderTarget,
    Script, Sprite, Texture, TextureAtlas, Vec2, Vec4
} from 'playcanvas';

import { getPixelScreenLayout } from './pixel-screen-layout.mjs';

/**
 * Draws a camera at a fixed resolution and presents it at a centered integer scale. The default UI
 * layer is drawn at the canvas resolution. Attach to a camera with no existing render target;
 * configure its projection and framing for the desired game view as usual.
 */
class PixelScreen extends Script {
    static scriptName = 'pixelScreen';

    /**
     * Width of the game image in pixels, set before initialization.
     *
     * @attribute
     * @type {number}
     */
    width = 192;

    /**
     * Height of the game image in pixels, set before initialization.
     *
     * @attribute
     * @type {number}
     */
    height = 256;

    /**
     * Number of drawing-buffer pixels per game pixel. If the canvas is too small, scale stays at
     * one and the game image is cropped instead of being scaled fractionally.
     *
     * @type {number}
     */
    get scale() {
        return this._layout?.scale ?? 1;
    }

    /**
     * Converts viewport coordinates (for example, PointerEvent clientX/clientY) to continuous
     * game pixel coordinates with the origin at the top left. Coordinates are not clamped.
     *
     * @param {number} x - Horizontal viewport coordinate in CSS pixels.
     * @param {number} y - Vertical viewport coordinate in CSS pixels.
     * @returns {Vec2|null} Game pixel coordinates, or null when inactive or the canvas is hidden.
     */
    clientToScreen(x, y) {
        const device = this.app.graphicsDevice;
        const rect = device.canvas.getBoundingClientRect();
        if (!this.enabled || !this._layout || !rect.width || !rect.height) {
            return null;
        }

        return new Vec2(
            ((x - rect.left) * device.width / rect.width - this._layout.left) / this.scale,
            ((y - rect.top) * device.height / rect.height - this._layout.top) / this.scale
        );
    }

    initialize() {
        this._camera = this.entity.camera;
        if (!this._camera || this._camera.renderTarget ||
            !Number.isInteger(this.width) || this.width < 1 ||
            !Number.isInteger(this.height) || this.height < 1) {
            this.enabled = false;
            return;
        }

        const { app, width, height } = this;
        const device = app.graphicsDevice;
        const texture = new Texture(device, {
            name: 'Pixel Screen',
            width,
            height,
            format: PIXELFORMAT_RGBA8,
            mipmaps: false,
            minFilter: FILTER_NEAREST,
            magFilter: FILTER_NEAREST,
            addressU: ADDRESS_CLAMP_TO_EDGE,
            addressV: ADDRESS_CLAMP_TO_EDGE
        });
        this._target = new RenderTarget({ colorBuffer: texture, origin: RENDERTARGET_ORIGIN_TOP });

        this._atlas = new TextureAtlas();
        this._atlas.texture = texture;
        this._atlas.frames = {
            screen: { rect: new Vec4(0, 0, width, height), pivot: new Vec2(0.5, 0.5), border: new Vec4() }
        };
        this._sprite = new Sprite(device, { atlas: this._atlas, frameKeys: ['screen'], pixelsPerUnit: 1 });

        this._layer = new Layer({ name: 'Pixel Screen' });
        this._composition = app.scene.layers;
        this._composition.insert(this._layer, 0);

        this._display = new Entity('Pixel Screen Image', app);
        this._display.addComponent('sprite', { sprite: this._sprite, layers: [this._layer.id] });
        app.root.addChild(this._display);

        this._displayCamera = new Entity('Pixel Screen Camera', app);
        this._displayCamera.addComponent('camera', {
            projection: PROJECTION_ORTHOGRAPHIC,
            clearColor: Color.BLACK,
            layers: [this._layer.id, LAYERID_UI],
            priority: this._camera.priority + 1,
            gammaCorrection: GAMMA_NONE
        });
        app.root.addChild(this._displayCamera);

        this.on('enable', this._enable, this);
        this.on('disable', this._disable, this);
        this.on('destroy', () => {
            this._disable();
            this._displayCamera.destroy();
            this._display.destroy();
            this._composition.remove(this._layer);
            this._sprite.destroy();
            this._target.destroy();
            this._atlas.destroy();
        });

        this._enable();
    }

    /** @private */
    _enable() {
        this._originalLayers = this._camera.layers;
        this._camera.layers = this._originalLayers.filter(id => id !== LAYERID_UI);
        this._gameLayers = this._camera.layers;
        this._camera.renderTarget = this._target;
        this._display.enabled = this._displayCamera.enabled = true;
        this.app.graphicsDevice.on('resizecanvas', this._fit, this);
        this._fit();
    }

    /** @private */
    _disable() {
        this.app.graphicsDevice.off('resizecanvas', this._fit, this);
        if (this._camera.renderTarget === this._target) {
            this._camera.renderTarget = null;
        }
        if (this._camera.layers === this._gameLayers) {
            this._camera.layers = this._originalLayers;
        }
        this._display.enabled = this._displayCamera.enabled = false;
        this._layout = null;
    }

    /** @private */
    _fit() {
        const { width, height } = this.app.graphicsDevice;
        this._layout = getPixelScreenLayout(width, height, this._target.width, this._target.height);
        const { scale, cameraX, cameraY } = this._layout;
        this._display.setLocalScale(scale, scale, 1);
        this._displayCamera.camera.orthoHeight = Math.max(1, height) / 2;
        this._displayCamera.setPosition(cameraX, cameraY, 50);
    }
}

export { PixelScreen };
