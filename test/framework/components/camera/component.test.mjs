import { expect } from 'chai';

import { Color } from '../../../../src/core/math/color.js';
import { Mat4 } from '../../../../src/core/math/mat4.js';
import { Vec2 } from '../../../../src/core/math/vec2.js';
import { Vec3 } from '../../../../src/core/math/vec3.js';
import { Vec4 } from '../../../../src/core/math/vec4.js';
import { Entity } from '../../../../src/framework/entity.js';
import {
    ASPECT_MANUAL,
    FOG_LINEAR,
    GAMMA_NONE,
    LAYERID_UI,
    PROJECTION_ORTHOGRAPHIC,
    PROJECTION_PERSPECTIVE,
    SHADER_FORWARD,
    TONEMAP_ACES
} from '../../../../src/scene/constants.js';
import { FogParams } from '../../../../src/scene/fog-params.js';
import { createApp } from '../../../app.mjs';
import { jsdomSetup, jsdomTeardown } from '../../../jsdom.mjs';

describe('CameraComponent', function () {
    let app;

    beforeEach(function () {
        jsdomSetup();
        app = createApp();
    });

    afterEach(function () {
        app?.destroy();
        app = null;
        jsdomTeardown();
    });

    describe('screen conversions with non-uniform scale', function () {
        const width = 800;
        const height = 400;

        function projectRenderedPoint(camera, point) {
            // Use the renderer's view-projection matrix as the oracle: a round trip through
            // worldToScreen and screenToWorld can pass when both use the same wrong transform.
            const matrix = new Mat4().set(app.graphicsDevice.scope.resolve('matrix_viewProjection').value);
            const clip = matrix.transformVec4(new Vec4(point.x, point.y, point.z, 1));
            const { x, y, z, w } = camera.rect;
            return new Vec2(
                ((clip.x / clip.w + 1) * 0.5 * z + x) * width,
                ((1 - clip.y / clip.w) * 0.5 * w + 1 - y - w) * height
            );
        }

        [PROJECTION_PERSPECTIVE, PROJECTION_ORTHOGRAPHIC].forEach((projection) => {
            [false, true].forEach((scaleAncestor) => {
                const mode = projection === PROJECTION_PERSPECTIVE ? 'perspective' : 'orthographic';
                const scaled = scaleAncestor ? 'an ancestor' : 'the camera entity';

                describe(`${mode} camera with scale on ${scaled}`, function () {
                    let entity;

                    beforeEach(function () {
                        const ancestor = new Entity('ancestor');
                        ancestor.setLocalPosition(2, -3, 4);
                        ancestor.setLocalEulerAngles(-5, 20, 10);
                        app.root.addChild(ancestor);

                        entity = new Entity('camera');
                        entity.setLocalPosition(1, 2, 3);
                        entity.setLocalEulerAngles(15, -10, 25);
                        ancestor.addChild(entity);
                        (scaleAncestor ? ancestor : entity).setLocalScale(1, 0.8, 0.5);
                        entity.addComponent('camera', {
                            projection,
                            aspectRatioMode: ASPECT_MANUAL,
                            aspectRatio: 3,
                            nearClip: 0.5,
                            farClip: 30,
                            projectionOffset: [0.2, -0.15],
                            rect: new Vec4(0.125, 0.25, 0.75, 0.5)
                        });

                        app.renderer.setCameraUniforms(entity.camera.camera, null);
                    });

                    it('unprojects an off-center pixel onto the rendered ray', function () {
                        const camera = entity.camera;
                        const point = camera.screenToWorld(560, 135, 8, undefined, width, height);
                        const rendered = projectRenderedPoint(camera, point);

                        expect(rendered.x).to.be.closeTo(560, 1e-4);
                        expect(rendered.y).to.be.closeTo(135, 1e-4);
                        if (projection === PROJECTION_PERSPECTIVE) {
                            expect(point.distance(entity.getPosition())).to.be.closeTo(8, 1e-6);
                        }
                    });

                    it('projects a world point onto the rendered pixel', function () {
                        const camera = entity.camera;
                        const point = entity.getRotation().transformVector(new Vec3(1, 2, -8)).add(entity.getPosition());
                        const rendered = projectRenderedPoint(camera, point);
                        const screen = camera.worldToScreen(point, undefined, width, height);

                        expect(screen.x).to.be.closeTo(rendered.x, 1e-4);
                        expect(screen.y).to.be.closeTo(rendered.y, 1e-4);
                    });
                });
            });
        });
    });

    describe('#addComponent', function () {

        it('creates a component with sensible defaults', function () {
            const e = new Entity();
            e.addComponent('camera');

            expect(e.camera).to.exist;
            expect(e.camera.enabled).to.equal(true);
            expect(e.camera.fov).to.equal(45);
            expect(e.camera.nearClip).to.equal(0.1);
            expect(e.camera.farClip).to.equal(1000);
            expect(e.camera.clearColor.equals(new Color(0.75, 0.75, 0.75, 1))).to.equal(true);
            expect(e.camera.clearDepth).to.equal(1);
            expect(e.camera.fog).to.equal(null);
            expect(e.camera.orthoHeight).to.equal(10);
            expect(e.camera.priority).to.equal(0);
            expect(e.camera.projection).to.equal(PROJECTION_PERSPECTIVE);
            expect(e.camera.projectionOffset.equals(new Vec2(0, 0))).to.equal(true);
        });

        it('accepts an array-literal projectionOffset', function () {
            const e = new Entity();
            e.addComponent('camera', { projectionOffset: [0.1, 0.2] });

            expect(e.camera.projectionOffset.equals(new Vec2(0.1, 0.2))).to.equal(true);
        });

    });

    describe('#cloneComponent', function () {

        it('copies every property to the clone', function () {
            const fog = new FogParams();
            fog.type = FOG_LINEAR;
            fog.start = 10;
            fog.end = 100;

            const calculateProjection = () => {};
            const calculateTransform = () => {};

            const e = new Entity();
            e.addComponent('camera', {
                aspectRatioMode: ASPECT_MANUAL,
                aspectRatio: 2,
                calculateProjection: calculateProjection,
                calculateTransform: calculateTransform,
                clearColor: new Color(0.1, 0.2, 0.3, 0.4),
                clearColorBuffer: false,
                clearDepth: 0.5,
                clearDepthBuffer: false,
                clearStencilBuffer: false,
                cullFaces: false,
                farClip: 500,
                flipFaces: true,
                fog: fog,
                fov: 60,
                frustumCulling: false,
                horizontalFov: true,
                layers: [LAYERID_UI],
                nearClip: 2,
                orthoHeight: 7,
                priority: 3,
                projection: PROJECTION_ORTHOGRAPHIC,
                projectionOffset: new Vec2(0.1, -0.2),
                rect: new Vec4(0.1, 0.1, 0.5, 0.5),
                scissorRect: new Vec4(0.2, 0.2, 0.6, 0.6),
                aperture: 8,
                shutter: 1 / 500,
                sensitivity: 400,
                gammaCorrection: GAMMA_NONE,
                toneMapping: TONEMAP_ACES
            });

            // per-attachment clear colors are script API only, not addComponent options
            e.camera.setClearColor(1, new Color(0.5, 0.6, 0.7, 0.8));

            const clone = e.clone();
            const c = clone.camera;

            expect(c).to.exist;
            expect(c.enabled).to.equal(true);
            expect(c.aspectRatioMode).to.equal(ASPECT_MANUAL);
            expect(c.aspectRatio).to.equal(2);
            expect(c.calculateProjection).to.equal(calculateProjection);
            expect(c.calculateTransform).to.equal(calculateTransform);
            expect(c.clearColor.equals(new Color(0.1, 0.2, 0.3, 0.4))).to.equal(true);
            expect(c.getClearColor(1).equals(new Color(0.5, 0.6, 0.7, 0.8))).to.equal(true);
            expect(c.getClearColor(1)).to.not.equal(e.camera.getClearColor(1));
            expect(c.getClearColor(2)).to.equal(c.clearColor);
            expect(c.clearColorBuffer).to.equal(false);
            expect(c.clearDepth).to.equal(0.5);
            expect(c.clearDepthBuffer).to.equal(false);
            expect(c.clearStencilBuffer).to.equal(false);
            expect(c.cullFaces).to.equal(false);
            expect(c.farClip).to.equal(500);
            expect(c.flipFaces).to.equal(true);
            expect(c.fog).to.equal(fog);
            expect(c.fov).to.equal(60);
            expect(c.frustumCulling).to.equal(false);
            expect(c.horizontalFov).to.equal(true);
            expect(c.layers).to.deep.equal([LAYERID_UI]);
            expect(c.nearClip).to.equal(2);
            expect(c.orthoHeight).to.equal(7);
            expect(c.priority).to.equal(3);
            expect(c.projection).to.equal(PROJECTION_ORTHOGRAPHIC);
            expect(c.projectionOffset.equals(new Vec2(0.1, -0.2))).to.equal(true);
            expect(c.rect.equals(new Vec4(0.1, 0.1, 0.5, 0.5))).to.equal(true);
            expect(c.scissorRect.equals(new Vec4(0.2, 0.2, 0.6, 0.6))).to.equal(true);
            expect(c.aperture).to.equal(8);
            expect(c.shutter).to.equal(1 / 500);
            expect(c.sensitivity).to.equal(400);
            expect(c.gammaCorrection).to.equal(GAMMA_NONE);
            expect(c.toneMapping).to.equal(TONEMAP_ACES);
        });

        it('copies the enabled state to the clone', function () {
            const e = new Entity();
            e.addComponent('camera', { enabled: false });

            const clone = e.clone();

            expect(clone.camera.enabled).to.equal(false);
        });

    });

    describe('#setShaderPass', function () {

        it('returns the index of a named pass and reports its name', function () {
            const e = new Entity();
            e.addComponent('camera');

            const index = e.camera.setShaderPass('custom_rendering');

            expect(index).to.be.a('number');
            expect(e.camera.getShaderPass()).to.equal('custom_rendering');
        });

        it('returns to the forward pass when called without a name', function () {
            const e = new Entity();
            e.addComponent('camera');
            e.camera.setShaderPass('custom_rendering');

            expect(e.camera.setShaderPass()).to.equal(SHADER_FORWARD);
            expect(e.camera.getShaderPass()).to.equal(undefined);
        });

    });
});
