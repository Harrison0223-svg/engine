import { expect } from 'chai';

import { EventHandler } from '../../../../src/core/event-handler.js';
import { AssetRegistry } from '../../../../src/framework/asset/asset-registry.js';
import { Asset } from '../../../../src/framework/asset/asset.js';
import { SoundSlot } from '../../../../src/framework/components/sound/slot.js';
import { Sound } from '../../../../src/platform/sound/sound.js';

function createSlot(options = {}) {
    const asset = { resource: new Sound({ duration: 4 }) };
    const component = {
        system: {
            app: {
                assets: {
                    get: () => asset
                }
            },
            manager: {}
        }
    };

    return new SoundSlot(component, 'Test', { asset: 1, ...options });
}

function createDeferredSlot(options = {}) {
    const callbacks = new Map();
    const assets = new AssetRegistry({
        load: (url, type, callback) => callbacks.set(url, callback),
        patch: () => {}
    });

    const started = [];
    const manager = new EventHandler();
    manager.volume = 1;
    manager.context = {
        currentTime: 0,
        destination: {},
        createGain: () => ({
            gain: { value: 1 },
            connect: () => {}
        }),
        createBufferSource: () => {
            const source = {
                playbackRate: { value: 1 },
                connect: () => {},
                start: () => started.push(source.buffer),
                stop: () => {}
            };
            return source;
        }
    };
    const component = new EventHandler();
    component.enabled = true;
    component.entity = { enabled: true };
    component.volume = 1;
    component.pitch = 1;
    component.system = { app: { assets }, manager };

    const slot = new SoundSlot(component, 'Test', { overlap: true, ...options });
    const complete = (asset, sound) => callbacks.get(asset.getFileUrl())(null, sound);

    return { slot, assets, started, complete };
}

describe('SoundSlot', function () {
    describe('#play', function () {
        for (const secondFirst of [false, true]) {
            it(`plays each pending request with its original asset when the ${secondFirst ? 'second' : 'first'} asset loads first`, function () {
                const { slot, assets, started, complete } = createDeferredSlot();
                const first = new Asset('first', 'audio', { url: 'first.wav' });
                const second = new Asset('second', 'audio', { url: 'second.wav' });
                const firstSound = new Sound({ duration: 2 });
                const secondSound = new Sound({ duration: 3 });
                const loaded = [];
                slot.on('load', sound => loaded.push(sound));
                assets.add(first);
                assets.add(second);

                slot.asset = first.id;
                const a = slot.play();
                slot.asset = second.id;
                const b = slot.play();
                expect(started).to.deep.equal([]);

                if (secondFirst) {
                    complete(second, secondSound);
                    expect(started).to.deep.equal([secondSound.buffer]);
                    expect(a.isPlaying).to.be.false;
                    complete(first, firstSound);
                } else {
                    complete(first, firstSound);
                    expect(started).to.deep.equal([firstSound.buffer]);
                    expect(b.isPlaying).to.be.false;
                    complete(second, secondSound);
                }

                expect(started).to.deep.equal(secondFirst ?
                    [secondSound.buffer, firstSound.buffer] : [firstSound.buffer, secondSound.buffer]);
                expect(a.sound).to.equal(firstSound);
                expect(b.sound).to.equal(secondSound);
                expect(loaded).to.deep.equal([secondSound]);
            });
        }

        it('does not start a stopped request but still resolves every request for the same asset', function () {
            const { slot, assets, started, complete } = createDeferredSlot();
            const asset = new Asset('shot', 'audio', { url: 'shot.wav' });
            const sound = new Sound({ duration: 2 });
            assets.add(asset);
            slot.asset = asset.id;
            const stopped = slot.play();
            stopped.stop();
            const a = slot.play();
            const b = slot.play();

            complete(asset, sound);

            expect(stopped.isPlaying).to.be.false;
            expect(a.sound).to.equal(sound);
            expect(b.sound).to.equal(sound);
            expect(started).to.deep.equal([sound.buffer, sound.buffer]);
        });

        it('can finish a pending request whose asset is registered after the selection changes', function () {
            const { slot, assets, started, complete } = createDeferredSlot();
            const first = new Asset('first', 'audio', { url: 'first.wav' });
            const second = new Asset('second', 'audio');
            const firstSound = new Sound({ duration: 2 });
            const secondSound = new Sound({ duration: 3 });
            second.resource = secondSound;
            assets.add(second);

            slot.asset = first.id;
            const a = slot.play();
            slot.asset = second.id;
            slot.play();
            expect(a.isPlaying).to.be.false;
            expect(started).to.deep.equal([secondSound.buffer]);

            assets.add(first);
            complete(first, firstSound);

            expect(a.sound).to.equal(firstSound);
            expect(started).to.deep.equal([secondSound.buffer, firstSound.buffer]);
        });

        it('accepts a numeric asset id supplied as a string', function () {
            const { slot, assets, started, complete } = createDeferredSlot();
            const asset = new Asset('shot', 'audio', { url: 'shot.wav' });
            const sound = new Sound({ duration: 2 });
            assets.add(asset);
            slot.asset = String(asset.id);
            const instance = slot.play();

            complete(asset, sound);

            expect(instance.sound).to.equal(sound);
            expect(started).to.deep.equal([sound.buffer]);
        });

        it('stops waiting for old assets when the slot is stopped before they load or register', function () {
            const { slot, assets, started, complete } = createDeferredSlot();
            const missing = new Asset('missing', 'audio', { url: 'missing.wav' });
            const loading = new Asset('loading', 'audio', { url: 'loading.wav' });
            assets.add(loading);

            slot.asset = missing.id;
            slot.play();
            slot.asset = loading.id;
            slot.play();
            slot.asset = null;
            slot.stop();

            expect(assets.hasEvent(`add:${missing.id}`)).to.be.false;
            expect(loading.hasEvent('load')).to.be.false;
            assets.add(missing);
            expect(missing.loading).to.be.false;
            complete(loading, new Sound({ duration: 2 }));
            expect(started).to.deep.equal([]);
        });

        it('lets a load listener stop the slot before deferred playback starts', function () {
            const { slot, assets, started, complete } = createDeferredSlot();
            const asset = new Asset('shot', 'audio', { url: 'shot.wav' });
            assets.add(asset);
            slot.once('load', () => slot.stop());
            slot.asset = asset.id;
            const instance = slot.play();

            complete(asset, new Sound({ duration: 2 }));

            expect(instance.isPlaying).to.be.false;
            expect(slot.instances).to.have.length(0);
            expect(started).to.deep.equal([]);
        });
    });

    describe('#duration', function () {
        it('returns the asset duration when no duration is specified', function () {
            expect(createSlot().duration).to.equal(4);
        });

        it('returns a duration shorter than the asset', function () {
            expect(createSlot({ duration: 2 }).duration).to.equal(2);
        });

        it('returns the asset duration when the durations match', function () {
            expect(createSlot({ duration: 4 }).duration).to.equal(4);
        });

        it('clamps a duration longer than the asset', function () {
            expect(createSlot({ duration: 6 }).duration).to.equal(4);
        });

        it('clamps the duration to the time remaining after startTime', function () {
            expect(createSlot({ startTime: 2, duration: 6 }).duration).to.equal(2);
            expect(createSlot({ startTime: 2, duration: 3 }).duration).to.equal(2);
        });

        it('normalizes startTime before clamping the duration', function () {
            expect(createSlot({ startTime: 6, duration: 6 }).duration).to.equal(2);
            expect(createSlot({ startTime: 4, duration: 6 }).duration).to.equal(4);
        });
    });
});
